import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
    }

    const jwt = process.env.PINATA_JWT?.trim();
    if (!jwt) {
      return NextResponse.json({ error: "PINATA_JWT is not configured in environment." }, { status: 500 });
    }

    const pinataData = new FormData();
    const bytes = await file.arrayBuffer();
    const blob = new Blob([bytes], { type: file.type || "image/jpeg" });
    pinataData.append("file", blob, file.name || "property_image.jpg");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: pinataData,
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error("Pinata Upload File Failed:", res.status, responseText);
      return NextResponse.json({ error: `Pinata (${res.status}): ${responseText}` }, { status: res.status });
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Pinata File Route Exception:", error);
    return NextResponse.json({ error: error.message || "Internal server error during upload." }, { status: 500 });
  }
}
