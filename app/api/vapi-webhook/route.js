import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Check if it's an end-of-call report from Vapi
    const message = body.message;
    if (message && message.type === 'end-of-call-report') {
    console.log('FULL VAPI MESSAGE:', JSON.stringify(message, null, 2));
      const callData = message.call || {};
      const vapiCallId = callData.id;
      const rawDuration = callData.durationSeconds || message.durationSeconds || callData.duration || 0;
      const duration = Math.round(Number(rawDuration) || 0);
      const transcript = message.transcript || callData.transcript || '';
      
      const vapiRecordingUrl = 
        message.artifact?.recordingUrl || 
        callData.artifact?.recordingUrl || 
        callData.recordingUrl || 
        message.recordingUrl || 
        null;
      const summaryText = message.analysis?.summary || 'Call completed successfully.';
      
      // Use upsert on vapi_call_id to cleanly insert or update without primary key type mismatches
      const { error: upsertError } = await supabase
        .from('calls')
        .upsert(
          [
            {
              vapi_call_id: vapiCallId,
              duration_seconds: duration,
              transcript: transcript,
              recording_url: vapiRecordingUrl,
              sales_status: 'Completed',
              summary: summaryText
            }
          ],
          { onConflict: 'vapi_call_id' }
        );

      if (upsertError) {
        console.error('Supabase Upsert Error:', upsertError);
      }
    }

    // Always return a clean 200 OK so Vapi registers successful webhook delivery
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook Internal Error:', err);
    // Return 200 even on catch to prevent Vapi retry spam and 500 logs
    return NextResponse.json({ success: true, error: err.message }, { status: 200 });
  }
}