"use client";

import { useState, useRef } from "react";

export default function Page() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access your microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center">
        <h1 className="text-2xl font-bold mb-2">CloudSync Sales Bot</h1>
        <p className="text-slate-400 text-sm mb-8">Record and test your audio inputs below</p>

        <div className="mb-6">
          {!recording ? (
            <button
              onClick={startRecording}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
              Stop Recording
            </button>
          )}
        </div>

        {audioUrl && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h2 className="text-sm font-medium text-slate-300 mb-3 text-left">Playback Recording:</h2>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>
    </main>
  );
}