/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bike,
  CircleDot,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Star,
} from "lucide-react";
import { listDeliveryFleet, listDeliveryOrders, type FleetRider } from "@/services/api";
import { loadGoogleMaps, type LatLngLiteral } from "@/lib/google-maps";

export const Route = createFileRoute("/admin/delivery")({
  component: AdminDelivery,
});

const RESTAURANT: LatLngLiteral = { lat: 17.562861, lng: 78.453472 };

function AdminDelivery() {
  const { data: fleet = [], isLoading } = useQuery({
    queryKey: ["delivery-fleet"],
    queryFn: listDeliveryFleet,
    refetchInterval: 5000,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["delivery-orders"],
    queryFn: listDeliveryOrders,
    refetchInterval: 5000,
  });

  const online = fleet.filter((rider) => rider.online);
  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const ready = orders.filter((order) => order.status === "ready").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Live fleet</p>
          <h2 className="text-2xl font-black">Rider Directory & Fleet Map</h2>
          <p className="text-sm text-muted-foreground">
            {online.length} online · {fleet.length} riders · {activeOrders} active orders · {ready} ready
          </p>
        </div>
        <div className="flex gap-2">
          <FleetPill tone="green">{online.length} Online</FleetPill>
          <FleetPill tone="slate">{fleet.length - online.length} Offline</FleetPill>
        </div>
      </div>

      <FleetMap fleet={fleet} />

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading fleet...
        </div>
      ) : fleet.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          No delivery riders registered yet. Add staff with the DELIVERY role.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fleet.map((rider) => (
            <RiderCard key={rider.id} rider={rider} />
          ))}
        </div>
      )}
    </div>
  );
}

function FleetMap({ fleet }: { fleet: FleetRider[] }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [live, setLive] = useState(false);
  const [mapsKeyBlocked, setMapsKeyBlocked] = useState(false);

  const visible = fleet.filter((rider) => rider.online && rider.currentLocation);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center: RESTAURANT,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });
          new google.maps.Marker({
            position: RESTAURANT,
            map: mapInstance.current,
            title: "The Ankapur Dhaba",
            icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          });
        }
        const map = mapInstance.current;
        const seen = new Set<string>();
        for (const rider of visible) {
          seen.add(rider.id);
          const position = {
            lat: rider.currentLocation!.lat,
            lng: rider.currentLocation!.lng,
          };
          const existing = markersRef.current.get(rider.id);
          if (existing) {
            existing.setPosition(position);
          } else {
            const marker = new google.maps.Marker({
              position,
              map,
              title: `${rider.name}${rider.activeOrders ? ` (${rider.activeOrders} orders)` : ""}`,
              icon: {
                url: "/delivery-boy-location.png",
                scaledSize: new google.maps.Size(40, 60),
                anchor: new google.maps.Point(20, 56),
              },
              optimized: false,
            });
            marker.addListener("click", () => {
              const info = new google.maps.InfoWindow({
                content: `<div style="font-family:sans-serif;padding:6px 4px;min-width:150px">
                  <strong>${rider.name}</strong><br/>
                  <span style="color:#555;font-size:12px">${rider.phone}</span><br/>
                  <span style="font-size:12px">${rider.activeOrders} active order${rider.activeOrders === 1 ? "" : "s"}</span>
                </div>`,
              });
              info.open(map, marker);
            });
            markersRef.current.set(rider.id, marker);
          }
        }
        for (const [id, marker] of markersRef.current) {
          if (!seen.has(id)) {
            marker.setMap(null);
            markersRef.current.delete(id);
          }
        }
        if (visible.length > 1) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(RESTAURANT);
          visible.forEach((rider) =>
            bounds.extend({ lat: rider.currentLocation!.lat, lng: rider.currentLocation!.lng }),
          );
          map.fitBounds(bounds, 60);
        } else {
          map.setCenter(RESTAURANT);
          map.setZoom(13);
        }
        setLive(true);
      })
      .catch(() => {
        if (!cancelled) setMapsKeyBlocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const src = "https://maps.google.com/maps?q=17.562861,78.453472&z=13&output=embed";

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-white shadow-sm">
      <div className="relative h-80 overflow-hidden md:h-[26rem]">
        {!mapsKeyBlocked ? (
          <div ref={mapRef} className="absolute inset-0 h-full w-full" />
        ) : (
          <iframe
            title="Fleet map"
            src={src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full opacity-70 grayscale-[0.15]"
          />
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-2xl bg-white/92 px-3 py-2 text-sm font-black text-zinc-800 shadow backdrop-blur">
          <MapPin className="h-4 w-4 text-red-600" />
          Ankapur Dhaba
        </div>
        <div className="absolute bottom-3 right-3 rounded-2xl bg-white/92 px-3 py-2 text-xs font-black text-zinc-600 shadow backdrop-blur">
          {live ? `${visible.length} rider${visible.length === 1 ? "" : "s"} on map` : "Live map ready"}
        </div>
      </div>
    </div>
  );
}

function RiderCard({ rider }: { rider: FleetRider }) {
  return (
    <article className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${rider.online ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-500"}`}>
            <Bike className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-black">{rider.name}</p>
            <a href={`tel:${rider.phone}`} className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary">
              <Phone className="h-3 w-3" /> {rider.phone}
            </a>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${rider.online ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-500"}`}>
          {rider.online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <RiderStat icon={Navigation} label="Active" value={String(rider.activeOrders)} />
        <RiderStat icon={CircleDot} label="Load" value={String(rider.load)} />
        <RiderStat icon={Star} label="Stage" value={rider.deliveryStage ? String(rider.deliveryStage).replace(/_/g, " ") : "Idle"} />
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {rider.vehicleNumber && <p>Vehicle: {rider.vehicleNumber}</p>}
        {rider.currentLocation ? (
          <p className="truncate">
            Loc: {rider.currentLocation.lat.toFixed(4)}, {rider.currentLocation.lng.toFixed(4)}
          </p>
        ) : (
          <p>No live location yet.</p>
        )}
        {rider.orderIds.length > 0 && (
          <p className="truncate font-bold text-primary">Orders: {rider.orderIds.join(", ")}</p>
        )}
      </div>
    </article>
  );
}

function RiderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-background p-2">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 truncate text-sm font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}

function FleetPill({ tone, children }: { tone: "green" | "slate"; children: any }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${tone === "green" ? "border-green-200 bg-green-50 text-green-700" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
      {children}
    </span>
  );
}
