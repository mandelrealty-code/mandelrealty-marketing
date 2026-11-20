import type { VercelResponse } from "@vercel/node";

type AddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type NewAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

function placesErr(
  res: VercelResponse,
  error: string,
  errorCode: string,
  extra: Record<string, unknown> = {},
) {
  return res.status(200).json({ error, errorCode, ...extra });
}

function getComponent(components: AddressComponent[], types: string[], short = false): string {
  const comp = components.find((c) => (c.types || []).some((t) => types.includes(t)));
  if (!comp) return "";
  return String((short ? comp.short_name : comp.long_name) || "");
}

function getNewComponent(components: NewAddressComponent[], types: string[], short = false): string {
  const comp = components.find((c) => (c.types || []).some((t) => types.includes(t)));
  if (!comp) return "";
  return String((short ? comp.shortText : comp.longText) || "");
}

async function autocompleteNew(apiKey: string, input: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error?.message || `Places API (New) HTTP ${response.status}`,
      googleStatus: data.error?.status || String(response.status),
    };
  }
  const predictions = (data.suggestions || [])
    .map((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return null;
      const main = p.structuredFormat?.mainText?.text || "";
      const secondary = p.structuredFormat?.secondaryText?.text || "";
      const description =
        p.text?.text || [main, secondary].filter(Boolean).join(", ") || p.placeId;
      return { description, place_id: p.placeId };
    })
    .filter(Boolean);
  return { ok: true as const, predictions };
}

async function autocompleteLegacy(apiKey: string, input: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", input);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("types", "address");
  url.searchParams.set("components", "country:ca");

  const response = await fetch(url.toString());
  if (!response.ok) {
    return {
      ok: false as const,
      error: "Failed to connect to Google Places API",
      googleStatus: "NETWORK",
    };
  }
  const data = (await response.json()) as {
    status?: string;
    error_message?: string;
    predictions?: Array<{ description?: string; place_id?: string }>;
  };
  if (data.status === "OK" || data.status === "ZERO_RESULTS") {
    return { ok: true as const, predictions: data.predictions || [] };
  }
  return {
    ok: false as const,
    error: data.error_message || data.status || "API error",
    googleStatus: data.status ?? null,
  };
}

async function detailsNew(apiKey: string, placeId: string) {
  const id = placeId.startsWith("places/") ? placeId.slice("places/".length) : placeId;
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "formattedAddress,addressComponents,location");
  const response = await fetch(url.toString(), {
    headers: { "X-Goog-Api-Key": apiKey },
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
    formattedAddress?: string;
    addressComponents?: NewAddressComponent[];
    location?: { latitude?: number; longitude?: number };
  };
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error?.message || `Places details HTTP ${response.status}`,
      googleStatus: data.error?.status || String(response.status),
    };
  }
  const components = data.addressComponents || [];
  const streetNumber = getNewComponent(components, ["street_number"]);
  const route = getNewComponent(components, ["route"]);
  return {
    ok: true as const,
    place: {
      street_address: [streetNumber, route].filter(Boolean).join(" "),
      city: getNewComponent(components, ["locality", "sublocality", "administrative_area_level_3"]),
      state_province: getNewComponent(components, ["administrative_area_level_1"], true),
      postal_code: getNewComponent(components, ["postal_code"]),
      country: getNewComponent(components, ["country"], true),
      formatted_address: data.formattedAddress || "",
      latitude: typeof data.location?.latitude === "number" ? data.location.latitude : null,
      longitude: typeof data.location?.longitude === "number" ? data.location.longitude : null,
    },
  };
}

async function detailsLegacy(apiKey: string, placeId: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("fields", "address_components,formatted_address,geometry");

  const response = await fetch(url.toString());
  if (!response.ok) {
    return { ok: false as const, error: "Failed to connect to Google Places API", googleStatus: "NETWORK" };
  }
  const data = (await response.json()) as {
    status?: string;
    error_message?: string;
    result?: {
      address_components?: AddressComponent[];
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    };
  };
  if (data.status !== "OK" || !data.result) {
    return {
      ok: false as const,
      error: data.error_message || "Details API error",
      googleStatus: data.status ?? null,
    };
  }
  const result = data.result;
  const components = result.address_components || [];
  const streetNumber = getComponent(components, ["street_number"]);
  const route = getComponent(components, ["route"]);
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;
  return {
    ok: true as const,
    place: {
      street_address: [streetNumber, route].filter(Boolean).join(" "),
      city: getComponent(components, ["locality", "sublocality", "administrative_area_level_3"]),
      state_province: getComponent(components, ["administrative_area_level_1"], true),
      postal_code: getComponent(components, ["postal_code"]),
      country: getComponent(components, ["country"], true),
      formatted_address: result.formatted_address || "",
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lng === "number" ? lng : null,
    },
  };
}

/** Google Places autocomplete + details (server-side; uses GOOGLE_MAPS_API_KEY). */
export async function handlePlacesOp(
  body: Record<string, unknown>,
  res: VercelResponse,
): Promise<VercelResponse> {
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (!apiKey) {
    return placesErr(
      res,
      "Google Maps API key not configured on the server.",
      "MISSING_GOOGLE_MAPS_API_KEY",
      { predictions: [] },
    );
  }

  const action = String(body.action || body.placesAction || "").trim().toLowerCase();

  try {
    if (action === "autocomplete") {
      const input = String(body.input || "").trim();
      if (input.length < 3) {
        return res.status(200).json({ predictions: [] });
      }

      // Prefer Places API (New); fall back to legacy Place Autocomplete.
      const neu = await autocompleteNew(apiKey, input);
      if (neu.ok) {
        return res.status(200).json({ predictions: neu.predictions, api: "places_new" });
      }

      const legacy = await autocompleteLegacy(apiKey, input);
      if (legacy.ok) {
        return res.status(200).json({ predictions: legacy.predictions, api: "places_legacy" });
      }

      console.error("[places] autocomplete rejected", {
        newError: neu.error,
        newStatus: neu.googleStatus,
        legacyError: legacy.error,
        legacyStatus: legacy.googleStatus,
      });
      return placesErr(
        res,
        `New: ${neu.error} | Legacy: ${legacy.error}`,
        "GOOGLE_PLACES_REJECTED",
        {
          predictions: [],
          googleStatus: neu.googleStatus || legacy.googleStatus,
          newError: neu.error,
          legacyError: legacy.error,
        },
      );
    }

    if (action === "details") {
      const placeId = String(body.placeId || "").trim();
      if (!placeId) {
        return placesErr(res, "placeId is required", "INVALID_REQUEST");
      }

      const neu = await detailsNew(apiKey, placeId);
      if (neu.ok) {
        return res.status(200).json({ place: neu.place, api: "places_new" });
      }

      const legacy = await detailsLegacy(apiKey, placeId);
      if (legacy.ok) {
        return res.status(200).json({ place: legacy.place, api: "places_legacy" });
      }

      return placesErr(
        res,
        `New: ${neu.error} | Legacy: ${legacy.error}`,
        "GOOGLE_PLACES_REJECTED",
        { googleStatus: neu.googleStatus || legacy.googleStatus },
      );
    }

    return placesErr(res, "Invalid action", "INVALID_REQUEST");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return placesErr(res, message, "INTERNAL", { predictions: [] });
  }
}
