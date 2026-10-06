/** OpenAI makes the picture. A miss returns null so the chat can say it did not come back. */

const PICTURE_MISS = null;

type PictureImage = { mimeType: string; data: string };

function pictureBytes(data: { data?: { b64_json?: string }[] }): { mimeType: string; data: string } | null {
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return PICTURE_MISS;
  return { mimeType: "image/png", data: b64 };
}

export async function makePicture(
  prompt: string,
  options?: { quality?: "low" | "medium" | "high"; images?: PictureImage[] },
): Promise<{ mimeType: string; data: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const text = prompt.trim();
  if (!key || !text) return PICTURE_MISS;
  const quality = options?.quality ?? "low";
  const photo = options?.images?.find((image) => image.data);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = photo
      ? await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${key}` },
          body: editBody(text, quality, photo),
        })
      : await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: text.slice(0, 4000),
            size: "1024x1024",
            quality,
            n: 1,
          }),
        });
    if (!res.ok) return PICTURE_MISS;
    return pictureBytes((await res.json()) as { data?: { b64_json?: string }[] });
  } catch {
    return PICTURE_MISS;
  } finally {
    clearTimeout(timer);
  }
}

function editBody(text: string, quality: "low" | "medium" | "high", photo: PictureImage): FormData {
  const form = new FormData();
  form.set("model", "gpt-image-1");
  form.set("prompt", text.slice(0, 4000));
  form.set("size", "1024x1024");
  form.set("quality", quality);
  form.set("n", "1");
  const bytes = Buffer.from(photo.data, "base64");
  const type = photo.mimeType === "image/png" || photo.mimeType === "image/webp" ? photo.mimeType : "image/jpeg";
  form.append("image", new Blob([bytes], { type }), type === "image/png" ? "photo.png" : "photo.jpg");
  return form;
}
