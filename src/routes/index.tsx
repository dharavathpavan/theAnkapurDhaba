import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Flame, MapPin, Search, Sparkles, Star, Ticket, Truck, UtensilsCrossed } from "lucide-react";
import { getCustomerHome, type CustomerBanner } from "@/services/api";
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
  chicken: "CH",
  biryani: "BR",
  meals: "ML",
  veg: "VG",
  drinks: "DR",
  desserts: "DS",
  breads: "NA",
  starters: "ST",
};

function Home() {
  const { data, isLoading } = useQuery({ queryKey: ["customer-home"], queryFn: getCustomerHome, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true });
  const [bannerIndex, setBannerIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const heroBanners = useMemo(() => (data?.banners ?? []).filter((item) => !isAdBanner(item.type)), [data?.banners]);
  const visibleBanners = heroBanners;
  const banner = visibleBanners[bannerIndex % Math.max(visibleBanners.length, 1)];
  const hero = banner ? heroClasses(banner) : null;
  const categories = useMemo(() => data?.categories.slice(0, 10) ?? [], [data]);

  useEffect(() => {
    if (!heroBanners.length) return;
    const id = window.setInterval(() => setBannerIndex((i) => (i + 1) % heroBanners.length), 4500);
    return () => window.clearInterval(id);
  }, [heroBanners.length]);

  function showRelativeBanner(delta: number) {
    if (!visibleBanners.length) return;
    setBannerIndex((i) => (i + delta + visibleBanners.length) % visibleBanners.length);
  }

  if (isLoading || !data) return <HomeSkeleton />;

  const bestSellers = data.collections.find((item) => /best/i.test(item.title))?.items ?? data.recommended;
  const chefSpecials = data.collections.find((item) => /chef/i.test(item.title))?.items ?? data.recommended;
  const fastDelivery = data.recommended.filter((item) => (item.prepTimeMinutes || 30) <= 25).slice(0, 8);

  return (
    <div className="bg-[#F8F9FB]">
      <div className="mx-auto max-w-7xl px-3 pb-10 pt-3 sm:px-4 md:px-6 md:pt-6">
        <section className="rounded-[28px] border border-white/70 bg-white/78 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-red-600">
                <MapPin className="h-4 w-4" /> Ankapur Dhaba
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-zinc-600 md:text-base">
                {data.store.status === "online" ? "Delivering now" : data.store.statusMessage || "Store paused"} · Closes {data.store.closeTime}
              </div>
            </div>
            <Link to="/profile" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-zinc-950 font-black text-white md:hidden">AD</Link>
          </div>

          <Link
            to="/menu"
            className="sticky top-3 z-30 mt-4 flex min-h-13 items-center gap-3 rounded-[22px] border border-white/80 bg-white/92 px-4 text-sm font-semibold text-zinc-500 shadow-lg shadow-zinc-950/5 backdrop-blur-2xl md:hidden"
          >
            <Search className="h-5 w-5 text-red-500" />
            Search biryani, chicken, naan...
          </Link>

          {banner && hero && (
            <section
              className={`relative mt-4 overflow-hidden rounded-[26px] bg-zinc-950 shadow-2xl shadow-zinc-950/15 md:rounded-[34px] ${hero.textColor}`}
              onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => {
                if (touchStart === null) return;
                const diff = touchStart - (event.changedTouches[0]?.clientX ?? touchStart);
                if (Math.abs(diff) > 42) showRelativeBanner(diff > 0 ? 1 : -1);
                setTouchStart(null);
              }}
            >
              <BannerMedia banner={banner} />
              <div className={`absolute inset-0 ${hero.overlay}`} />
              <div className={`relative flex ${hero.mobileHeight} ${hero.desktopHeight} flex-col justify-end p-4 sm:p-5 md:p-8 lg:p-10 ${hero.align}`}>
                <div className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur sm:text-xs ${hero.badge}`}>
                  <Flame className="h-3.5 w-3.5 text-yellow-300 sm:h-4 sm:w-4" /> {banner.type?.replace(/-/g, " ") || "Today special"}
                </div>
                <h1 className={`mt-3 max-w-[19rem] text-2xl font-black leading-tight sm:max-w-md sm:text-3xl md:mt-5 md:max-w-2xl md:text-5xl lg:text-6xl ${hero.textBox}`}>{banner.title}</h1>
                <p className={`mt-2 line-clamp-2 max-w-[18rem] text-sm font-semibold sm:max-w-md md:text-base lg:text-lg ${hero.muted} ${hero.textBox}`}>{banner.subtitle}</p>
                <div className={`mt-4 flex flex-wrap gap-2 sm:gap-3 md:mt-7 ${hero.ctaAlign}`}>
                  {banner.ctaEnabled !== false && <Link to={(banner.ctaLink || "/menu") as never} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white shadow-lg shadow-red-600/30 sm:min-h-12 sm:px-5 sm:text-base">
                    {banner.ctaLabel || "Order Now"} <ArrowRight className="h-4 w-4" />
                  </Link>}
                  {banner.secondaryCtaEnabled !== false && <Link to={(banner.secondaryCtaLink || "/orders") as never} className={`inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-black backdrop-blur sm:min-h-12 sm:px-5 sm:text-base ${hero.secondaryButton}`}>{banner.secondaryCtaLabel || "Your Orders"}</Link>}
                </div>
                <div className={`absolute bottom-3 flex gap-1.5 sm:bottom-5 sm:gap-2 ${hero.dots}`}>
                  {visibleBanners.map((item, i) => (
                    <button key={item.id} onClick={() => setBannerIndex(i)} className={`h-1.5 rounded-full transition-all sm:h-2 ${i === bannerIndex ? "w-7 bg-white sm:w-9" : "w-1.5 bg-white/50 sm:w-2"}`} aria-label={`Show banner ${i + 1}`} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-yellow-200/70 bg-yellow-100/85 px-4 py-3 text-sm font-black text-yellow-950 shadow-sm backdrop-blur-xl">
          <div className="animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            {(data.announcements.length ? data.announcements.map((a) => a.message) : [`Free delivery above Rs ${data.store.freeDeliveryAbove}`]).join("   |   ")}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
          <InfoCard icon={Clock3} label="Avg Time" value={`${data.store.averageDeliveryMin} min`} />
          <InfoCard icon={Truck} label="Delivery" value={`Rs ${data.store.deliveryCharge}`} />
          <InfoCard icon={Ticket} label="Free Above" value={`Rs ${data.store.freeDeliveryAbove}`} />
        </section>

        <section className="mt-7">
          <SectionTitle title="What's on your mind?" action="Full menu" to="/menu" />
          <div className="-mx-3 mt-3 flex gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:px-0">
            {categories.map((category) => {
              const key = category.name.toLowerCase();
              const icon = category.icon || Object.entries(categoryIcons).find(([k]) => key.includes(k))?.[1] || "AD";
              return (
                <Link key={category.id} to="/menu" search={{ category: category.name } as never} className="min-w-[104px] rounded-[26px] border border-white/80 bg-white/88 p-3 text-center shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-lg font-black text-red-600">{icon}</div>
                  <div className="mt-2 line-clamp-1 text-sm font-black">{category.name}</div>
                </Link>
              );
            })}
          </div>
        </section>

        {data.coupons.length > 0 && (
          <section className="mt-7">
            <SectionTitle title="Offers near you" />
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {data.coupons.slice(0, 3).map((coupon) => (
                <div key={coupon.id} className="overflow-hidden rounded-[26px] border border-red-100 bg-white shadow-sm">
                  <div className="bg-red-600 px-4 py-3 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/75">{coupon.category || "Offer"}</div>
                    <div className="mt-1 text-2xl font-black">{coupon.code}</div>
                  </div>
                  <div className="p-4">
                    <div className="font-black">{coupon.title}</div>
                    <div className="mt-1 text-sm text-zinc-500">Min order Rs {coupon.minOrder}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <FoodSection title="Top picks for you" subtitle="Recommended from today's menu" items={data.recommended} onAdd={add} />
        <FoodSection title="Best sellers" subtitle="Most loved by Ankapur Dhaba customers" items={bestSellers} onAdd={add} />
        <FoodSection title="Fast delivery" subtitle="Fresh plates that reach quickly" items={fastDelivery.length ? fastDelivery : data.recommended} onAdd={add} />
        <FoodSection title="Chef specials" subtitle="Signature dhaba favourites" items={chefSpecials} onAdd={add} />
      </div>
    </div>
  );
}

function FoodSection({ title, subtitle, items, onAdd }: { title: string; subtitle: string; items: MenuItem[]; onAdd: (item: MenuItem) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <SectionTitle title={title} subtitle={subtitle} action="See all" to="/menu" />
      <div className="-mx-3 mt-3 flex gap-4 overflow-x-auto px-3 pb-3 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-5">
        {items.slice(0, 10).map((item) => <FoodTile key={item.id} item={item} onAdd={() => onAdd(item)} />)}
      </div>
    </section>
  );
}

function FoodTile({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <article className="min-w-[230px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl md:min-w-0">
      <Link to="/menu" className="block">
        <div className="relative aspect-[4/3] bg-zinc-100">
          <img src={resolveMediaUrl(item.image)} alt={item.name} loading="lazy" onError={imageFallback} className="h-full w-full object-cover" />
          {item.discountPercent ? <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-2 py-1 text-xs font-black text-zinc-950">{item.discountPercent}% OFF</span> : null}
          {item.bestseller ? <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white">BEST</span> : null}
        </div>
      </Link>
      <div className="p-4">
        <div className="line-clamp-1 text-base font-black">{item.name}</div>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-zinc-500">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {item.rating || 4.6}
          <span className="h-1 w-1 rounded-full bg-zinc-300" />
          <Clock3 className="h-3.5 w-3.5" /> {item.prepTimeMinutes || 20} min
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-lg font-black">Rs {item.price}</div>
            {item.basePrice && item.basePrice > item.price ? <div className="text-xs font-semibold text-zinc-400 line-through">Rs {item.basePrice}</div> : null}
          </div>
          <button onClick={onAdd} disabled={!item.available} className="min-h-10 rounded-2xl bg-red-600 px-4 text-sm font-black text-white shadow-lg shadow-red-600/20 disabled:bg-zinc-300">ADD</button>
        </div>
      </div>
    </article>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-3 shadow-sm backdrop-blur-xl sm:p-4">
      <Icon className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
      <div className="mt-1.5 text-[11px] font-semibold text-zinc-500 sm:mt-2 sm:text-xs">{label}</div>
      <div className="text-sm font-black sm:text-base">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle, action, to }: { title: string; subtitle?: string; action?: string; to?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-black tracking-tight md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm font-semibold text-zinc-500">{subtitle}</p> : null}
      </div>
      {action && to && <Link to={to} className="shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-red-600">{action}</Link>}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4">
      <div className="h-24 rounded-[28px] bg-white" />
      <div className="h-[230px] animate-pulse rounded-[26px] bg-zinc-200 md:h-[390px]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-[22px] bg-white" />
        <div className="h-24 rounded-[22px] bg-white" />
        <div className="h-24 rounded-[22px] bg-white" />
      </div>
    </div>
  );
}

function BannerMedia({ banner }: { banner: CustomerBanner }) {
  const desktopUrl = resolveMediaUrl(banner.image);
  const mobileUrl = resolveMediaUrl(banner.mobileImage || banner.image);
  const url = desktopUrl;
  if (isVideoUrl(url)) {
    return <video src={url} className="absolute inset-0 h-full w-full object-cover opacity-82" muted autoPlay loop playsInline />;
  }
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobileUrl} />
      <img src={desktopUrl} alt="" onError={imageFallback} className="absolute inset-0 h-full w-full object-cover opacity-85" />
    </picture>
  );
}

function isAdBanner(type?: string) {
  return Boolean(type && /ad|sponsor|brand/i.test(type));
}

function heroClasses(banner: CustomerBanner) {
  const align = banner.textAlign === "center" ? "items-center text-center" : banner.textAlign === "right" ? "items-end text-right" : "items-start text-left";
  const ctaAlign = banner.textAlign === "center" ? "justify-center" : banner.textAlign === "right" ? "justify-end" : "justify-start";
  const dots = banner.textAlign === "center" ? "left-1/2 -translate-x-1/2" : banner.textAlign === "right" ? "left-4 sm:left-auto sm:right-6 md:right-8 lg:right-10" : "right-4 sm:left-6 sm:right-auto md:left-8 lg:left-10";
  const mobileHeight = banner.heightMobile === "tall" ? "min-h-[310px]" : banner.heightMobile === "standard" ? "min-h-[255px]" : "min-h-[215px]";
  const desktopHeight = banner.heightDesktop === "tall" ? "md:min-h-[470px] lg:min-h-[520px]" : banner.heightDesktop === "compact" ? "md:min-h-[310px] lg:min-h-[340px]" : "md:min-h-[380px] lg:min-h-[430px]";
  const darkText = banner.textColorMode === "dark";
  const overlay = banner.overlayStrength === "light"
    ? darkText ? "bg-white/28" : "bg-black/32"
    : banner.overlayStrength === "medium"
      ? darkText ? "bg-gradient-to-r from-white/90 via-white/50 to-white/10" : "bg-gradient-to-r from-black/78 via-black/42 to-black/8"
      : darkText ? "bg-gradient-to-r from-white/95 via-white/60 to-white/15" : "bg-gradient-to-r from-black/92 via-black/62 to-black/16";
  return {
    align,
    ctaAlign,
    dots,
    mobileHeight,
    desktopHeight,
    overlay,
    textColor: darkText ? "text-zinc-950" : "text-white",
    muted: darkText ? "text-zinc-700" : "text-white/86",
    badge: darkText ? "bg-white/85 text-zinc-900" : "bg-white/18 text-white",
    secondaryButton: darkText ? "bg-white/85 text-zinc-900" : "bg-white/18 text-white",
    textBox: banner.textAlign === "center" ? "mx-auto" : banner.textAlign === "right" ? "ml-auto" : "",
  };
}
