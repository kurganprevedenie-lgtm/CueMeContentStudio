import { NextResponse } from "next/server";

import {
  BackgroundUploadError,
  listBackgroundVideos,
  saveBackgroundUpload,
} from "@/lib/backgrounds";

export async function GET() {
  const backgrounds = await listBackgroundVideos();
  return NextResponse.json({ backgrounds });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Нужен файл `file`" }, { status: 400 });
  }

  try {
    const background = await saveBackgroundUpload(file);
    return NextResponse.json({ background });
  } catch (e: unknown) {
    if (e instanceof BackgroundUploadError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
