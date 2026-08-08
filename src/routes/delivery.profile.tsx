import { createFileRoute } from "@tanstack/react-router";
import {
  Bike,
  CircleDot,
  Headphones,
  LocateFixed,
  Phone,
  Star,
} from "lucide-react";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";
import { DarkInfo } from "@/components/delivery/delivery-ui";

export const Route = createFileRoute("/delivery/profile")({
  component: DeliveryProfile,
});

function DeliveryProfile() {
  const portal = useDeliveryPortal();
  const { profile, gpsState, online, lastPosition } = portal;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Driver profile</p>
        <h2 className="mt-2 text-3xl font-black">{profile?.user.name || "Delivery Partner"}</h2>
        <div className="mt-4 grid gap-2">
          <DarkInfo icon={Phone} label="Phone" value={profile?.user.phone || "Not set"} sub="Login phone" />
          <DarkInfo icon={Bike} label="Branch" value={profile?.branch || "Main Branch"} sub="The Ankapure Dhaba" />
          <DarkInfo icon={Star} label="Rating" value={String(profile?.rating ?? 4.8)} sub="Customer rating" />
          <DarkInfo icon={LocateFixed} label="Distance travelled" value={`${profile?.distanceTravelled ?? 0} km`} sub="All time deliveries" />
        </div>
      </div>
      <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Device and safety</p>
        <div className="mt-4 grid gap-2">
          <DarkInfo icon={LocateFixed} label="GPS" value={gpsState.toUpperCase()} sub={online ? "Tracking active when trip is assigned" : "Offline"} />
          <DarkInfo icon={CircleDot} label="Last location" value={lastPosition ? `${lastPosition.lat.toFixed(5)}, ${lastPosition.lng.toFixed(5)}` : "Waiting"} sub={lastPosition?.updatedAt || "No GPS update yet"} />
          <DarkInfo icon={Headphones} label="Support" value="Manager and restaurant" sub="SOS available from active trip" />
        </div>
      </div>
    </div>
  );
}
