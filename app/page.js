'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { createClient } from '@supabase/supabase-js';

const CALL_LANGUAGES = {
  en: {
    label: 'English',
    greeting: "Hello, I'm Alex from CloudSync. How can I help you today?",
    instruction:
      'Speak only in English. Continue the existing CloudSync sales assistant role, instructions, and tools, but answer the caller in clear, natural English.',
  },
  hi: {
    label: 'Hindi',
    greeting:
      'नमस्ते, मैं CloudSync से Alex बोल रहा हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?',
    instruction:
      'Speak only in natural Hindi. Use Devanagari script, while keeping product names and technical terms in English when natural. Continue the existing CloudSync sales assistant role, instructions, and tools.',
  },
  te: {
    label: 'Telugu',
    greeting:
      'నమస్కారం, నేను CloudSync నుండి అలెక్స్ మాట్లాడుతున్నాను. ఈరోజు మీకు ఎలా సహాయం చేయగలను?',
    instruction:
      'Speak only in natural Telugu. Use Telugu script, while keeping product names and technical terms in English when natural. Continue the existing CloudSync sales assistant role, instructions, and tools.',
  },
};

let browserSupabase;

function getSupabaseClient(url, anonKey) {
  if (!browserSupabase) {
    browserSupabase = createClient(url, anonKey);
  }
  return browserSupabase;
}

function getCallErrorMessage(error) {
  const errorName = error?.name || error?.error?.name;
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return 'Microphone access is blocked. Allow microphone access for this site in your browser settings, then try again.';
  }

  const findMessage = (value, seen = new Set()) => {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object' || seen.has(value)) return '';
    seen.add(value);

    for (const key of ['message', 'error', 'reason', 'details', 'description']) {
      const message = findMessage(value[key], seen);
      if (message) return message;
    }
    return '';
  };

  const message = findMessage(error);
  if (message) return message;

  try {
    const details = JSON.stringify(error);
    if (details && details !== '{}') return `Call failed: ${details}`;
  } catch {
    console.error('Could not serialize Vapi call error:', error);
  }

  return 'The call could not be completed. Check microphone access, the Vapi assistant, and the browser console for details.';
}

