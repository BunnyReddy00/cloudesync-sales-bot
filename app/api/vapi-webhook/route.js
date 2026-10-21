import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body.message || {};
    const callData = message.call || body.call || {};

    if (message.type === 'end-of-call-report' || callData.id) {
      const vapiCallId = callData.id || message.callId;
      
      // Extract duration from all possible locations in the Vapi payload
      const rawDuration = callData.durationSeconds || message.durationSeconds || callData.duration || message.call?.duration || 0;
      const duration = Math.round(Number(rawDuration) || 0);

      const transcript = message.transcript || callData.transcript || '';
      const summaryText = message.analysis?.summary || callData.analysis?.summary || 'Call completed successfully.';

      const recordingUrl = vapiCallId 
        ? `https://cloudsync-sales-bot.vercel.app/api/recording?id=${vapiCallId}` 
        : null;

      const { error } = await supabase
        .from('calls')
        .upsert({
          vapi_call_id: vapiCallId,
          duration: duration,
          summary: summaryText,
          transcript: transcript,
          recording_url: recordingUrl,
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