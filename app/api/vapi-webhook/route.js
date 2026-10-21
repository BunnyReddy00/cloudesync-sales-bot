import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body.message;

    if (message && message.type === 'end-of-call-report') {
      const callData = message.call || {};
      const vapiCallId = callData.id;
      
      const rawDuration = callData.durationSeconds || message.durationSeconds || callData.duration || 0;
      const duration = Math.round(Number(rawDuration) || 0);
      const transcript = message.transcript || callData.transcript || '';
      const summaryText = message.analysis?.summary || 'Call completed successfully.';

      // 1. Try extracting from webhook message payload first
      let vapiRecordingUrl = 
        message.artifact?.recordingUrl || 
        callData.artifact?.recordingUrl || 
        message.recordingUrl || 
        callData.recordingUrl || 
        null;

      // 2. If recordingUrl is missing, fetch the call directly from Vapi API (handles processing delay)
      if (!vapiRecordingUrl && vapiCallId && process.env.VAPI_PRIVATE_API_KEY) {
        try {
          const vapiRes = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.VAPI_PRIVATE_API_KEY}`
            }
          });
          if (vapiRes.ok) {
            const vapiJson = await vapiRes.json();
            vapiRecordingUrl = vapiJson.artifact?.recordingUrl || vapiJson.recordingUrl || vapiJson.stereoRecordingUrl || null;
          }
        } catch (err) {
          console.error('Error fetching call from Vapi API:', err);
        }
      }

      // Upsert into Supabase
      const { error } = await supabase
        .from('calls')
        .upsert({
          vapi_call_id: vapiCallId,
          duration: duration,
          summary: summaryText,
          transcript: transcript,
          recording_url: vapiRecordingUrl,
          sales_status: 'Completed'
        }, {
          onConflict: 'vapi_call_id'
        });

      if (error) {
        console.error('Supabase upsert error:', error);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}