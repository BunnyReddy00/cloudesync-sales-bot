import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const STORAGE_REFERENCE_PREFIX = 'supabase-storage://';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_RECORDINGS_BUCKET || 'call-recordings';
    if (!url || !anonKey) {
      throw new Error('Missing Supabase URL or NEXT_PUBLIC_SUPABASE_ANON_KEY configuration.');
    }

    const reader = createClient(url, anonKey);
    const { data: calls, error } = await reader
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const storageAdmin = serviceRoleKey
      ? createClient(url, serviceRoleKey)
      : null;
    let hasUnplayableStoredRecording = false;
    const history = await Promise.all(
      (calls || []).map(async (call) => {
        const recordingUrl = call.recording_url;
        if (
          typeof recordingUrl !== 'string' ||
          !recordingUrl.startsWith(STORAGE_REFERENCE_PREFIX)
        ) {
          return call;
        }

        if (!storageAdmin) {
          hasUnplayableStoredRecording = true;
          return { ...call, recording_url: null };
        }

        const storagePath = recordingUrl.slice(STORAGE_REFERENCE_PREFIX.length);
        const { data, error: signedUrlError } = await storageAdmin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60 * 60);
        if (signedUrlError) throw signedUrlError;

        return { ...call, recording_url: data.signedUrl };
      }),
    );

    return NextResponse.json({
      calls: history,
      warning: hasUnplayableStoredRecording
        ? 'Set SUPABASE_SERVICE_ROLE_KEY on the server to play privately stored recordings.'
        : '',
    });
  } catch (error) {
    console.error('Call history API error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Call history could not be loaded.',
      },
      { status: 500 },
    );
  }
}
