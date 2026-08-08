/* eslint-disable @typescript-eslint/no-explicit-any */
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let mapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

let mapsAuthBlocked = false;
let mapsPendingReject: ((error: Error) => void) | null = null;

function handleMapsAuthFailure() {
  mapsAuthBlocked = true;
  if (mapsPendingReject) {
    const reject = mapsPendingReject;
    mapsPendingReject = null;
    reject(new Error("Google Maps is blocked for this domain. Add this site to the API key restrictions."));
  }
  mapsPromise = null;
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

export function googleMapsEmbedUrl(coords: { lat: number; lng: number }, label?: string, zoom = 15) {
  if (label) {
    return `https://www.google.com/maps?q=${encodeURIComponent(label)}&z=${zoom}&output=embed`;
  }
  return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=${zoom}&output=embed`;
}

export function loadGoogleMaps(): Promise<any> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error("Google Maps API key is not configured"));
  if (typeof window === "undefined")
    return Promise.reject(new Error("Google Maps is only available in the browser"));
if (window.google?.maps?.places && window.google?.maps?.geometry) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  if (mapsAuthBlocked) {
    return Promise.reject(
      new Error("Google Maps is blocked for this domain. Add this site to the API key restrictions."),
    );
  }

  if (!window.gm_authFailure) {
    window.gm_authFailure = handleMapsAuthFailure;
  }

  mapsPromise = new Promise((resolve, reject) => {
    mapsPendingReject = reject;
    const cleanupAndReject = (error: Error) => {
      if (mapsPendingReject === reject) mapsPendingReject = null;
      mapsPromise = null;
      document.querySelectorAll<HTMLScriptElement>("script[data-google-maps='true']").forEach((script) => {
        if (!window.google?.maps) script.remove();
      });
      reject(error);
    };

    const timer = window.setTimeout(() => {
      cleanupAndReject(new Error("Google Maps failed to load (API key may be blocked for this domain)"));
    }, 15000);
    const startCleanup = () => window.clearTimeout(timer);

    const loadMissingLibraries = async () => {
      const importLibrary = window.google?.maps?.importLibrary;
      if (typeof importLibrary !== "function") return;
      const tasks: Promise<unknown>[] = [];
      if (!window.google?.maps?.places) tasks.push(importLibrary("places"));
      if (!window.google?.maps?.geometry) tasks.push(importLibrary("geometry"));
      if (tasks.length) await Promise.all(tasks);
    };

const resolveWhenReady = () => {
      startCleanup();
      if (mapsPendingReject === reject) mapsPendingReject = null;
      if (window.google?.maps?.places && window.google?.maps?.geometry) {
        resolve(window.google);
        return;
      }
      window.setTimeout(() => {
        loadMissingLibraries()
          .then(() => {
            if (mapsPendingReject === reject) mapsPendingReject = null;
            if (window.google?.maps?.places && window.google?.maps?.geometry) {
              resolve(window.google);
            } else {
              cleanupAndReject(new Error("Google Maps loaded without required Places or Geometry libraries"));
            }
          })
          .catch(() => cleanupAndReject(new Error("Google Maps loaded without required Places or Geometry libraries")));
      }, 250);
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps='true']");
    if (existing) {
      if (window.google?.maps) {
        resolveWhenReady();
        return;
      }
      existing.addEventListener("load", resolveWhenReady, { once: true });
      existing.addEventListener(
        "error",
        () => cleanupAndReject(new Error("Google Maps failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      libraries: "places,geometry",
      loading: "async",
      v: "weekly",
      region: "IN",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = resolveWhenReady;
    script.onerror = () => cleanupAndReject(new Error("Google Maps failed to load"));
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
  if (!GOOGLE_MAPS_KEY) throw new Error("Google Maps API key is not configured");

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: toRoutesLatLng(origin) } },
        destination: { location: { latLng: toRoutesLatLng(destination) } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const route = data?.routes?.[0];
    if (!response.ok || !route) throw new Error(data?.error?.message || "Unable to calculate route");
    const distanceKm = Math.round(((Number(route.distanceMeters) || 0) / 1000) * 10) / 10;
    const etaMinutes = Math.max(1, Math.round(parseGoogleDurationSeconds(route.duration) / 60));
    return {
      distanceKm,
      etaMinutes,
      path: decodeRoutePath(route.polyline?.encodedPolyline),
    };
  } catch {
    const distanceKm = Math.round((distanceMeters(origin, destination) / 1000) * 10) / 10;
    return {
      distanceKm,
      etaMinutes: fallbackEtaMinutes(distanceKm),
      path: [origin, destination],
    };
  }
}

function toRoutesLatLng(coords: LatLngLiteral) {
  return {
    latitude: coords.lat,
    longitude: coords.lng,
  };
}

function parseGoogleDurationSeconds(duration: unknown) {
  if (typeof duration === "string") return Number(duration.replace("s", "")) || 0;
  if (typeof duration === "number") return duration;
  return 0;
}

function decodeRoutePath(encoded?: string): LatLngLiteral[] | undefined {
  if (!encoded || typeof window === "undefined" || !window.google?.maps?.geometry?.encoding) return undefined;
  return window.google.maps.geometry.encoding.decodePath(encoded).map((point: any) => ({
    lat: point.lat(),
    lng: point.lng(),
  }));
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
