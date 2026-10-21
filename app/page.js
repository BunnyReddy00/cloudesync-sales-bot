"use client";

import { useState, useRef } from "react";

export default function Page() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Start live recording from microphone
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

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      // Stop all microphone tracks to turn off the mic light
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">
      <div className="max-w-md w-full bg-gray-800 p-6 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-6">Live Audio Recorder & Player</h1>

        {/* Live Call / Recording Controls */}
        <div className="mb-6">
          {!recording ? (
            <button
              onClick={startRecording}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-full transition"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-full animate-pulse transition"
            >
              Stop Recording...
            </button>
          )}
        </div>

        {/* Playback Section */}
        {audioUrl && (
          <div className="mt-6 border-t border-gray-700 pt-4">
            <h2 className="text-lg font-medium mb-3">Listen to Recording:</h2>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </div>
    </main>
  );
}