import { Bike, Clock3, Home, MapPin, Navigation } from "lucide-react";
import type { Order } from "@/services/api";
import { calculateDrivingRoute, googleMapsDirectionsUrl as buildDirectionsUrl, hasGoogleMapsKey, loadGoogleMaps, type LatLngLiteral } from "@/lib/google-maps";
import { useEffect, useRef, useState } from "react";

export function DeliveryMap({ order, compact = false, premium = false }: { order: Order; compact?: boolean; premium?: boolean }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const riderMarker = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const [mapsLive, setMapsLive] = useState(false);
  const [routeEta, setRouteEta] = useState<{ distanceKm?: number; etaMinutes?: number }>({});
  const location = order.delivery?.currentLocation;
  const restaurantCoords = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  const destinationCoords = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  const destination = order.customer.address || order.delivery?.destinationText || "Customer destination";
  const query = location ? `${location.lat},${location.lng}` : `${destination}, India`;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${location ? 16 : 13}&output=embed`;
  const progress = Math.max(0, Math.min(1, order.delivery?.routeProgress ?? progressFromStatus(order.status)));
  const riderLeft = 16 + progress * 68;
  const riderTop = 64 - progress * 32;
  const riderCoords = location ? { lat: location.lat, lng: location.lng } : null;
  const routeOrigin = riderCoords || restaurantCoords;
  const routeDestination = destinationCoords;
  const canUseGoogleMap = hasGoogleMapsKey() && Boolean(routeOrigin && routeDestination);

  useEffect(() => {
    if (!canUseGoogleMap || !mapRef.current || !routeOrigin || !routeDestination) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        const map = mapInstance.current || new google.maps.Map(mapRef.current, {
          center: riderCoords || restaurantCoords || routeDestination || { lat: 18.7283, lng: 78.4477 },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        mapInstance.current = map;

        if (!directionsRenderer.current) {
          directionsRenderer.current = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: { strokeColor: "#16A34A", strokeWeight: 6, strokeOpacity: 0.9 },
          });
        }

        if (restaurantCoords) new google.maps.Marker({ position: restaurantCoords, map, title: "Restaurant", icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" });
        new google.maps.Marker({ position: routeDestination, map, title: "Customer", icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" });
        if (riderCoords) {
          if (!riderMarker.current) {
            riderMarker.current = new google.maps.Marker({ position: riderCoords, map, title: "Delivery partner", icon: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" });
          } else {
            riderMarker.current.setPosition(riderCoords);
          }
        }

        calculateDrivingRoute(routeOrigin!, routeDestination!)
          .then((route) => {
            if (cancelled) return;
            setRouteEta({ distanceKm: route.distanceKm, etaMinutes: route.etaMinutes });
            if (route.result) directionsRenderer.current?.setDirections(route.result);
            setMapsLive(true);
          })
          .catch(() => setMapsLive(false));
      })
      .catch(() => setMapsLive(false));
    return () => {
      cancelled = true;
    };
  }, [canUseGoogleMap, routeOrigin?.lat, routeOrigin?.lng, routeDestination?.lat, routeDestination?.lng, riderCoords?.lat, riderCoords?.lng]);

  return (
    <div className={`min-w-0 overflow-hidden rounded-[24px] border sm:rounded-[28px] ${premium ? "border-zinc-200 bg-white shadow-sm" : "border-border bg-background"}`}>
      <div className={`relative ${compact ? "h-44" : "h-72 sm:h-[22rem] md:h-96"} overflow-hidden`}>
        {canUseGoogleMap ? (
          <div ref={mapRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <>
            <iframe
              title={`Google map for order ${order.id}`}
              src={src}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full opacity-70 grayscale-[0.15]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M16 66 C 35 40, 56 84, 84 32" fill="none" stroke="rgba(203,213,225,0.9)" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 5" />
              <path d="M16 66 C 35 40, 56 84, 84 32" fill="none" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" pathLength="1" strokeDasharray={`${progress} ${1 - progress}`} />
            </svg>
            <Marker left={16} top={66} tone="bg-red-600 text-white" icon={MapPin} label="Restaurant" />
            <Marker left={84} top={32} tone="bg-zinc-950 text-white" icon={Home} label="You" />
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
              style={{ left: `${riderLeft}%`, top: `${riderTop}%` }}
            >
              <div className="absolute inset-0 animate-ping rounded-full bg-green-500/40" />
              <div className="relative grid h-12 w-12 place-items-center rounded-full bg-green-500 text-black shadow-xl shadow-green-500/30 md:h-13 md:w-13">
                <Bike className="h-6 w-6" />
              </div>
            </div>
          </>
        )}
        {canUseGoogleMap && riderCoords ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-500/35" />
          </div>
        ) : null}
        <div className="absolute left-3 right-3 top-3 grid grid-cols-2 gap-2 md:left-4 md:right-4">
          <MapPill icon={Clock3} label="ETA" value={routeEta.etaMinutes ? `${routeEta.etaMinutes} min` : order.delivery?.etaMinutes ? `${order.delivery.etaMinutes} min` : "Updating"} />
          <MapPill icon={Navigation} label="Distance" value={routeEta.distanceKm ? `${routeEta.distanceKm} km` : order.delivery?.distanceKm ? `${order.delivery.distanceKm} km` : `${Math.round(progress * 100)}%`} />
        </div>
        <div className="absolute bottom-3 left-3 right-3 rounded-3xl bg-white/92 p-3 shadow-lg backdrop-blur md:bottom-4 md:left-4 md:right-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Live tracking</div>
              <div className="truncate font-black text-zinc-950">{mapsLive ? "Google route live" : location ? "Rider location updating" : "Waiting for rider location"}</div>
            </div>
            <span className={`shrink-0 rounded-2xl px-3 py-2 text-sm font-black ${location ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>{location ? "LIVE" : "WAITING"}</span>
          </div>
        </div>
      </div>
      <div className={`grid min-w-0 gap-2 border-t px-4 py-3 text-xs md:grid-cols-2 ${premium ? "border-zinc-100 text-zinc-500" : "border-border text-muted-foreground"}`}>
        {location ? (
          <span className="min-w-0 break-words">
            Rider: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            {order.delivery?.gpsAccuracy ? ` - ${Math.round(order.delivery.gpsAccuracy)}m accuracy` : ""}
          </span>
        ) : (
          <span className="min-w-0 break-words">Map switches to live rider GPS after pickup.</span>
        )}
        <span className="min-w-0 break-words md:text-right">
          {location ? `Updated ${new Date(order.delivery?.lastLocationAt || location.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : `Destination: ${destination}`}
        </span>
      </div>
    </div>
  );
}

function Marker({ left, top, tone, icon: Icon, label }: { left: number; top: number; tone: string; icon: React.ElementType; label: string }) {
  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
      <div className={`grid h-10 w-10 place-items-center rounded-full shadow-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-zinc-700 shadow">{label}</div>
    </div>
  );
}

function MapPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow backdrop-blur">
      <Icon className="h-4 w-4 text-green-600" />
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div>
        <div className="text-sm font-black text-zinc-950">{value}</div>
      </div>
    </div>
  );
}

function progressFromStatus(status: Order["status"]) {
  if (status === "delivered") return 1;
  if (status === "out_for_delivery") return 0.55;
  if (status === "ready") return 0.3;
  if (status === "preparing") return 0.2;
  if (status === "accepted") return 0.12;
  return 0.05;
}

export function googleMapsDirectionsUrl(order: Order) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng) || order.customer.address || order.delivery?.destinationText || "Ankapur Dhaba, Telangana";
  const origin = order.delivery?.currentLocation ? { lat: order.delivery.currentLocation.lat, lng: order.delivery.currentLocation.lng } : coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  return buildDirectionsUrl({ origin: origin || undefined, destination });
}

export function googleMapsRestaurantDirectionsUrl(order: Order) {
  const restaurant = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng) || "Ankapur Dhaba, Telangana";
  const origin = order.delivery?.currentLocation ? { lat: order.delivery.currentLocation.lat, lng: order.delivery.currentLocation.lng } : undefined;
  return buildDirectionsUrl({ origin, destination: restaurant });
}

function coordsFrom(lat?: number, lng?: number): LatLngLiteral | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}
