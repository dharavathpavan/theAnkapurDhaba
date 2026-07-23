/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Compass, Crosshair, Layers, LocateFixed, MapPin, Search } from "lucide-react";
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
const PICKER_MIN_ZOOM = 18;
const PICKER_MAX_ZOOM = 21;

export function LocationPicker({
  value,
  address,
  restaurant,
  compact = false,
  onChange,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const restaurantMarkerRef = useRef<any>(null);
  const idleTimer = useRef<number | null>(null);
  const latestCenter = useRef<LatLngLiteral | null>(value || restaurant || DEFAULT_CENTER);
  const ignoreNextIdle = useRef(false);
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [manualLat, setManualLat] = useState(value?.lat ? String(value.lat) : "");
  const [manualLng, setManualLng] = useState(value?.lng ? String(value.lng) : "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [pinAddress, setPinAddress] = useState(address);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [moving, setMoving] = useState(false);

  useEffect(() => setQuery(address), [address]);
  useEffect(() => setPinAddress(address), [address]);
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
          zoom: value ? PICKER_MAX_ZOOM - 1 : PICKER_MIN_ZOOM,
          minZoom: PICKER_MIN_ZOOM,
          maxZoom: PICKER_MAX_ZOOM,
          disableDefaultUI: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: true,
          clickableIcons: false,
          draggable: false,
          keyboardShortcuts: false,
          gestureHandling: "cooperative",
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapInstance.current = map;
        if (restaurant) {
          restaurantMarkerRef.current = new google.maps.Marker({
            position: restaurant,
            map,
            title: "The Ankapure Dhaba",
            icon: restaurantPointerIcon(google),
          });
        }
        map.addListener("zoom_changed", () => setMoving(true));
        map.addListener("center_changed", () => {
          const centerNow = map.getCenter();
          if (!centerNow) return;
          latestCenter.current = { lat: centerNow.lat(), lng: centerNow.lng() };
        });
        map.addListener("idle", () => {
          setMoving(false);
          if (ignoreNextIdle.current) {
            ignoreNextIdle.current = false;
            return;
          }
          const centerNow = map.getCenter();
          if (!centerNow) return;
          const coords = { lat: centerNow.lat(), lng: centerNow.lng() };
          latestCenter.current = coords;
          if (idleTimer.current) window.clearTimeout(idleTimer.current);
          idleTimer.current = window.setTimeout(() => reverseGeocode(coords, true), 450);
        });
        setMapsReady(true);
      })
      .catch(() => setMapsReady(false));
    return () => {
      cancelled = true;
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!value || !mapInstance.current) return;
    ignoreNextIdle.current = true;
    latestCenter.current = value;
    mapInstance.current.panTo(value);
    mapInstance.current.setZoom(PICKER_MAX_ZOOM - 1);
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

  function emitLocation(coords: LatLngLiteral, nextAddress?: string, parsed?: ParsedAddress) {
    setManualLat(String(coords.lat));
    setManualLng(String(coords.lng));
    if (nextAddress) setPinAddress(nextAddress);
    onChange({ coords, address: nextAddress, parsed });
  }

  async function reverseGeocode(coords: LatLngLiteral, quiet = false) {
    try {
      if (!quiet) setLoading(true);
      const parsed = await reverseGeocodeAddress(coords);
      const resolved =
        parsed.formattedAddress || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      setQuery(resolved);
      emitLocation(coords, resolved, parsed);
    } catch {
      emitLocation(coords);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  function moveMapTo(coords: LatLngLiteral, zoom = PICKER_MAX_ZOOM - 1) {
    latestCenter.current = coords;
    ignoreNextIdle.current = true;
    mapInstance.current?.panTo(coords);
    mapInstance.current?.setZoom(zoom);
  }

  async function searchAddress() {
    if (!query.trim()) return toast.error("Enter an area, street, apartment or landmark");
    if (!hasGoogleMapsKey())
      return toast.error(
        "Google Maps key is not configured. Enter latitude and longitude manually.",
      );
    setLoading(true);
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: `${query}, Hyderabad, Telangana, India` },
        (results: any[] | null, status: string) => {
          setLoading(false);
          if (status !== "OK" || !results?.[0]) return toast.error("Could not find this location");
          const loc = results[0].geometry.location;
          const coords = { lat: loc.lat(), lng: loc.lng() };
          const parsed = parseFromGeocoderResult(results[0]);
          moveMapTo(coords);
          setSuggestions([]);
          emitLocation(coords, parsed.formattedAddress, parsed);
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
      moveMapTo(result.coords);
      emitLocation(result.coords, result.address.formattedAddress, result.address);
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
    toast.info("Please allow location permission to detect your delivery address");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        moveMapTo(coords);
        reverseGeocode(coords);
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
    const coords = { lat, lng };
    moveMapTo(coords);
    reverseGeocode(coords);
  }

  function toggleMapType() {
    const next = mapType === "roadmap" ? "satellite" : "roadmap";
    setMapType(next);
    mapInstance.current?.setMapTypeId(next);
  }

  const selectedLabel =
    pinAddress || address || (value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "");

  return (
    <div className="overflow-hidden rounded-[30px] border border-zinc-100 bg-zinc-50 shadow-sm">
      <div className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative flex min-h-12 items-center gap-2 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-zinc-100 focus-within:ring-2 focus-within:ring-red-500/25">
          <Search className="h-4 w-4 shrink-0 text-red-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                searchAddress();
              }
            }}
            placeholder="Search for area, street or apartment"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-zinc-400"
            aria-label="Search delivery location"
          />
          {searching && <span className="text-[11px] font-black text-zinc-400">Searching</span>}
        </label>
        <button
          type="button"
          onClick={searchAddress}
          disabled={loading}
          className="min-h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-black text-white disabled:bg-zinc-300"
        >
          Search
        </button>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={loading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 text-sm font-black text-white disabled:bg-zinc-300"
        >
          <LocateFixed className="h-4 w-4" /> Current
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mx-3 mb-3 overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-zinc-100">
          {suggestions.map((place) => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => selectSuggestion(place)}
              className="flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3.5 text-left last:border-b-0 hover:bg-red-50"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-zinc-950">
                  {place.title}
                </span>
                <span className="block truncate text-xs font-semibold text-zinc-500">
                  {place.subtitle || "Tap to open on map"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {hasGoogleMapsKey() ? (
        <div className="relative">
          <div
            ref={mapRef}
            className={`${compact ? "h-[360px] md:h-[430px]" : "h-[70vh] min-h-[430px]"} w-full bg-zinc-200`}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <CenterPin moving={moving || loading} />
          </div>
          <div className="absolute right-3 top-3 grid gap-2">
            <MapButton label="Use current location" onClick={useCurrentLocation} disabled={loading}>
              <Crosshair className="h-4 w-4" />
            </MapButton>
            <MapButton label="Toggle map type" onClick={toggleMapType}>
              <Layers className="h-4 w-4" />
            </MapButton>
          </div>
          <div className="absolute left-3 top-3 rounded-2xl bg-white/92 px-3 py-2 text-xs font-black text-zinc-800 shadow-lg backdrop-blur">
            <span className="inline-flex items-center gap-1">
              <Compass className="h-3.5 w-3.5 text-red-600" />
              Fixed pin - zoom 200 ft to 20 ft
            </span>
          </div>
        </div>
      ) : (
        <div className="grid h-64 place-items-center bg-zinc-200 p-5 text-center">
          <div>
            <MapPin className="mx-auto h-8 w-8 text-red-600" />
            <p className="mt-2 text-sm font-bold text-zinc-700">
              Google Maps key is not configured on this build.
            </p>
            <p className="mt-1 text-xs text-zinc-500">Coordinates can still be entered manually.</p>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-100 bg-white px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">
          Pinned location
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-bold text-zinc-800">
          {selectedLabel || "Select a map location for accurate ETA and delivery tracking."}
        </p>
        {value && (
          <p className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black text-zinc-500">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </p>
        )}
      </div>

      <div className="grid gap-2 border-t border-zinc-100 p-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={manualLat}
          onChange={(event) => setManualLat(event.target.value)}
          placeholder="Latitude"
          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none ring-1 ring-zinc-100"
        />
        <input
          value={manualLng}
          onChange={(event) => setManualLng(event.target.value)}
          placeholder="Longitude"
          className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold outline-none ring-1 ring-zinc-100"
        />
        <button
          type="button"
          onClick={applyManualCoords}
          className="min-h-11 rounded-2xl bg-white px-4 text-sm font-black text-zinc-800 shadow-sm ring-1 ring-zinc-100"
        >
          Set pin
        </button>
      </div>
      {!mapsReady && hasGoogleMapsKey() && (
        <div className="border-t border-zinc-100 px-4 py-3 text-xs font-bold text-zinc-500">
          Loading Google Maps...
        </div>
      )}
    </div>
  );
}

function MapButton({
  label,
  disabled,
  children,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-zinc-900 shadow-xl ring-1 ring-zinc-200 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function CenterPin({ moving }: { moving: boolean }) {
  return (
    <div
      className={`relative -mt-8 transition-transform duration-200 ${moving ? "-translate-y-2 scale-105" : ""}`}
    >
      <div className="absolute left-1/2 top-[47px] h-3 w-9 -translate-x-1/2 rounded-full bg-zinc-950/25 blur-sm" />
      <img
        src="/location-picker-pin.png"
        alt=""
        aria-hidden="true"
        className="h-[62px] w-[62px] object-contain drop-shadow-2xl"
        draggable={false}
      />
    </div>
  );
}

function restaurantPointerIcon(google: any) {
  return {
    url: "/restaurant-location.png",
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 42),
  };
}

function parseFromGeocoderResult(result: any): ParsedAddress {
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
