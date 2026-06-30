import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Gift, Headphones, LogOut, MapPin, ShieldCheck, Star, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { getCustomerLoyalty, getCustomerProfile, getCustomerWallet, updateCustomerProfile } from "@/services/api";
import { useAuth } from "@/stores/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - Ankapur Dhaba" }] }),
  component: ProfilePage,
});

const preferenceGroups = {
  cuisine: ["Telangana", "Andhra", "North Indian", "Chinese", "Tandoori", "Fast Food"],
  diet: ["Veg", "Non Veg", "Egg", "Vegan", "Jain"],
  spice: ["Mild", "Medium", "Hot", "Extra Hot"],
  protein: ["Chicken", "Mutton", "Fish", "Paneer"],
  mealTime: ["Breakfast", "Lunch", "Dinner", "Late Night"],
  orderType: ["Delivery", "Pickup", "Dine-In"],
  language: ["English", "Telugu", "Hindi"],
};

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAuthenticated, logout } = useAuth();
  const { data: profileData } = useQuery({ queryKey: ["customer-profile"], queryFn: getCustomerProfile, enabled: isAuthenticated() });
  const { data: loyalty } = useQuery({ queryKey: ["customer-loyalty"], queryFn: getCustomerLoyalty, enabled: isAuthenticated() });
  const { data: wallet } = useQuery({ queryKey: ["customer-wallet"], queryFn: getCustomerWallet, enabled: isAuthenticated() });
  const saveProfile = useMutation({ mutationFn: updateCustomerProfile, onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-profile"] }); toast.success("Preferences saved"); } });

  if (!isAuthenticated() || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <User className="mx-auto h-12 w-12 text-zinc-400" />
        <h1 className="mt-4 text-3xl font-black">Sign in to your profile</h1>
        <p className="mt-2 text-zinc-500">View orders, rewards, favorites, addresses and preferences.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white">Sign in</Link>
      </div>
    );
  }

  const profile = profileData?.profile;
  const preferences = profile?.preferences || {};

  function togglePreference(group: string, value: string) {
    const current = new Set<string>(preferences[group] || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    saveProfile.mutate({ preferences: { ...preferences, [group]: Array.from(current) } });
  }

  function signOut() {
    logout();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-8">
      <section className="rounded-[32px] bg-gradient-to-br from-red-600 to-red-800 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-white/15 text-3xl font-black">{user.name.charAt(0)}</div>
          <div>
            <h1 className="text-3xl font-black">{user.name}</h1>
            <p className="text-white/75">{user.phone}</p>
            <div className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase">{loyalty?.tier || "bronze"} member</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Points" value={String(loyalty?.points ?? 0)} />
          <Stat label="Orders" value={String(loyalty?.orderCount ?? 0)} />
          <Stat label="Spend" value={`₹${loyalty?.lifetimeSpend ?? 0}`} />
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <QuickLink to="/orders" icon={Star} title="Orders" />
        <QuickLink to="/favorites" icon={Gift} title="Favorites" />
        <QuickLink to="/checkout" icon={MapPin} title="Addresses" />
        <QuickLink to="/orders" icon={Headphones} title="Support" />
      </section>

      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-xl font-black">Wallet</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <WalletCard label="Refund balance" value={wallet?.refund ?? 0} />
          <WalletCard label="Gift balance" value={wallet?.gift ?? 0} />
          <WalletCard label="Loyalty credits" value={wallet?.loyalty ?? 0} />
        </div>
      </section>

      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-xl font-black">Food preferences</h2>
        <div className="mt-4 space-y-5">
          {Object.entries(preferenceGroups).map(([group, values]) => (
            <div key={group}>
              <div className="mb-2 text-sm font-black capitalize">{group.replace(/([A-Z])/g, " $1")}</div>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const active = Boolean(preferences[group]?.includes(value));
                  return <button key={value} onClick={() => togglePreference(group, value)} className={`rounded-2xl px-4 py-2 text-sm font-black ${active ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600"}`}>{value}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        <InfoPanel icon={Bell} title="Notifications" text="Offers, order updates, coupons and announcements are enabled." />
        <InfoPanel icon={ShieldCheck} title="Referral" text={`Share code ${profile?.referralCode || "ADFOOD"} to invite friends.`} />
      </section>

      <button onClick={signOut} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-zinc-950 font-black text-white"><LogOut className="h-5 w-5" /> Sign out</button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-white/15 p-4"><div className="text-xs text-white/65">{label}</div><div className="text-xl font-black">{value}</div></div>;
}

function QuickLink({ to, icon: Icon, title }: { to: string; icon: React.ElementType; title: string }) {
  return <Link to={to as never} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100"><Icon className="h-6 w-6 text-red-600" /><div className="mt-3 font-black">{title}</div></Link>;
}

function WalletCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl bg-zinc-50 p-4"><Wallet className="h-5 w-5 text-green-600" /><div className="mt-2 text-sm text-zinc-500">{label}</div><div className="text-2xl font-black">₹{value}</div></div>;
}

function InfoPanel({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100"><Icon className="h-6 w-6 text-red-600" /><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm text-zinc-500">{text}</p></div>;
}
