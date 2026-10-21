import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const SALES_STATUSES = [
  'Converted',
  'Interested',
  'Follow-up Required',
  'Not Interested',
  'Demo Requested',
  'No Response',
];

const STORAGE_REFERENCE_PREFIX = 'supabase-storage://';
const RECORDING_HOSTS = new Set(['storage.vapi.ai']);

function getRecordingExtension(contentType) {
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  const extensions = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
  };
  const extension = extensions[mediaType];
  if (!extension) {
    throw new Error(`Unsupported Vapi recording content type: ${mediaType || 'unknown'}.`);
  }
  return { extension, mediaType };
}

async function storeRecording(supabase, bucket, callId, recordingUrl) {
  if (!recordingUrl) return null;

  const parsedUrl = new URL(recordingUrl);
  if (parsedUrl.protocol !== 'https:' || !RECORDING_HOSTS.has(parsedUrl.hostname)) {
    throw new Error('Vapi returned a recording URL from an unsupported host.');
  }

  const response = await fetch(parsedUrl, { redirect: 'error' });
  if (!response.ok) {
    throw new Error(`Could not download Vapi recording (HTTP ${response.status}).`);
  }

  const { extension, mediaType } = getRecordingExtension(
    response.headers.get('content-type') || '',
  );
  const storagePath = `${callId}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(
    storagePath,
    Buffer.from(await response.arrayBuffer()),
    { contentType: mediaType, upsert: true },
  );
  if (error) throw error;

  return `${STORAGE_REFERENCE_PREFIX}${storagePath}`;
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (body.message?.type !== 'end-of-call-report') {
      return NextResponse.json({ success: true, ignored: true }, { status: 200 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_RECORDINGS_BUCKET || 'call-recordings';
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!supabaseUrl || !supabaseKey || !openAiKey) {
      throw new Error(
        'Missing Supabase URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY configuration.',
      );
    }

    const message = body.message;
    const artifact = message.artifact || {};
    const transcript =
      artifact.transcript || message.transcript || 'No transcript available.';
    const vapiRecordingUrl =
      artifact.recordingUrl ||
      artifact.stereoRecordingUrl ||
      message.recordingUrl ||
      '';
    const duration = Number(message.durationSeconds) || 0;
    const vapiCallId = message.call?.id;
    console.info('Vapi end-of-call report received', {
      callId: vapiCallId,
      hasRecording: Boolean(vapiRecordingUrl),
    });

    if (!vapiCallId || !/^[A-Za-z0-9_-]+$/.test(vapiCallId)) {
      throw new Error('Vapi end-of-call report did not contain a valid call ID.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    let callId;
    if (vapiCallId) {
      const { data: existingCall, error: lookupError } = await supabase
        .from('calls')
        .select('id')
        .eq('vapi_call_id', vapiCallId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existingCall) {
        const { error: updateError } = await supabase
          .from('calls')
          .update({
            duration_seconds: duration,
            transcript,
          })
          .eq('id', existingCall.id);
        if (updateError) throw updateError;
        callId = existingCall.id;
      }
    }

    if (!callId) {
      const { data: call, error: insertError } = await supabase
        .from('calls')
        .insert({
          vapi_call_id: vapiCallId,
          duration_seconds: duration,
          transcript,
          recording_url: null,
          summary: null,
          sales_status: null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      callId = call.id;
    }

    const recordingReference = await storeRecording(
      supabase,
      bucket,
      vapiCallId,
      vapiRecordingUrl,
    );
    if (recordingReference) {
      const { error: recordingUpdateError } = await supabase
        .from('calls')
        .update({ recording_url: recordingReference })
        .eq('id', callId);
      if (recordingUpdateError) throw recordingUpdateError;
    }

    try {
      const openai = new OpenAI({ apiKey: openAiKey });
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analyze the sales call transcript and return a JSON object with a short 2-3 sentence summary and a sales_status chosen from: ${SALES_STATUSES.join(', ')}.`,
          },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_object' },
      });

      const content = aiResponse.choices[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned an empty call analysis.');

      const analysis = JSON.parse(content);
      if (
        typeof analysis.summary !== 'string' ||
        !SALES_STATUSES.includes(analysis.sales_status)
      ) {
        throw new Error('OpenAI returned call analysis in an invalid format.');
      }

      const { error: updateError } = await supabase
        .from('calls')
        .update({
          summary: analysis.summary,
          sales_status: analysis.sales_status,
        })
        .eq('id', callId);
      if (updateError) throw updateError;
    } catch (error) {
      console.error('Call saved, but AI analysis failed:', error);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook processing failed.' },
      { status: 500 },
    );
  }
}
