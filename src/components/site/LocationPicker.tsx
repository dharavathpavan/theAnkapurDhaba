/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import {
  geocodePlace,
  getPlaceSuggestions,
  hasGoogleMapsKey,
  loadGoogleMaps,
  reverseGeocodeAddress,
  type LatLngLiteral,
  type ParsedAddress,
  type PlaceSuggestion,
} from "@/lib/google-maps";

type LocationPickerProps = {
  value: LatLngLiteral | null;
  address: string;
  restaurant?: LatLngLiteral;
  compact?: boolean;
  onChange: (next: { coords: LatLngLiteral; address?: string; parsed?: ParsedAddress }) => void;
};

const DEFAULT_CENTER = { lat: 17.562861, lng: 78.453472 };

export function LocationPicker({
  value,
  address,
  restaurant,
  compact = false,
  onChange,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [manualLat, setManualLat] = useState(value?.lat ? String(value.lat) : "");
  const [manualLng, setManualLng] = useState(value?.lng ? String(value.lng) : "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => setQuery(address), [address]);
  useEffect(() => {
    setManualLat(value?.lat ? String(value.lat) : "");
    setManualLng(value?.lng ? String(value.lng) : "");
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (!hasGoogleMapsKey() || !mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        const center = value || restaurant || DEFAULT_CENTER;
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: value ? 16 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        mapInstance.current = map;
        markerRef.current = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: "Delivery location",
          icon: customerPointerIcon(google),
        });
        markerRef.current.addListener("dragend", () => {
          const pos = markerRef.current?.getPosition();
          if (!pos) return;
          const coords = { lat: pos.lat(), lng: pos.lng() };
          reverseGeocode(coords);
        });
        if (restaurant) {
          new google.maps.Marker({
            position: restaurant,
            map,
            title: "Restaurant",
            icon: restaurantPointerIcon(google),
          });
        }
        setMapsReady(true);
      })
      .catch(() => setMapsReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value || !mapInstance.current || !markerRef.current) return;
    markerRef.current.setPosition(value);
    mapInstance.current.panTo(value);
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (!hasGoogleMapsKey() || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const id = window.setTimeout(() => {
      setSearching(true);
      getPlaceSuggestions(query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  function updatePin(coords: LatLngLiteral, nextAddress?: string, parsed?: ParsedAddress) {
    markerRef.current?.setPosition(coords);
    mapInstance.current?.panTo(coords);
    mapInstance.current?.setZoom(16);
    setManualLat(String(coords.lat));
    setManualLng(String(coords.lng));
    onChange({ coords, address: nextAddress, parsed });
  }

  async function reverseGeocode(coords: LatLngLiteral) {
    try {
      const parsed = await reverseGeocodeAddress(coords);
      if (parsed.formattedAddress) setQuery(parsed.formattedAddress);
      updatePin(coords, parsed.formattedAddress, parsed);
    } catch {
      updatePin(coords);
    }
  }

  async function searchAddress() {
    if (!query.trim()) return toast.error("Enter an address or landmark to search");
    if (!hasGoogleMapsKey())
      return toast.error(
        "Google Maps key is not configured. Enter latitude and longitude manually.",
      );
    setLoading(true);
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: `${query}, Telangana, India` },
        (results: any[], status: string) => {
          setLoading(false);
          if (status !== "OK" || !results?.[0]) return toast.error("Could not find this location");
          const loc = results[0].geometry.location;
          updatePin({ lat: loc.lat(), lng: loc.lng() }, results[0].formatted_address);
        },
      );
    } catch {
      setLoading(false);
      toast.error("Google Maps is not available right now");
    }
  }

  async function selectSuggestion(place: PlaceSuggestion) {
    setLoading(true);
    try {
      const result = await geocodePlace(place.placeId);
      setQuery(result.address.formattedAddress || place.title);
      setSuggestions([]);
      updatePin(result.coords, result.address.formattedAddress, result.address);
    } catch {
      toast.error("Could not open this location");
    } finally {
      setLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation)
      return toast.error("Location permission is not supported on this device");
    setLoading(true);
    toast.info("Please allow location permission to select your delivery address");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        reverseGeocode({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLoading(false);
        toast.error(
          "Location permission was denied. Search your address or enter coordinates manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
  }

  function applyManualCoords() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return toast.error("Enter valid latitude and longitude");
    updatePin({ lat, lng });
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-100 bg-zinc-50">
      <div className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-red-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search area, landmark, apartment..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
          {searching && <span className="text-[11px] font-black text-zinc-400">Searching</span>}
        </label>
        <button
          type="button"
          onClick={searchAddress}
          disabled={loading}
          className="min-h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-black text-white disabled:bg-zinc-300"
        >
          Search map
        </button>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={loading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 text-sm font-black text-white disabled:bg-zinc-300"
        >
          <LocateFixed className="h-4 w-4" /> Use current
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mx-3 mb-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
          {suggestions.map((place) => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => selectSuggestion(place)}
              className="flex w-full items-start gap-3 border-b border-zinc-100 px-3 py-3 text-left last:border-b-0 hover:bg-red-50"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-zinc-900">
                  {place.title}
                </span>
                <span className="block truncate text-xs font-semibold text-zinc-500">
                  {place.subtitle || "Tap to select this location"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {hasGoogleMapsKey() ? (
        <div
          ref={mapRef}
          className={`${compact ? "h-56 md:h-72" : "h-64 md:h-80"} w-full bg-zinc-200`}
        />
      ) : (
        <div className="grid h-52 place-items-center bg-zinc-200 p-5 text-center">
          <div>
            <MapPin className="mx-auto h-8 w-8 text-red-600" />
            <p className="mt-2 text-sm font-bold text-zinc-700">
              Google Maps key is not configured on this build.
            </p>
            <p className="mt-1 text-xs text-zinc-500">Coordinates can still be entered manually.</p>
          </div>
        </div>
      )}

      <div className="grid gap-2 border-t border-zinc-100 p-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={manualLat}
          onChange={(event) => setManualLat(event.target.value)}
          placeholder="Latitude"
          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none"
        />
        <input
          value={manualLng}
          onChange={(event) => setManualLng(event.target.value)}
          placeholder="Longitude"
          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none"
        />
        <button
          type="button"
          onClick={applyManualCoords}
          className="min-h-11 rounded-2xl bg-white px-4 text-sm font-black text-zinc-800 shadow-sm"
        >
          Set pin
        </button>
      </div>

      <div className="border-t border-zinc-100 px-4 py-3 text-xs font-semibold text-zinc-500">
        {value
          ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}${mapsReady ? " - drag the pin to adjust" : ""}`
          : "Select a map location for accurate ETA and delivery tracking."}
      </div>
    </div>
  );
}

function customerPointerIcon(google: any) {
  const svg = encodeURIComponent(`
    <svg width="54" height="66" viewBox="0 0 54 66" fill="none" xmlns="http://www.w3.org/2000/svg">
      <filter id="s" x="0" y="0" width="54" height="66" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#111827" flood-opacity=".35"/>
      </filter>
      <g filter="url(#s)">
        <path d="M27 4C15.4 4 6 13.1 6 24.3c0 15.2 21 35.7 21 35.7s21-20.5 21-35.7C48 13.1 38.6 4 27 4Z" fill="#E11D2E"/>
        <path d="M27 8C17.7 8 10 15.4 10 24.4c0 11.6 13.3 26.7 17 30.6 3.7-3.9 17-19 17-30.6C44 15.4 36.3 8 27 8Z" fill="#FF6A00"/>
        <circle cx="27" cy="25" r="12" fill="white"/>
        <path d="M27 14c2.4 3.4-.8 5.4.8 7.7 1 1.5 3.5.8 4.1-.7 3.9 3.2 4 11.7-4.9 13.7-9-2-8.8-10.5-5-13.7.2 2.2 2.7 2.4 3.8 1 .9-1.2-.4-3.5 1.2-8Z" fill="#111111"/>
        <circle cx="27" cy="25" r="2.6" fill="#E11D2E"/>
      </g>
    </svg>`);
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(44, 54),
    anchor: new google.maps.Point(22, 52),
  };
}

function restaurantPointerIcon(google: any) {
  const svg = encodeURIComponent(`
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="21" r="18" fill="#111827"/>
      <circle cx="21" cy="21" r="13" fill="#E11D2E"/>
      <path d="M15 14h3v14h-3V14Zm5 0h3v14h-3V14Zm7 0h3v14h-3V14Z" fill="white"/>
    </svg>`);
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(34, 34),
    anchor: new google.maps.Point(17, 17),
  };
}
