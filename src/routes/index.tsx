import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Flame, MapPin, Search, Sparkles, Star, Ticket, Truck } from "lucide-react";
import { getCustomerHome } from "@/services/api";
import { useCart } from "@/stores/cart";
import type { MenuItem } from "@/data/menu";
import { imageFallback, isVideoUrl, resolveMediaUrl } from "@/lib/media";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ankapur Dhaba - Order Food Online" },
      { name: "description", content: "Order biryani, Ankapur chicken, Telangana meals, curries, breads and desserts from Ankapur Dhaba." },
    ],
  }),
  component: Home,
});

const categoryIcons: Record<string, string> = {
  chicken: "🍗",
  biryani: "🍛",
  meals: "🥘",
  veg: "🥬",
  drinks: "🥤",
  desserts: "🍨",
  breads: "🫓",
  starters: "🔥",
};

function Home() {
  const { data, isLoading } = useQuery({ queryKey: ["customer-home"], queryFn: getCustomerHome, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true });
  const [bannerIndex, setBannerIndex] = useState(0);
  const add = useCart((s) => s.add);

  useEffect(() => {
    if (!data?.banners.length) return;
    const id = window.setInterval(() => setBannerIndex((i) => (i + 1) % data.banners.length), 4500);
    return () => window.clearInterval(id);
  }, [data?.banners.length]);

  const heroBanners = useMemo(() => (data?.banners ?? []).filter((item) => !isAdBanner(item.type)), [data?.banners]);
  const visibleBanners = heroBanners.length ? heroBanners : data?.banners ?? [];
  const banner = visibleBanners[bannerIndex % Math.max(visibleBanners.length, 1)];
  const categories = useMemo(() => data?.categories.slice(0, 10) ?? [], [data]);

  if (isLoading || !data) return <HomeSkeleton />;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-8 pt-2 sm:px-4 md:px-6 md:pt-8">
      <header className="mb-3 flex items-center justify-between md:hidden">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Ankapur Dhaba</div>
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            <MapPin className="h-4 w-4" /> {data.store.status === "online" ? "Delivering now" : data.store.statusMessage || "Store paused"}
          </div>
        </div>
        <Link to="/profile" className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm">
          <span className="font-black text-red-600">AD</span>
        </Link>
      </header>

      <Link
        to="/menu"
        className="mb-3 flex h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm text-zinc-500 shadow-sm ring-1 ring-zinc-100 md:hidden"
      >
        <Search className="h-5 w-5" />
        Search biryani, chicken, naan...
      </Link>

      <section className="relative overflow-hidden rounded-[22px] bg-zinc-950 text-white shadow-xl sm:rounded-[28px] md:rounded-[32px]">
        <BannerMedia src={banner?.image || "/assets/hero-biryani.jpg"} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-black/10" />
        <div className="relative flex min-h-[220px] flex-col justify-end p-4 sm:min-h-[270px] sm:p-5 md:min-h-[360px] md:p-8 lg:min-h-[410px] lg:p-10">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold backdrop-blur sm:text-xs">
            <Flame className="h-3.5 w-3.5 text-yellow-300 sm:h-4 sm:w-4" /> {banner?.type?.replace(/-/g, " ").toUpperCase() || "TODAY'S SPECIAL"}
          </div>
          <h1 className="mt-3 max-w-[18rem] text-2xl font-black leading-tight sm:max-w-md sm:text-3xl md:mt-5 md:max-w-xl md:text-5xl lg:text-6xl">{banner?.title}</h1>
          <p className="mt-2 line-clamp-2 max-w-[17rem] text-sm text-white/80 sm:max-w-md md:text-base lg:text-lg">{banner?.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3 md:mt-7">
            <Link to={banner?.ctaLink || "/menu"} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white shadow-lg shadow-red-600/30 sm:min-h-12 sm:px-5 sm:text-base">
              {banner?.ctaLabel || "Order Now"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/orders" className="inline-flex min-h-10 items-center rounded-2xl bg-white/15 px-4 text-sm font-bold backdrop-blur sm:min-h-12 sm:px-5 sm:text-base">Your Orders</Link>
          </div>
          <div className="absolute bottom-3 right-4 flex gap-1.5 sm:bottom-5 sm:left-6 sm:right-auto sm:gap-2 md:left-8 lg:left-10">
            {visibleBanners.map((item, i) => (
              <button key={item.id} onClick={() => setBannerIndex(i)} className={`h-1.5 rounded-full transition-all sm:h-2 ${i === bannerIndex ? "w-6 bg-white sm:w-8" : "w-1.5 bg-white/45 sm:w-2"}`} aria-label={`Show banner ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-20 -mx-3 mt-3 overflow-hidden bg-yellow-100 px-3 py-2.5 text-xs font-black text-yellow-950 sm:-mx-4 sm:px-4 sm:text-sm md:static md:mx-0 md:mt-4 md:rounded-2xl md:py-3">
        <div className="animate-[marquee_20s_linear_infinite] whitespace-nowrap">
          {data.announcements.map((a) => a.message).join("   •   ")}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:mt-5 md:grid-cols-6">
        <InfoCard icon={Clock3} label="Avg Time" value={`${data.store.averageDeliveryMin} min`} />
        <InfoCard icon={Truck} label="Delivery" value={`₹${data.store.deliveryCharge}`} />
        <InfoCard icon={Ticket} label="Free Above" value={`₹${data.store.freeDeliveryAbove}`} />
      </section>

      <section className="mt-6 md:mt-7">
        <SectionTitle title="Quick categories" action="View menu" to="/menu" />
        <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {categories.map((category) => {
            const key = category.name.toLowerCase();
            const icon = category.icon || Object.entries(categoryIcons).find(([k]) => key.includes(k))?.[1] || "🍽️";
            return (
              <Link key={category.id} to="/menu" search={{ category: category.name } as never} className="min-w-[92px] rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-zinc-100">
                <div className="text-3xl">{icon}</div>
                <div className="mt-2 text-sm font-black">{category.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {data.coupons.length > 0 && (
        <section className="mt-7">
          <SectionTitle title="Today's offers" />
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {data.coupons.slice(0, 3).map((coupon) => (
              <div key={coupon.id} className="rounded-3xl border border-dashed border-red-300 bg-red-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-600">{coupon.category}</div>
                <div className="mt-1 text-2xl font-black">{coupon.code}</div>
                <div className="text-sm text-zinc-600">{coupon.title}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.collections.map((collection) => (
        <section key={collection.id} className="mt-7 md:mt-8">
          <SectionTitle title={collection.title} action="See all" to="/menu" />
          <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {collection.items.slice(0, 8).map((item) => <FoodTile key={item.id} item={item} onAdd={() => add(item)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function FoodTile({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <article className="min-w-[210px] overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
      <Link to="/menu" className="block">
        <div className="relative aspect-[4/3] bg-zinc-100">
          <img src={resolveMediaUrl(item.image)} alt={item.name} loading="lazy" onError={imageFallback} className="h-full w-full object-cover" />
          {item.discountPercent ? <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-2 py-1 text-xs font-black text-zinc-950">{item.discountPercent}% OFF</span> : null}
        </div>
      </Link>
      <div className="p-4">
        <div className="line-clamp-1 font-black">{item.name}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {item.rating || 4.6} • {item.prepTimeMinutes || 20} min
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="font-black">₹{item.price}</div>
          <button onClick={onAdd} disabled={!item.available} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white disabled:bg-zinc-300">ADD</button>
        </div>
      </div>
    </article>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 sm:rounded-3xl sm:p-4">
      <Icon className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
      <div className="mt-1.5 text-[11px] text-zinc-500 sm:mt-2 sm:text-xs">{label}</div>
      <div className="text-sm font-black sm:text-base">{value}</div>
    </div>
  );
}

function SectionTitle({ title, action, to }: { title: string; action?: string; to?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-black md:text-2xl">{title}</h2>
      {action && to && <Link to={to} className="text-sm font-bold text-red-600">{action}</Link>}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4">
      <div className="h-12 rounded-3xl bg-white" />
      <div className="h-[220px] animate-pulse rounded-[22px] bg-zinc-200 md:h-[360px] md:rounded-[28px]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-3xl bg-white" />
        <div className="h-24 rounded-3xl bg-white" />
        <div className="h-24 rounded-3xl bg-white" />
      </div>
    </div>
  );
}

function BannerMedia({ src }: { src: string }) {
  const url = resolveMediaUrl(src);
  if (isVideoUrl(url)) {
    return <video src={url} className="absolute inset-0 h-full w-full object-cover opacity-75" muted autoPlay loop playsInline />;
  }
  return <img src={url} alt="" onError={imageFallback} className="absolute inset-0 h-full w-full object-cover opacity-70" />;
}

function isAdBanner(type?: string) {
  return Boolean(type && /ad|sponsor|brand/i.test(type));
}