export default function Home() {
  const vapiRef = useRef(null);
  const callIdRef = useRef('');
  const callStartedAtRef = useRef(null);
  const transcriptsRef = useRef([]);
  const saveEndedCallRef = useRef(null);
  const languageRef = useRef('en');
  const [activeTab, setActiveTab] = useState('call');
  const [callLanguage, setCallLanguage] = useState('en');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState([]);
  const [callsHistory, setCallsHistory] = useState([]);
  const [callError, setCallError] = useState('');
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      setCallError('Set NEXT_PUBLIC_VAPI_PUBLIC_KEY to enable calls.');
      return undefined;
    }

    const client = new Vapi(publicKey);
    vapiRef.current = client;

    client.on('call-start', () => {
      callStartedAtRef.current = Date.now();
      setCallStatus('active');
      try {
        client.send({
          type: 'add-message',
          message: {
            role: 'system',
            content: CALL_LANGUAGES[languageRef.current].instruction,
          },
        });
      } catch (error) {
        console.error('Could not set call language:', error);
        setCallError('Call started, but the selected language could not be applied.');
      }
    });
    client.on('call-end', () => {
      setCallStatus('idle');
      void saveEndedCallRef.current?.();
    });
    client.on('call-start-success', (event) => {
      if (event.callId && event.callId !== 'unknown') {
        callIdRef.current = event.callId;
      }
    });
    client.on('error', (error) => {
      console.error('Vapi call error:', JSON.stringify(error));
      const callId = callIdRef.current || error?.context?.callId;
      setCallError(
        `${getCallErrorMessage(error)}${callId ? ` (Vapi call ID: ${callId})` : ''}`,
      );
      setCallStatus('idle');
    });
    client.on('call-start-failed', (event) => {
      console.error('Vapi call start failed:', JSON.stringify(event));
      setCallError(
        `${event.stage}: ${event.error || 'The call could not be started.'}${event.context?.callId ? ` (Vapi call ID: ${event.context.callId})` : ''}`,
      );
      setCallStatus('idle');
    });

    client.on('message', (message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const transcript = { role: message.role, text: message.transcript };
        transcriptsRef.current = [...transcriptsRef.current, transcript];
        setTranscripts(transcriptsRef.current);
      }
    });

    return () => {
      client.removeAllListeners();
      vapiRef.current = null;
    };
  }, []);

  useEffect(() => {
    let timer;
    if (callStatus === 'active') {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  const fetchHistory = useCallback(async ({ preserveRecordingUrls = false } = {}) => {
    try {
      const response = await fetch('/api/calls', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Call history could not be loaded.');
      }
      setCallsHistory((previousCalls) => {
        if (!preserveRecordingUrls) return result.calls || [];

        const previousById = new Map(
          previousCalls.map((call) => [call.id, call]),
        );
        return (result.calls || []).map((call) => {
          const previous = previousById.get(call.id);
          const previousExpiry = Date.parse(
            previous?.recording_url_expires_at || '',
          );
          const previousUrlIsFresh =
            previous?.recording_url &&
            (!Number.isFinite(previousExpiry) ||
              previousExpiry > Date.now() + 60_000);

          return previousUrlIsFresh && call.recording_url
            ? {
                ...call,
                recording_url: previous.recording_url,
                recording_url_expires_at:
                  previous.recording_url_expires_at,
              }
            : call;
        });
      });
      setHistoryError(result.warning || '');
    } catch (error) {
      console.error('Call history error:', error);
      setHistoryError(error.message || 'Call history could not be loaded.');
    }
  }, []);

  const saveEndedCall = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const callId = callIdRef.current;

    if (!url || !anonKey) {
      setCallError('Call ended, but Supabase is not configured to save it.');
      return;
    }
    if (!callId) {
      setCallError('Call ended, but Vapi did not provide a call ID, so it could not be saved.');
      return;
    }

    const transcript = transcriptsRef.current
      .map(({ role, text }) => `${role}: ${text}`)
      .join('\n');
    const durationSeconds = callStartedAtRef.current
      ? Math.floor((Date.now() - callStartedAtRef.current) / 1000)
      : 0;

    try {
      const supabase = getSupabaseClient(url, anonKey);
      const { data: existingCall, error: lookupError } = await supabase
        .from('calls')
        .select('id')
        .eq('vapi_call_id', callId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (!existingCall) {
        const { error: insertError } = await supabase.from('calls').insert({
          vapi_call_id: callId,
          duration_seconds: durationSeconds,
          transcript: transcript || 'No transcript available.',
        });
        if (insertError) throw insertError;
      }

      setCallError('');
      await fetchHistory();
    } catch (error) {
      console.error('Could not save ended call:', error);
      setCallError(
        `Call ended, but it could not be saved to history: ${error?.message || 'Check Supabase table permissions.'}`,
      );
    }
  }, [fetchHistory]);
  saveEndedCallRef.current = saveEndedCall;

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (activeTab !== 'history') return undefined;
    const refreshTimer = setInterval(
      () => void fetchHistory({ preserveRecordingUrls: true }),
      5000,
    );
    return () => clearInterval(refreshTimer);
  }, [activeTab, fetchHistory]);

  const startCall = async () => {
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    if (!vapiRef.current || !assistantId) {
      setCallError('Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID to enable calls.');
      return;
    }

    setCallError('');
    setCallStatus('connecting');
    languageRef.current = callLanguage;
    callIdRef.current = '';
    callStartedAtRef.current = null;
    transcriptsRef.current = [];
    setTranscripts([]);
    try {
      if (navigator.permissions?.query) {
        try {
          const microphone = await navigator.permissions.query({
            name: 'microphone',
          });
          if (microphone.state === 'denied') {
            throw new DOMException(
              'Microphone access is blocked for this site.',
              'NotAllowedError',
            );
          }
        } catch (error) {
          if (error?.name === 'NotAllowedError') throw error;
          console.warn('Could not check microphone permission:', error);
        }
      }
      const call = await vapiRef.current.start(assistantId, {
        firstMessage: CALL_LANGUAGES[callLanguage].greeting,
        artifactPlan: {
          recordingEnabled: true,
          recordingFormat: 'mp3',
        },
        serverMessages: ['end-of-call-report'],
      });
      if (call?.id) callIdRef.current = call.id;
    } catch (error) {
      console.error('Could not start Vapi call:', error);
      setCallStatus('idle');
      setCallError(getCallErrorMessage(error));
    }
  };

  const endCall = () => {
    try {
      vapiRef.current?.stop();
    } catch (error) {
      console.error('Could not end Vapi call:', error);
      setCallError(error?.message || 'The call could not be ended.');
    }
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Converted': 'bg-emerald-100 text-emerald-800',
      'Demo Requested': 'bg-blue-100 text-blue-800',
      'Interested': 'bg-teal-100 text-teal-800',
      'Follow-up Required': 'bg-amber-100 text-amber-800',
      'Not Interested': 'bg-rose-100 text-rose-800',
      'No Response': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-extrabold text-slate-800">CloudSync AI Sales Bot</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('call')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'call' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'
              }`}
            >
              Live Call
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                void fetchHistory();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'
              }`}
            >
              Call History
            </button>
          </div>
        </header>

        {callError && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {callError}
          </div>
        )}

        {activeTab === 'call' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5 rounded-lg mb-6">
              🎙️ <strong>Consent Notice:</strong> Calls are recorded for quality control and automated transcript generation.
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <label htmlFor="call-language" className="font-semibold text-slate-700">
                Call language:
              </label>
              <select
                id="call-language"
                value={callLanguage}
                onChange={(event) => setCallLanguage(event.target.value)}
                disabled={callStatus !== 'idle'}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 disabled:bg-slate-100"
              >
                {Object.entries(CALL_LANGUAGES).map(([code, language]) => (
                  <option key={code} value={code}>
                    {language.label}
                  </option>
                ))}
              </select>
              <span className="text-sm text-slate-500">
                The bot will greet and respond in the selected language.
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-100 p-4 rounded-xl mb-6">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-slate-700">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${
                  callStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {callStatus}
                </span>
                {callStatus === 'active' && (
                  <span className="text-sm text-slate-600 font-mono">
                    ⏱️ {formatTime(callDuration)}
                  </span>
                )}
              </div>

              {callStatus === 'idle' ? (
                <button
                  onClick={startCall}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
                >
                  Start Call
                </button>
              ) : callStatus === 'connecting' ? (
                <button
                  disabled
                  className="bg-slate-400 text-white font-semibold px-6 py-2.5 rounded-lg cursor-wait"
                >
                  Connecting...
                </button>
              ) : (
                <button
                  onClick={endCall}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
                >
                  End Call
                </button>
              )}
            </div>

            <div className="border rounded-xl p-4 h-96 overflow-y-auto bg-slate-50 flex flex-col gap-3">
              {transcripts.length === 0 ? (
                <div className="text-center text-slate-400 my-auto">
                  Click <strong>"Start Call"</strong> to speak with Alex...
                </div>
              ) : (
                transcripts.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl max-w-[75%] text-sm ${
                      t.role === 'user'
                        ? 'bg-indigo-600 text-white self-end'
                        : 'bg-white border text-slate-800 self-start shadow-sm'
                    }`}
                  >
                    <div className="text-[10px] font-semibold opacity-75 mb-1 uppercase">
                      {t.role === 'user' ? 'Customer' : 'AI Sales Bot'}
                    </div>
                    {t.text}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {historyError && (
              <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {historyError}
              </div>
            )}
            {callsHistory.some((call) => !call.recording_url) && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                One or more calls have no recording. For new calls, set the
                Vapi assistant&apos;s Server URL to
                <code className="mx-1 inline-block">
                  https://&lt;your-deployed-domain&gt;/api/vapi-webhook
                </code>
                , subscribe to <code>end-of-call-report</code>, and enable call
                recording. Vapi cannot send reports to localhost. This will not
                add recordings to calls made before setup; if the URL is already
                configured, check Vapi&apos;s webhook delivery logs for failed
                reports.
              </div>
            )}
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-100 border-b text-slate-600 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Sales Status</th>
                  <th className="p-4">AI Summary</th>
                  <th className="p-4">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {callsHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No recorded calls found yet.
                    </td>
                  </tr>
                ) : (
                  callsHistory.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 whitespace-nowrap text-slate-600">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 text-slate-600">{formatTime(c.duration_seconds || 0)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(c.sales_status)}`}>
                          {c.sales_status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-700 max-w-md">{c.summary || 'Generating summary...'}</td>
                      <td className="p-4">
                        {c.recording_url ? (
                          <audio
                            key={c.recording_url}
                            controls
                            preload="none"
                            src={c.recording_url}
                            className="h-8 w-44"
                          />
                        ) : (
                          <span className="text-slate-500 text-xs">
                            Recording not received
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}