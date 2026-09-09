import type { VercelResponse } from "@vercel/node";

type AddressComponent = {
  long_name?: string;
  short_name?: string;
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

      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", input);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("types", "address");

      const response = await fetch(url.toString());
      if (!response.ok) {
        return placesErr(res, "Failed to connect to Google Places API", "GOOGLE_PLACES_NETWORK", {
          predictions: [],
        });
      }
      const data = (await response.json()) as {
        status?: string;
        error_message?: string;
        predictions?: unknown[];
      };

      if (data.status === "OK" || data.status === "ZERO_RESULTS") {
        return res.status(200).json({ predictions: data.predictions || [] });
      }

      return placesErr(
        res,
        data.error_message || data.status || "API error",
        "GOOGLE_PLACES_REJECTED",
        { predictions: [], googleStatus: data.status ?? null },
      );
    }

    if (action === "details") {
      const placeId = String(body.placeId || "").trim();
      if (!placeId) {
        return placesErr(res, "placeId is required", "INVALID_REQUEST");
      }

      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("fields", "address_components,formatted_address,geometry");

      const response = await fetch(url.toString());
      if (!response.ok) {
        return placesErr(res, "Failed to connect to Google Places API", "GOOGLE_PLACES_NETWORK");
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

      if (data.status === "OK" && data.result) {
        const result = data.result;
        const components = result.address_components || [];
        const streetNumber = getComponent(components, ["street_number"]);
        const route = getComponent(components, ["route"]);
        const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;

        return res.status(200).json({
          place: {
            street_address: streetAddress,
            city: getComponent(components, [
              "locality",
              "sublocality",
              "administrative_area_level_3",
            ]),
            state_province: getComponent(components, ["administrative_area_level_1"], true),
            postal_code: getComponent(components, ["postal_code"]),
            country: getComponent(components, ["country"], true),
            formatted_address: result.formatted_address || "",
            latitude: typeof lat === "number" ? lat : null,
            longitude: typeof lng === "number" ? lng : null,
          },
        });
      }

      return placesErr(
        res,
        data.error_message || "Details API error",
        "GOOGLE_PLACES_REJECTED",
        { googleStatus: data.status ?? null },
      );
    }

    return placesErr(res, "Invalid action", "INVALID_REQUEST");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return placesErr(res, message, "INTERNAL", { predictions: [] });
  }
}
