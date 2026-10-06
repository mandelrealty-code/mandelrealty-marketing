/** OpenAI makes the picture. A miss returns null so the chat can say it did not come back. */

const PICTURE_MISS = null;

export async function makePicture(prompt: string): Promise<{ mimeType: string; data: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const text = prompt.trim();
  if (!key || !text) return PICTURE_MISS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
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
        quality: "low",
        n: 1,
      }),
    });
    if (!res.ok) return PICTURE_MISS;
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return PICTURE_MISS;
    return { mimeType: "image/png", data: b64 };
  } catch {
    return PICTURE_MISS;
  } finally {
    clearTimeout(timer);
  }
}
