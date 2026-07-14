import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { hasGoogleMapsKey, loadGoogleMaps, type LatLngLiteral } from "@/lib/google-maps";

type LocationPickerProps = {
  value: LatLngLiteral | null;
  address: string;
  restaurant?: LatLngLiteral;
  onChange: (next: { coords: LatLngLiteral; address?: string }) => void;
};

const DEFAULT_CENTER = { lat: 18.7283, lng: 78.4477 };

export function LocationPicker({ value, address, restaurant, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [manualLat, setManualLat] = useState(value?.lat ? String(value.lat) : "");
  const [manualLng, setManualLng] = useState(value?.lng ? String(value.lng) : "");

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
            icon: { url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" },
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

  function updatePin(coords: LatLngLiteral, nextAddress?: string) {
    markerRef.current?.setPosition(coords);
    mapInstance.current?.panTo(coords);
    mapInstance.current?.setZoom(16);
    setManualLat(String(coords.lat));
    setManualLng(String(coords.lng));
    onChange({ coords, address: nextAddress });
  }

  async function reverseGeocode(coords: LatLngLiteral) {
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: coords }, (results: any[], status: string) => {
        const nextAddress = status === "OK" && results?.[0]?.formatted_address ? results[0].formatted_address : undefined;
        if (nextAddress) setQuery(nextAddress);
        updatePin(coords, nextAddress);
      });
    } catch {
      updatePin(coords);
    }
  }

  async function searchAddress() {
    if (!query.trim()) return toast.error("Enter an address or landmark to search");
    if (!hasGoogleMapsKey()) return toast.error("Google Maps key is not configured. Enter latitude and longitude manually.");
    setLoading(true);
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: `${query}, Telangana, India` }, (results: any[], status: string) => {
        setLoading(false);
        if (status !== "OK" || !results?.[0]) return toast.error("Could not find this location");
        const loc = results[0].geometry.location;
        updatePin({ lat: loc.lat(), lng: loc.lng() }, results[0].formatted_address);
      });
    } catch {
      setLoading(false);
      toast.error("Google Maps is not available right now");
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error("Location permission is not supported on this device");
    setLoading(true);
    toast.info("Please allow location permission to select your delivery address");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        reverseGeocode({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLoading(false);
        toast.error("Location permission was denied. Search your address or enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );
  }

  function applyManualCoords() {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return toast.error("Enter valid latitude and longitude");
    updatePin({ lat, lng });
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-zinc-100 bg-zinc-50">
      <div className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto]">
        <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-red-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search area, landmark, apartment..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </label>
        <button type="button" onClick={searchAddress} disabled={loading} className="min-h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-black text-white disabled:bg-zinc-300">
          Search map
        </button>
        <button type="button" onClick={useCurrentLocation} disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 text-sm font-black text-white disabled:bg-zinc-300">
          <LocateFixed className="h-4 w-4" /> Use current
        </button>
      </div>

      {hasGoogleMapsKey() ? (
        <div ref={mapRef} className="h-64 w-full bg-zinc-200 md:h-80" />
      ) : (
        <div className="grid h-52 place-items-center bg-zinc-200 p-5 text-center">
          <div>
            <MapPin className="mx-auto h-8 w-8 text-red-600" />
            <p className="mt-2 text-sm font-bold text-zinc-700">Google Maps key is not configured on this build.</p>
            <p className="mt-1 text-xs text-zinc-500">Coordinates can still be entered manually.</p>
          </div>
        </div>
      )}

      <div className="grid gap-2 border-t border-zinc-100 p-3 md:grid-cols-[1fr_1fr_auto]">
        <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="Latitude" className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none" />
        <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} placeholder="Longitude" className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none" />
        <button type="button" onClick={applyManualCoords} className="min-h-11 rounded-2xl bg-white px-4 text-sm font-black text-zinc-800 shadow-sm">Set pin</button>
      </div>

      <div className="border-t border-zinc-100 px-4 py-3 text-xs font-semibold text-zinc-500">
        {value ? `Selected: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}${mapsReady ? " - drag the pin to adjust" : ""}` : "Select a map location for accurate ETA and delivery tracking."}
      </div>
    </div>
  );
}
