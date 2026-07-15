import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Gift,
  Headphones,
  Heart,
  Home,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Upload,
  User,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerLoyalty,
  getCustomerProfile,
  getCustomerWallet,
  listCustomerAddresses,
  listCustomerCoupons,
  listCustomerFavorites,
  listCustomerNotifications,
  listMyOrders,
  listSupportTickets,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  updateCustomerAddress,
  updateCustomerProfile,
  uploadSupportFile,
  type CustomerAddress,
} from "@/services/api";
import { useAuth } from "@/stores/auth";
import { useActiveOrderTracking } from "@/stores/active-order";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - The Ankapure Dhaba" }] }),
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

type AddressDraft = Omit<CustomerAddress, "id">;

const blankAddress: AddressDraft = {
  label: "Home",
  name: "",
  phone: "",
  address: "",
  landmark: "",
  notes: "",
  lat: null,
  lng: null,
  isDefault: false,
};

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAuthenticated, logout } = useAuth();
  const authed = isAuthenticated();
  const { order: activeOrder } = useActiveOrderTracking();

  const [editOpen, setEditOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(blankAddress);
  const [photoUrl, setPhotoUrl] = useState("");
  const [notificationSettings, setNotificationSettings] = useState<Record<string, boolean>>({
    offers: true,
    orders: true,
    coupons: true,
    announcements: true,
    support: true,
  });

  const profileQuery = useQuery({ queryKey: ["customer-profile"], queryFn: getCustomerProfile, enabled: authed });
  const loyaltyQuery = useQuery({ queryKey: ["customer-loyalty"], queryFn: getCustomerLoyalty, enabled: authed });
  const walletQuery = useQuery({ queryKey: ["customer-wallet"], queryFn: getCustomerWallet, enabled: authed });
  const addressQuery = useQuery({ queryKey: ["customer-addresses"], queryFn: listCustomerAddresses, enabled: authed });
  const ordersQuery = useQuery({ queryKey: ["my-orders"], queryFn: listMyOrders, enabled: authed, refetchInterval: 8000 });
  const ticketQuery = useQuery({ queryKey: ["support-tickets"], queryFn: listSupportTickets, enabled: authed });
  const notificationQuery = useQuery({ queryKey: ["customer-notifications"], queryFn: listCustomerNotifications, enabled: authed });
  const favoriteQuery = useQuery({ queryKey: ["customer-favorites"], queryFn: listCustomerFavorites, enabled: authed });
  const couponQuery = useQuery({ queryKey: ["customer-coupons", user?.phone], queryFn: () => listCustomerCoupons(user?.phone), enabled: authed });

  const profileData = profileQuery.data;
  const profileUser = profileData?.user ?? user;
  const profile = profileData?.profile ?? {};
  const preferences = profile?.preferences || {};
  const addresses = addressQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const wallet = walletQuery.data;
  const loyalty = loyaltyQuery.data;
  const tickets = ticketQuery.data ?? [];
  const notifications = notificationQuery.data ?? [];
  const unreadNotifications = notifications.filter((notice) => !notice.read);
  const currentOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const recentOrders = orders.slice(0, 3);
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0];

  useEffect(() => {
    if (!profile) return;
    setPhotoUrl(profile.photo || "");
    setNotificationSettings({
      offers: true,
      orders: true,
      coupons: true,
      announcements: true,
      support: true,
      ...(profile.notificationSettings || {}),
    });
  }, [profile?.photo, JSON.stringify(profile?.notificationSettings || {})]);

  const saveProfile = useMutation({
    mutationFn: updateCustomerProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
      toast.success("Profile updated");
      setEditOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update profile"),
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      const payload = { ...addressDraft, isDefault: addressDraft.isDefault || addresses.length === 0 };
      if (editingAddressId) return updateCustomerAddress(editingAddressId, payload);
      return createCustomerAddress(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast.success(editingAddressId ? "Address updated" : "Address saved");
      closeAddressEditor();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save address"),
  });

  const removeAddress = useMutation({
    mutationFn: deleteCustomerAddress,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-addresses"] });
      toast.success("Address removed");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete address"),
  });

  const readNotification = useMutation({
    mutationFn: markCustomerNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-notifications"] }),
  });

  const readAllNotifications = useMutation({
    mutationFn: markAllCustomerNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-notifications"] });
      toast.success("Notifications cleared");
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: uploadSupportFile,
    onSuccess: (file) => {
      setPhotoUrl(file.url);
      toast.success("Photo attached");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Photo upload failed"),
  });

  const summary = useMemo(() => [
    { label: "Orders", value: loyalty?.orderCount ?? orders.length, icon: Package },
    { label: "Points", value: loyalty?.points ?? 0, icon: Star },
    { label: "Wallet", value: `Rs ${Math.round(wallet?.balance ?? 0)}`, icon: Wallet },
  ], [loyalty?.orderCount, loyalty?.points, orders.length, wallet?.balance]);

  if (!authed || !user) {
    return <SignedOutProfile />;
  }

  function openAddressEditor(address?: CustomerAddress) {
    if (address) {
      setEditingAddressId(address.id);
      setAddressDraft({
        label: address.label || "Home",
        name: address.name || profileUser?.name || "",
        phone: address.phone || profileUser?.phone || "",
        address: address.address || "",
        landmark: address.landmark || "",
        notes: address.notes || "",
        lat: address.lat ?? null,
        lng: address.lng ?? null,
        isDefault: Boolean(address.isDefault),
      });
    } else {
      setEditingAddressId(null);
      setAddressDraft({ ...blankAddress, name: profileUser?.name || "", phone: profileUser?.phone || "", isDefault: addresses.length === 0 });
    }
    setAddressOpen(true);
  }

  function closeAddressEditor() {
    setAddressOpen(false);
    setEditingAddressId(null);
    setAddressDraft(blankAddress);
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveProfile.mutate({
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim() || null,
      dateOfBirth: String(data.get("dateOfBirth") || "") || null,
      anniversary: String(data.get("anniversary") || "") || null,
      photo: photoUrl || null,
      notificationSettings,
    });
  }

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
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-4 md:px-6 md:py-8">
      <section className="overflow-hidden rounded-[26px] bg-zinc-950 text-white shadow-2xl shadow-zinc-950/20 md:rounded-[34px]">
        <div className="relative p-4 md:p-7">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-red-600/25 blur-3xl md:h-44 md:w-44" />
          <div className="relative flex flex-col gap-3 md:gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-white/10 text-xl font-black ring-1 ring-white/15 md:h-20 md:w-20 md:rounded-[28px] md:text-3xl">
                {photoUrl ? <img src={photoUrl} alt={profileUser?.name || "Profile"} className="h-full w-full object-cover" /> : profileUser?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200 md:text-xs md:tracking-[0.22em]">My Account</div>
                <h1 className="mt-0.5 truncate text-xl font-black leading-tight md:mt-1 md:text-5xl">{profileUser?.name}</h1>
                <p className="mt-0.5 text-xs font-semibold text-white/65 md:mt-1 md:text-sm">{profileUser?.phone}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
                  <Badge>{loyalty?.tier || "Bronze"} member</Badge>
                  <Badge>{defaultAddress ? defaultAddress.label : "No address saved"}</Badge>
                </div>
              </div>
            </div>
            <button onClick={() => setEditOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-zinc-950 md:min-h-12 md:px-5 md:text-sm">
              <Pencil className="h-4 w-4" /> Edit Profile
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2 md:mt-6 md:gap-3">
            {summary.map((item) => <HeroStat key={item.label} {...item} />)}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-8 md:gap-3">
        <QuickAction to="/orders" icon={Package} label="Orders" tone="red" />
        <QuickAction to="/wallet" icon={Wallet} label="Wallet" tone="green" />
        <QuickAction onClick={() => openAddressEditor()} icon={MapPin} label="Address" tone="blue" />
        <QuickAction to="/support" icon={Headphones} label="Support" tone="dark" />
        <QuickAction to="/favorites" icon={Heart} label="Favorites" tone="pink" />
        <QuickAction to="/cart" icon={Ticket} label="Coupons" tone="yellow" />
        <QuickAction onClick={() => readAllNotifications.mutate()} icon={Bell} label="Alerts" tone="purple" />
        <QuickAction to="/privacy-policy" icon={ShieldCheck} label="Legal" tone="slate" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <main className="space-y-5">
          {activeOrder && (
            <Link to="/orders/$orderId" params={{ orderId: activeOrder.id }} className="block rounded-[30px] bg-gradient-to-br from-red-600 to-red-800 p-5 text-white shadow-xl shadow-red-600/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/65">Active live order</p>
                  <h2 className="mt-1 text-2xl font-black">#{activeOrder.id}</h2>
                  <p className="mt-1 text-sm font-semibold capitalize text-white/75">{activeOrder.status.replace(/_/g, " ")}</p>
                </div>
                <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-red-700">Track</span>
              </div>
            </Link>
          )}

          <Panel title="Recent orders" action={<Link to="/orders" className="text-sm font-black text-red-600">View all</Link>} loading={ordersQuery.isLoading}>
            {recentOrders.length === 0 ? <EmptyState icon={Package} title="No orders yet" text="Your food journey starts from the menu." action={<Link to="/menu" className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white">Order now</Link>} /> : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link key={order.id} to="/orders/$orderId" params={{ orderId: order.id }} className="flex items-center justify-between gap-3 rounded-3xl bg-zinc-50 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-black">#{order.id}</span>
                      <span className="mt-1 block truncate text-sm font-semibold text-zinc-500">{order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-black">Rs {order.total}</span>
                      <span className="text-xs font-black capitalize text-zinc-400">{order.status.replace(/_/g, " ")}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Saved addresses" action={<button onClick={() => openAddressEditor()} className="inline-flex items-center gap-1 text-sm font-black text-red-600"><Plus className="h-4 w-4" /> Add</button>} loading={addressQuery.isLoading}>
            {addresses.length === 0 ? <EmptyState icon={MapPin} title="No address saved" text="Add your delivery address for faster checkout." /> : (
              <div className="grid gap-3 md:grid-cols-2">
                {addresses.map((address) => (
                  <article key={address.id} className="rounded-3xl bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-black">
                          <Home className="h-4 w-4 text-red-600" /> {address.label}
                          {address.isDefault && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">Default</span>}
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-5 text-zinc-600">{address.address}</p>
                        {address.landmark && <p className="mt-1 text-xs font-bold text-zinc-400">Landmark: {address.landmark}</p>}
                      </div>
                      <button onClick={() => openAddressEditor(address)} className="rounded-2xl bg-white p-2 text-zinc-600 ring-1 ring-zinc-200"><Pencil className="h-4 w-4" /></button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Food preferences" action={<span className="text-xs font-black text-zinc-400">{saveProfile.isPending ? "Saving..." : "Tap to update"}</span>}>
            <div className="space-y-4">
              {Object.entries(preferenceGroups).map(([group, values]) => (
                <div key={group}>
                  <div className="mb-2 text-sm font-black capitalize text-zinc-700">{group.replace(/([A-Z])/g, " $1")}</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {values.map((value) => {
                      const active = Boolean(preferences[group]?.includes(value));
                      return (
                        <button key={value} onClick={() => togglePreference(group, value)} className={`min-w-fit rounded-2xl px-4 py-2 text-sm font-black transition ${active ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-zinc-100 text-zinc-600"}`}>
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </main>

        <aside className="space-y-5">
          <Panel title="Main Wallet" action={<Link to="/wallet" className="text-sm font-black text-red-600">Open</Link>} loading={walletQuery.isLoading}>
            <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-teal-800 p-5 text-white">
              <Wallet className="h-7 w-7" />
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-white/65">Available balance</p>
              <div className="mt-1 text-4xl font-black">Rs {Math.round(wallet?.balance ?? 0)}</div>
            </div>
            <div className="mt-3 space-y-2">
              {(wallet?.transactions ?? []).slice(0, 3).map((tx) => <LedgerRow key={tx.id} title={tx.type.replace(/_/g, " ")} text={tx.reason} amount={tx.amount} />)}
              {(wallet?.transactions ?? []).length === 0 && <p className="rounded-2xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">No wallet activity yet.</p>}
            </div>
          </Panel>

          <Panel title="Support" action={<Link to="/support" className="text-sm font-black text-red-600">Help center</Link>} loading={ticketQuery.isLoading}>
            {openTickets.length === 0 ? <EmptyState icon={MessageCircle} title="No open tickets" text="Need help? Create a support ticket anytime." /> : (
              <div className="space-y-2">
                {openTickets.slice(0, 3).map((ticket) => (
                  <Link key={ticket.id} to="/support/chat/$ticketId" params={{ ticketId: ticket.id }} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-black">{ticket.subject}</span>
                      <span className="text-xs font-bold capitalize text-zinc-500">{ticket.status.replace(/_/g, " ")}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Notifications"
            action={unreadNotifications.length > 0 ? <button onClick={() => readAllNotifications.mutate()} className="text-sm font-black text-red-600">Mark all read</button> : null}
            loading={notificationQuery.isLoading}
          >
            {notifications.length === 0 ? <EmptyState icon={Bell} title="No notifications" text="Order updates and support replies will appear here." /> : (
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notice) => (
                  <button key={notice.id} onClick={() => !notice.read && readNotification.mutate(notice.id)} className={`w-full rounded-2xl p-4 text-left ${notice.read ? "bg-zinc-50" : "bg-red-50 ring-1 ring-red-100"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black">{notice.title}</div>
                        <p className="mt-1 text-sm font-semibold leading-5 text-zinc-600">{notice.body}</p>
                      </div>
                      {!notice.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Rewards and extras">
            <div className="grid gap-3">
              <InfoTile icon={Gift} title={`${couponQuery.data?.length ?? 0} coupons`} text="Apply offers during checkout." to="/cart" />
              <InfoTile icon={Heart} title={`${favoriteQuery.data?.length ?? 0} favorites`} text="Quickly reorder loved dishes." to="/favorites" />
              <InfoTile icon={Sparkles} title={`Referral ${profile?.referralCode || "ADFOOD"}`} text="Share with friends and earn rewards." />
            </div>
          </Panel>

          <button onClick={signOut} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-zinc-950 font-black text-white">
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </aside>
      </div>

      {editOpen && (
        <Modal title="Edit profile" onClose={() => setEditOpen(false)}>
          <form onSubmit={submitProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-[26px] bg-zinc-100 text-2xl font-black">
                {photoUrl ? <img src={photoUrl} alt="Profile preview" className="h-full w-full object-cover" /> : profileUser?.name?.charAt(0).toUpperCase()}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">
                <Upload className="h-4 w-4" /> {uploadPhoto.isPending ? "Uploading..." : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" disabled={uploadPhoto.isPending} onChange={(event) => event.target.files?.[0] && uploadPhoto.mutate(event.target.files[0])} />
              </label>
            </div>
            <Field label="Name" name="name" defaultValue={profileUser?.name || ""} />
            <Field label="Phone" name="phone" defaultValue={profileUser?.phone || ""} disabled />
            <Field label="Email" name="email" type="email" defaultValue={profile?.email || ""} icon={Mail} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Birthday" name="dateOfBirth" type="date" defaultValue={profile?.dateOfBirth || ""} icon={CalendarDays} />
              <Field label="Anniversary" name="anniversary" type="date" defaultValue={profile?.anniversary || ""} icon={CalendarDays} />
            </div>
            <div className="rounded-3xl bg-zinc-50 p-4">
              <div className="font-black">Notification preferences</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {["orders", "offers", "coupons", "announcements", "support"].map((key) => (
                  <label key={key} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-black capitalize">
                    {key}
                    <input type="checkbox" checked={Boolean(notificationSettings[key])} onChange={(event) => setNotificationSettings((current) => ({ ...current, [key]: event.target.checked }))} />
                  </label>
                ))}
              </div>
            </div>
            <button disabled={saveProfile.isPending || uploadPhoto.isPending} className="min-h-14 w-full rounded-2xl bg-red-600 font-black text-white disabled:opacity-60">{saveProfile.isPending ? "Saving..." : "Save Profile"}</button>
          </form>
        </Modal>
      )}

      {addressOpen && (
        <Modal title={editingAddressId ? "Edit address" : "Add address"} onClose={closeAddressEditor}>
          <form onSubmit={(event) => { event.preventDefault(); saveAddress.mutate(); }} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label" value={addressDraft.label} onChange={(value) => setAddressDraft((current) => ({ ...current, label: value }))} />
              <Field label="Name" value={addressDraft.name} onChange={(value) => setAddressDraft((current) => ({ ...current, name: value }))} />
            </div>
            <Field label="Phone" value={addressDraft.phone} onChange={(value) => setAddressDraft((current) => ({ ...current, phone: value }))} />
            <label className="block">
              <span className="text-sm font-black">Full address</span>
              <textarea value={addressDraft.address} onChange={(event) => setAddressDraft((current) => ({ ...current, address: event.target.value }))} rows={4} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-semibold outline-none focus:border-red-500" required />
            </label>
            <Field label="Landmark" value={addressDraft.landmark || ""} onChange={(value) => setAddressDraft((current) => ({ ...current, landmark: value }))} />
            <Field label="Delivery notes" value={addressDraft.notes || ""} onChange={(value) => setAddressDraft((current) => ({ ...current, notes: value }))} />
            <label className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-black">
              Make default address
              <input type="checkbox" checked={addressDraft.isDefault} onChange={(event) => setAddressDraft((current) => ({ ...current, isDefault: event.target.checked }))} />
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <button disabled={saveAddress.isPending || !addressDraft.name || !addressDraft.phone || !addressDraft.address} className="min-h-14 rounded-2xl bg-red-600 font-black text-white disabled:opacity-60">{saveAddress.isPending ? "Saving..." : "Save Address"}</button>
              {editingAddressId && <button type="button" onClick={() => removeAddress.mutate(editingAddressId)} className="min-h-14 rounded-2xl bg-zinc-100 px-5 font-black text-red-600"><Trash2 className="inline h-4 w-4" /> Delete</button>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SignedOutProfile() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[30px] bg-red-50 text-red-600">
        <User className="h-10 w-10" />
      </div>
      <h1 className="mt-5 text-3xl font-black">Sign in to your account</h1>
      <p className="mt-2 text-zinc-500">Manage orders, wallet, support chats, addresses, rewards and preferences from one place.</p>
      <div className="mt-6 grid gap-3">
        <Link to="/login" className="rounded-3xl bg-red-600 px-6 py-4 font-black text-white">Sign in</Link>
        <Link to="/signup" className="rounded-3xl bg-white px-6 py-4 font-black text-zinc-900 ring-1 ring-zinc-100">Create account</Link>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-black capitalize text-white/80 ring-1 ring-white/10 md:px-3 md:text-xs">{children}</span>;
}

function HeroStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/10 md:rounded-3xl md:p-4">
      <Icon className="h-4 w-4 text-red-200 md:h-5 md:w-5" />
      <div className="mt-1.5 truncate text-[10px] font-bold text-white/55 md:mt-3 md:text-xs">{label}</div>
      <div className="truncate text-sm font-black md:text-xl">{value}</div>
    </div>
  );
}

function QuickAction({ to, onClick, icon: Icon, label, tone }: { to?: string; onClick?: () => void; icon: React.ElementType; label: string; tone: string }) {
  const className = "flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[24px] bg-white p-3 text-center text-xs font-black text-zinc-800 shadow-sm ring-1 ring-zinc-100 transition hover:-translate-y-0.5 hover:shadow-md";
  const iconClass = `grid h-11 w-11 place-items-center rounded-2xl ${toneClass(tone)}`;
  const content = <><span className={iconClass}><Icon className="h-5 w-5" /></span><span>{label}</span></>;
  if (to) return <Link to={to as never} className={className}>{content}</Link>;
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

function toneClass(tone: string) {
  const map: Record<string, string> = {
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    dark: "bg-zinc-950 text-white",
    pink: "bg-pink-50 text-pink-600",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return map[tone] || map.red;
}

function Panel({ title, action, loading, children }: { title: string; action?: React.ReactNode; loading?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        {action}
      </div>
      {loading ? <div className="h-28 animate-pulse rounded-3xl bg-zinc-100" /> : children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-5 text-center">
      <Icon className="mx-auto h-8 w-8 text-zinc-400" />
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-zinc-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LedgerRow({ title, text, amount }: { title: string; text: string; amount: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4">
      <div className="min-w-0">
        <div className="truncate font-black capitalize">{title}</div>
        <div className="truncate text-xs font-semibold text-zinc-500">{text}</div>
      </div>
      <div className={`shrink-0 font-black ${amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{amount >= 0 ? "+" : "-"}Rs {Math.abs(amount)}</div>
    </div>
  );
}

function InfoTile({ icon: Icon, title, text, to }: { icon: React.ElementType; title: string; text: string; to?: string }) {
  const content = (
    <>
      <Icon className="h-5 w-5 text-red-600" />
      <span className="min-w-0">
        <span className="block truncate font-black">{title}</span>
        <span className="block truncate text-xs font-semibold text-zinc-500">{text}</span>
      </span>
      {to && <ChevronRight className="ml-auto h-4 w-4 text-zinc-400" />}
    </>
  );
  const className = "flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 text-left";
  if (to) return <Link to={to as never} className={className}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] bg-zinc-950/55 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-xl items-end md:items-center">
        <section className="max-h-[92vh] w-full overflow-y-auto rounded-[32px] bg-white p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">{title}</h2>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100"><X className="h-5 w-5" /></button>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  value,
  onChange,
  disabled,
  icon: Icon,
}: {
  label: string;
  name?: string;
  type?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">{label}</span>
      <span className="mt-2 flex h-14 items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 focus-within:border-red-500">
        {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent font-bold outline-none disabled:text-zinc-400"
          required={!disabled && (label === "Name" || label === "Phone" || label === "Full address")}
        />
      </span>
    </label>
  );
}
