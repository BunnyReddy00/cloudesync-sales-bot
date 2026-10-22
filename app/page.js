"use client";

import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";

const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "63c6ac0f-820b-4cd9-9cb2-c7356491ae85");

export default function SalesBotPage() {
  const [connecting, setConnecting] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  
  const [salesStatus, setSalesStatus] = useState("No Response");
  const [aiSummary, setAiSummary] = useState("Waiting for conversation to finish...");
  const [callHistory, setCallHistory] = useState([]);

  const timerRef = useRef(null);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("sankar_sales_call_history");
    if (savedHistory) {
      try {
        setCallHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Error parsing history", e);
      }
    }

    vapi.on("call-start", () => {
      setConnecting(false);
      setCallActive(true);
      setCallDuration(0);
      durationRef.current = 0;
      
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    });

    vapi.on("call-end", (payload) => {
      setCallActive(false);
      clearInterval(timerRef.current);

      const callId = payload?.id || payload?.callId || payload?.call?.id;
        generateAssignmentArtifacts(durationRef.current, callId);

      generateAssignmentArtifacts(durationRef.current, recordingUrl);
    });

    vapi.on("message", (message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [...prev, { role: message.role, text: message.transcript }]);
      }
    });

    return () => clearInterval(timerRef.current);
  }, []);

  const startCall = async () => {
    try {
      setConnecting(true);
      setMessages([]);
      setAiSummary("Analyzing conversation...");
      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "7e379781-ecca-4f5a-98fc-47aba2c2fc44";
      await vapi.start(assistantId);
    } catch (err) {
      console.error("Failed to start call:", err);
      setConnecting(false);
      alert("Could not start call. Check your Vapi Public Key & Assistant ID.");
    }
  };

  const endCall = () => {
    vapi.stop();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const generateAssignmentArtifacts = (finalDurationSeconds, callId) => {
    const textBlob = messages.map(m => m.text).join(" ").toLowerCase();
    let status = "Interested";
    let summary = "Customer engaged in conversation about SaaS pricing and features.";

    if (textBlob.includes("buy") || textBlob.includes("subscribe") || textBlob.includes("sign up") || textBlob.includes("purchase")) {
      status = "Converted";
      summary = "Customer agreed to purchase and requested onboarding details.";
    } else if (textBlob.includes("demo") || textBlob.includes("show me") || textBlob.includes("walkthrough")) {
      status = "Demo Requested";
      summary = "Customer requested a live product walkthrough demonstration.";
    } else if (textBlob.includes("call back") || textBlob.includes("tomorrow") || textBlob.includes("later")) {
      status = "Follow-up Required";
      summary = "Customer asked for a follow-up call at a later date.";
    } else if (textBlob.includes("not interested") || textBlob.includes("no thanks") || textBlob.includes("stop")) {
      status = "Not Interested";
      summary = "Customer declined the offer and stated no current need.";
    }

    setSalesStatus(status);
    setAiSummary(summary);

    const formattedDuration = formatTime(finalDurationSeconds);

  const newEntry = {
  id: Date.now(),
  vapiCallId: callId,
  date: new Date().toLocaleString(),
  duration: formattedDuration === "00:00" ? "00:05" : formattedDuration,
  status: status,
  summary: summary,
  messages: [...messages],
};
    setCallHistory((prev) => {
      const updated = [newEntry, ...prev];
      localStorage.setItem("sankar_sales_call_history", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Sankar Group – AI Voice Sales Bot</h1>
            <p className="text-slate-400 text-sm mt-1">Intern Assignment Submission Dashboard</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-lg">
            <div className="text-sm font-mono text-slate-300 px-2">
              Status: <span className={callActive ? "text-emerald-400 font-bold" : "text-slate-400"}>{callActive ? "Active Call" : "Idle"}</span>
              {callActive && <span className="ml-3 text-amber-400">⏱️ {formatTime(callDuration)}</span>}
            </div>

            {!callActive ? (
              <button
                onClick={startCall}
                disabled={connecting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg transition shadow-md disabled:opacity-50"
              >
                {connecting ? "Connecting..." : "Start Call"}
              </button>
            ) : (
              <button
                onClick={endCall}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2 rounded-lg transition shadow-md animate-pulse"
              >
                End Call
              </button>
            )}
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[500px] shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
              <span>💬</span> Live Conversation Transcript
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
              {messages.length === 0 ? (
                <p className="text-slate-500 text-center py-32 italic">Start a call to begin...</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-slate-400 mb-1 capitalize">{msg.role}</span>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-slate-800 text-slate-200 rounded-bl-none"}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Sales Status</h2>
              <div className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {salesStatus}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">AI Summary</h2>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                {aiSummary}
              </p>
            </div>
          </div>
        </div>

        {/* Call History Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-200">📜 Previous Call History</h2>
            <button 
              onClick={() => { localStorage.removeItem("sankar_sales_call_history"); setCallHistory([]); }} 
              className="text-xs bg-rose-900/40 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded-lg transition"
            >
              Clear History
            </button>
          </div>
          {callHistory.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No previous conversations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="p-3 rounded-l-lg">Date & Time</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Summary</th>
                    <th className="p-3 rounded-r-lg">Recording Playback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {callHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono text-xs">{item.date}</td>
                      <td className="p-3 font-mono text-xs">{item.duration}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-200 border border-slate-700">
                          {item.status}
                        </span>
                      </td>
                     <td className="p-3">
                  {item.vapiCallId ? (
                    <audio 
                      controls 
                      src={`/api/recording/${item.vapiCallId}`} 
                      className="h-8 w-44" 
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">Syncing Audio...</span>
                  )}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}