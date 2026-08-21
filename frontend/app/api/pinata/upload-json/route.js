import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const jsonBody = await req.json();

    if (!jsonBody) {
      return NextResponse.json({ error: "No JSON payload provided." }, { status: 400 });
    }

    const jwt = process.env.PINATA_JWT?.trim();
    if (!jwt) {
      return NextResponse.json({ error: "PINATA_JWT is not configured in environment." }, { status: 500 });
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ pinataContent: jsonBody }),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error("Pinata Upload JSON Failed:", res.status, responseText);
      return NextResponse.json({ error: `Pinata (${res.status}): ${responseText}` }, { status: res.status });
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Pinata JSON Route Exception:", error);
    return NextResponse.json({ error: error.message || "Internal server error during JSON upload." }, { status: 500 });
  }
}
