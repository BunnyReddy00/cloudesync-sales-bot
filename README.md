# CloudSync AI Sales Bot

## Run locally

1. Copy `.env.example` to `.env.local` and add the Vapi, Supabase, and OpenAI credentials.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev` and open `http://localhost:3000`.

In the Vapi assistant's Server URL settings, set the publicly reachable URL
`https://<your-domain>/api/vapi-webhook` and enable the `end-of-call-report`
server message. Make sure call recording is enabled in the Vapi assistant. A
local `localhost` URL cannot receive Vapi's cloud webhook; use a deployed URL
or a secure development tunnel. The Supabase
project must contain a `calls` table with the fields used by the page and webhook:
`id`, `created_at`, `vapi_call_id`, `duration_seconds`, `transcript`, `summary`,
`sales_status`, and `recording_url`.

Create a **private** Supabase Storage bucket named `call-recordings` (or set
`SUPABASE_RECORDINGS_BUCKET` to the bucket name), and set
`SUPABASE_SERVICE_ROLE_KEY` in the server's `.env.local` or deployment secrets.
Never use a `NEXT_PUBLIC_` prefix for this key. The service role is used only by
server routes to store recordings and issue one-hour playback URLs. Each visit
to call history requests fresh URLs, so recordings can be played again later
without making the bucket public.

Each web call explicitly requests Vapi MP3 recording and an end-of-call report.
Vapi must still be able to reach the configured webhook at a public HTTPS URL;
the local `localhost` server cannot receive Vapi reports.

The anon key must have permission to insert rows into `calls` for the browser
save when the web call ends. The public Vapi webhook then enriches the row with
the full transcript, privately stored recording, and AI summary. History
refreshes automatically while open.
The webhook reads Vapi's report recording fields (`artifact.recording.stereoUrl`
or the mono recording URLs) and copies the audio into private Supabase Storage
for replay from Call History.

The live-call page lets callers choose English, Hindi, or Telugu. The selected
language is used for the greeting and added as an instruction to the existing
assistant at call start, preserving its configured role and tools. Configure
the assistant's Vapi transcriber to recognize the selected languages and use a
voice that can speak them; the code cannot change or verify the provider and
voice configured for the remote assistant.
