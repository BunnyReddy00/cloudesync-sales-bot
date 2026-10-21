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

      // Use your exact production domain for the proxy URL
      const recordingUrl = vapiCallId 
        ? `https://cloudsync-sales-bot-git-main-kanyarashi15.vercel.app/api/recording?id=${vapiCallId}` 
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