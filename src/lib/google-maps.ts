/* eslint-disable @typescript-eslint/no-explicit-any */
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
let mapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

export type LatLngLiteral = { lat: number; lng: number };

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
