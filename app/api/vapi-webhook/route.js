import { NextResponse } from "next/server";

// In-memory store for demo/assignment purposes (or wire this up to a database/localStorage via frontend polling)
let globalCallHistory = [];

export async function POST(req) {
  try {
    const body = await req.json();

    // Check if the event is Vapi's end-of-call report
    if (body.message && body.message.type === "end-of-call-report") {
      const callData = body.message;

      const recordingUrl = callData.recordingUrl || callData.stereoRecordingUrl || null;
      const summary = callData.analysis?.summary || callData.summary || "Conversation completed.";
      const transcript = callData.transcript || "";
      const endedReason = callData.endedReason || "Completed";
      
      // Determine sales status based on analysis structured data or transcript keywords
      let status = "Interested";
      const textToCheck = (summary + " " + transcript).toLowerCase();

      if (textToCheck.includes("buy") || textToCheck.includes("purchase") || textToCheck.includes("order")) {
        status = "Converted";
      } else if (textToCheck.includes("demo") || textToCheck.includes("walkthrough")) {
        status = "Demo Requested";
      } else if (textToCheck.includes("call back") || textToCheck.includes("later") || textToCheck.includes("tomorrow")) {
        status = "Follow-up Required";
      } else if (textToCheck.includes("not interested") || textToCheck.includes("no thanks")) {
        status = "Not Interested";
      }

      const newEntry = {
        id: callData.call?.id || Date.now(),
        date: new Date().toLocaleString(),
        duration: callData.duration ? `${Math.floor(callData.duration / 60)}m ${Math.floor(callData.duration % 60)}s` : "N/A",
        status: status,
        summary: summary,
        recordingUrl: recordingUrl,
        transcript: transcript,
        endedReason: endedReason
      };

      // Push to our log array
      globalCallHistory.unshift(newEntry);

      console.log("Call ended successfully, recording saved:", recordingUrl);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Optional: GET endpoint so your frontend page.js can fetch the saved call history & recordings list
export async function GET() {
  return NextResponse.json({ history: globalCallHistory }, { status: 200 });
}