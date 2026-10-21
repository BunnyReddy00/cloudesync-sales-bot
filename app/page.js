"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [isClient, setIsClient] = useState(false);

  // Ensures client-side execution for browser-dependent APIs (like audio recording)
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Prevents server-side hydration mismatches
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Audio Recorder / Player</h1>
        <p className="text-gray-600">
          Your audio recording and playback logic goes here.
        </p>
      </div>
    </main>
  );
}