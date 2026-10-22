import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;
  const privateKey = process.env.VAPI_PRIVATE_API_KEY;

  if (!privateKey) {
    return NextResponse.json(
      { error: "Missing VAPI_PRIVATE_API_KEY" },
      { status: 500 },
    );
  }

  if (!id || !/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid call ID" }, { status: 400 });
  }

  try {
    const requestHeaders = new Headers({
      Authorization: `Bearer ${privateKey}`,
    });
    const range = request.headers.get("range");
    if (range) requestHeaders.set("Range", range);

    const recordingResponse = await fetch(
      `https://api.vapi.ai/call/${encodeURIComponent(id)}/stereo-recording`,
      { headers: requestHeaders },
    );

    if (!recordingResponse.ok) {
      return NextResponse.json(
        { error: "Recording not ready or not found" },
        { status: recordingResponse.status },
      );
    }

    const responseHeaders = new Headers();
    for (const name of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
    ]) {
      const value = recordingResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    responseHeaders.set("Cache-Control", "private, no-store");

    return new NextResponse(recordingResponse.body, {
      status: recordingResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Error streaming recording proxy:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
