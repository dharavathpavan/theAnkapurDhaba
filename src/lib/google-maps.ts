/* eslint-disable @typescript-eslint/no-explicit-any */
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let mapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

export type LatLngLiteral = { lat: number; lng: number };
export type PlaceSuggestion = {
  placeId: string;
  title: string;
  subtitle: string;
};

export type ParsedAddress = {
  formattedAddress: string;
  houseNumber?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

export function hasGoogleMapsKey() {
  return Boolean(GOOGLE_MAPS_KEY);
}

export function loadGoogleMaps(): Promise<any> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (typeof window === "undefined")
    return Promise.reject(new Error("Google Maps is only available in the browser"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps='true']");
    if (existing) {
      existing.addEventListener("load", () =>
        window.google ? resolve(window.google) : reject(new Error("Google Maps failed to load")),
      );
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = () =>
      window.google ? resolve(window.google) : reject(new Error("Google Maps failed to load"));
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export function distanceMeters(a: LatLngLiteral, b: LatLngLiteral) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function fallbackEtaMinutes(distanceKm: number) {
  return Math.max(8, Math.round(12 + distanceKm * 4));
}

export async function calculateDrivingRoute(origin: LatLngLiteral, destination: LatLngLiteral) {
  const google = await loadGoogleMaps();
  return new Promise<{ distanceKm: number; etaMinutes: number; result?: any }>(
    (resolve, reject) => {
      const directions = new google.maps.DirectionsService();
      directions.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          },
        },
        (result: any, status: string) => {
          if (status !== "OK" || !result?.routes?.[0]?.legs?.[0])
            return reject(new Error("Unable to calculate route"));
          const leg = result.routes[0].legs[0];
          resolve({
            distanceKm: Math.round(((leg.distance?.value || 0) / 1000) * 10) / 10,
            etaMinutes: Math.max(
              1,
              Math.round((leg.duration_in_traffic?.value || leg.duration?.value || 0) / 60),
            ),
            result,
          });
        },
      );
    },
  );
}

export async function getPlaceSuggestions(query: string) {
  const search = query.trim();
  if (!search) return [];
  const google = await loadGoogleMaps();
  return new Promise<PlaceSuggestion[]>((resolve, reject) => {
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: search,
        componentRestrictions: { country: "in" },
        fields: ["place_id", "description", "structured_formatting"],
      },
      (predictions: any[] | null, status: string) => {
        if (status !== "OK" && status !== "ZERO_RESULTS") {
          reject(new Error("Unable to search locations"));
          return;
        }
        resolve(
          (predictions || []).slice(0, 8).map((place) => ({
            placeId: place.place_id,
            title: place.structured_formatting?.main_text || place.description,
            subtitle: place.structured_formatting?.secondary_text || "",
          })),
        );
      },
    );
  });
}

export async function geocodePlace(placeId: string) {
  const google = await loadGoogleMaps();
  return new Promise<{ coords: LatLngLiteral; address: ParsedAddress }>((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ placeId }, (results: any[] | null, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        reject(new Error("Could not find this address"));
        return;
      }
      const result = results[0];
      const loc = result.geometry.location;
      resolve({
        coords: { lat: loc.lat(), lng: loc.lng() },
        address: parseAddressComponents(result),
      });
    });
  });
}

export async function reverseGeocodeAddress(coords: LatLngLiteral) {
  const google = await loadGoogleMaps();
  return new Promise<ParsedAddress>((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results: any[] | null, status: string) => {
      if (status !== "OK" || !results?.[0]) {
        reject(new Error("Could not read this location"));
        return;
      }
      resolve(parseAddressComponents(results[0]));
    });
  });
}

function parseAddressComponents(result: any): ParsedAddress {
  const find = (type: string) =>
    result.address_components?.find((part: any) => part.types?.includes(type))?.long_name || "";
  const route = find("route");
  const streetNumber = find("street_number");
  const sublocality = find("sublocality_level_1") || find("sublocality") || find("neighborhood");
  return {
    formattedAddress: result.formatted_address || "",
    houseNumber: streetNumber,
    landmark: route || sublocality,
    city: find("locality") || find("administrative_area_level_3"),
    state: find("administrative_area_level_1"),
    country: find("country"),
    postalCode: find("postal_code"),
  };
}

export function googleMapsDirectionsUrl(input: {
  origin?: LatLngLiteral;
  destination: LatLngLiteral | string;
  waypoint?: LatLngLiteral | string;
}) {
  const destination =
    typeof input.destination === "string"
      ? input.destination
      : `${input.destination.lat},${input.destination.lng}`;
  const origin = input.origin
    ? `&origin=${encodeURIComponent(`${input.origin.lat},${input.origin.lng}`)}`
    : "";
  const waypoint = input.waypoint
    ? `&waypoints=${encodeURIComponent(typeof input.waypoint === "string" ? input.waypoint : `${input.waypoint.lat},${input.waypoint.lng}`)}`
    : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(destination)}${waypoint}&travelmode=driving`;
}
