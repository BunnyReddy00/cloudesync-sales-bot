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

      const recordingUrl = 
        payload?.recordingUrl || 
        payload?.stereoRecordingUrl || 
        payload?.artifact?.recordingUrl || 
        payload?.artifact?.stereoRecordingUrl || 
        null;

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

  const generateAssignmentArtifacts = (finalDurationSeconds, recordingUrl) => {
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
    } else if (textBlob.includes("not interested") || textBlob.includes("