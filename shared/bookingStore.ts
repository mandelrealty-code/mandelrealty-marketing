/**
 * Persist booked call starts so slots can't double-book.
 * Uses Supabase when configured; otherwise in-memory (dev / single instance only).
 *
 * SQL (run once in Supabase):
 *   create table if not exists call_bookings (
 *     start_iso text primary key,
 *     name text,
 *     email text,
 *     phone text,
 *     created_at timestamptz default now()
 *   );
 */

type ReserveMeta = { name: string; email: string; phone: string };

const memoryBooked = new Set<string>();

function supabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

export async function getBookedStartIsos(): Promise<string[]> {
  const sb = supabaseConfig();
  if (!sb) return [...memoryBooked];

  try {
    const res = await fetch(
      `${sb.url}/rest/v1/call_bookings?select=start_iso&start_iso=gte.${encodeURIComponent(new Date().toISOString())}`,
      {
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
        },
      },
    );
    if (!res.ok) {
      console.error("[bookings] list failed", res.status, await res.text());
      return [...memoryBooked];
    }
    const rows = (await res.json()) as { start_iso: string }[];
    const fromDb = rows.map((r) => r.start_iso);
    for (const iso of fromDb) memoryBooked.add(iso);
    return [...new Set([...memoryBooked, ...fromDb])];
  } catch (err) {
    console.error("[bookings] list error", err);
    return [...memoryBooked];
  }
}

/** Returns true if reserved, false if already taken */
export async function tryReserveCallSlot(
  startIso: string,
  meta: ReserveMeta,
): Promise<boolean> {
  if (memoryBooked.has(startIso)) return false;

  const sb = supabaseConfig();
  if (!sb) {
    memoryBooked.add(startIso);
    console.warn(
      "[bookings] SUPABASE_URL not set — using in-memory booking store (not durable across deploys)",
    );
    return true;
  }

  try {
    const res = await fetch(`${sb.url}/rest/v1/call_bookings`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        start_iso: startIso,
        name: meta.name,
        email: meta.email,
        phone: meta.phone,
      }),
    });

    if (res.status === 409 || res.status === 23505) {
      return false;
    }
    // PostgREST unique violation often 409
    if (!res.ok) {
      const text = await res.text();
      if (text.toLowerCase().includes("duplicate") || text.includes("23505")) {
        return false;
      }
      // Table missing / misconfigured — fall back to memory so form still works
      if (res.status === 404 || text.includes("PGRST") || text.includes("schema cache")) {
        console.warn("[bookings] call_bookings table missing — using memory store. Run SQL from .env.example.");
        memoryBooked.add(startIso);
        return true;
      }
      console.error("[bookings] reserve failed", res.status, text);
      memoryBooked.add(startIso);
      return true;
    }

    memoryBooked.add(startIso);
    return true;
  } catch (err) {
    console.error("[bookings] reserve error", err);
    return false;
  }
}
