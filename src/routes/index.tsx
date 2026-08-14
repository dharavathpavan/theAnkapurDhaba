import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Facebook,
  Instagram,
  MapPin,
  Quote,
  Sparkles,
  Star,
  Ticket,
  Truck,
  UtensilsCrossed,
  Youtube,
} from "lucide-react";
import { getCustomerHome, type CustomerBanner, type CustomerReview } from "@/services/api";
import { useCart } from "@/stores/cart";
import type { MenuItem } from "@/data/menu";
import { imageFallback, isVideoUrl, resolveMediaUrl } from "@/lib/media";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { isCategoryAvailableNow, isMenuItemAvailableNow } from "@/lib/menu-availability";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ankapur Dhaba - Order Food Online" },
      {
        name: "description",
        content:
          "Order biryani, Ankapur chicken, Telangana meals, curries, breads and desserts from Ankapur Dhaba.",
      },
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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-home"],
    queryFn: getCustomerHome,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const [bannerIndex, setBannerIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const heroBanners = useMemo(
    () => (data?.banners ?? []).filter((item) => !isAdBanner(item.type)),
    [data?.banners],
  );
  const visibleBanners = heroBanners;
  const banner = visibleBanners[bannerIndex % Math.max(visibleBanners.length, 1)];
  const heroHeight = banner ? heroHeightClasses(banner) : "";
  const categories = useMemo(() => data?.categories.slice(0, 10) ?? [], [data]);
  const availableItems = useMemo(
    () =>
      (data?.recommended ?? []).filter(
        (item) => isMenuItemAvailableNow(item, data?.categories ?? []).available,
      ),
    [data?.recommended, data?.categories],
  );

  useEffect(() => {
    if (!heroBanners.length) return;
    const id = window.setInterval(() => setBannerIndex((i) => (i + 1) % heroBanners.length), 4500);
    return () => window.clearInterval(id);
  }, [heroBanners.length]);

  function showRelativeBanner(delta: number) {
    if (!visibleBanners.length) return;
    setBannerIndex((i) => (i + delta + visibleBanners.length) % visibleBanners.length);
  }

  if (isLoading) return <HomeSkeleton />;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[32px] bg-white shadow-sm">
          <MapPin className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="mt-6 text-3xl font-black">Couldn't load the menu</h1>
        <p className="mt-2 text-zinc-500">
          We hit a snag fetching today's menu and offers. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-8 inline-flex min-h-14 items-center rounded-3xl bg-red-600 px-6 font-black text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const bestSellers = (
    data.collections.find((item) => /best/i.test(item.title))?.items ?? data.recommended
  ).filter((item) => isMenuItemAvailableNow(item, data.categories).available);
  const chefSpecials = (
    data.collections.find((item) => /chef/i.test(item.title))?.items ?? data.recommended
  ).filter((item) => isMenuItemAvailableNow(item, data.categories).available);
  const fastDelivery = availableItems
    .filter((item) => (item.prepTimeMinutes || 30) <= 25)
    .slice(0, 8);

  return (
    <div className="bg-[#F8F9FB]">
      <div className="mx-auto max-w-7xl px-3 pb-10 pt-3 sm:px-4 md:px-6 md:pt-6">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm backdrop-blur-xl sm:px-4">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
              <MapPin className="h-4 w-4 shrink-0 text-red-600" />
              <span className="truncate text-zinc-600">Ankapur Dhaba</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
              <span
                className={`truncate ${
                  data.store.status === "online" ? "text-green-700" : "text-yellow-700"
                }`}
              >
                {storeStatusLabel(data.store.status, data.store.statusMessage)}
              </span>
            </div>
            <div className="shrink-0 text-xs font-black text-zinc-600">
              Closes {formatStoreTime(data.store.closeTime)}
            </div>
          </div>

          {banner && (
            <section
              className="relative overflow-hidden rounded-[22px] bg-zinc-950 shadow-2xl shadow-zinc-950/12 sm:rounded-[26px] md:rounded-[34px]"
              onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
              onTouchEnd={(event) => {
                if (touchStart === null) return;
                const diff = touchStart - (event.changedTouches[0]?.clientX ?? touchStart);
                if (Math.abs(diff) > 42) showRelativeBanner(diff > 0 ? 1 : -1);
                setTouchStart(null);
              }}
            >
              <BannerMedia banner={banner} />
              <div className={`relative flex ${heroHeight} flex-col justify-end p-3 sm:p-4`}>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur sm:bottom-4 sm:gap-2">
                  {visibleBanners.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => setBannerIndex(i)}
                      aria-label={`Show banner ${i + 1}`}
                      aria-current={i === bannerIndex}
                      className="grid h-6 w-6 place-items-center rounded-full"
                    >
                      <span
                        className={`block rounded-full transition-all ${
                          i === bannerIndex
                            ? "h-1.5 w-7 bg-white sm:w-9"
                            : "h-1.5 w-1.5 bg-white/70 sm:w-2"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>

        <section className="mt-4 overflow-hidden rounded-[24px] border border-yellow-200/70 bg-yellow-100/85 px-4 py-3 text-sm font-black text-yellow-950 shadow-sm backdrop-blur-xl">
          <div className="animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            {(data.announcements.length
              ? data.announcements.map((a) => a.message)
              : [`Free delivery above Rs ${data.store.freeDeliveryAbove}`]
            ).join("   |   ")}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
          <InfoCard icon={Clock3} label="Avg Time" value={`${data.store.averageDeliveryMin} min`} />
          <InfoCard
            icon={Truck}
            label="Delivery"
            value={data.store.deliveryCharge === 0 ? "FREE" : `₹${data.store.deliveryCharge}`}
          />
          <InfoCard icon={Ticket} label="Free Above" value={`₹${data.store.freeDeliveryAbove}`} />
          <InfoCard icon={Clock3} label="Closes" value={formatStoreTime(data.store.closeTime)} />
        </section>

        <section className="mt-7">
          <SectionTitle search={{}} title="What's on your mind?" action="Full menu" to="/menu" />
          <div className="-mx-3 mt-3 flex gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:px-0">
            {categories.map((category) => {
              const key = category.name.toLowerCase();
              const icon =
                category.icon ||
                Object.entries(categoryIcons).find(([k]) => key.includes(k))?.[1] ||
                "AD";
              const availability = isCategoryAvailableNow(category);
              const className = `min-w-[104px] rounded-[26px] border border-white/80 bg-white/88 p-3 text-center shadow-sm backdrop-blur-xl transition ${
                availability.available ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-60"
              }`;
              if (!availability.available) {
                return (
                  <div key={category.id} title={availability.message} className={className}>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-zinc-100 text-lg font-black text-zinc-400">
                      {icon}
                    </div>
                    <div className="mt-2 line-clamp-1 text-sm font-black">{category.name}</div>
                    <div className="mt-1 text-[10px] font-black uppercase text-zinc-400">
                      Closed
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={category.id}
                  to="/menu"
                  search={{ category: category.name } as never}
                  className={className}
                >
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-lg font-black text-red-700">
                    {icon}
                  </div>
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
                <div
                  key={coupon.id}
                  className="overflow-hidden rounded-[26px] border border-red-100 bg-white shadow-sm"
                >
                  <div className="bg-red-600 px-4 py-3 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/75">
                      {coupon.category || "Offer"}
                    </div>
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

        <FoodSection
          title="Top picks for you"
          subtitle="Recommended from today's menu"
          items={availableItems}
          onAdd={add}
        />
        <FoodSection
          title="Best sellers"
          subtitle="Most loved by Ankapur Dhaba customers"
          items={bestSellers}
          onAdd={add}
        />
        <FoodSection
          title="Fast delivery"
          subtitle="Fresh plates that reach quickly"
          items={fastDelivery.length ? fastDelivery : availableItems}
          onAdd={add}
        />
        <FoodSection
          title="Chef specials"
          subtitle="Signature dhaba favourites"
          items={chefSpecials}
          onAdd={add}
        />
        <PublishedReviews reviews={data.reviews ?? []} />
      </div>
    </div>
  );
}

function PublishedReviews({ reviews }: { reviews: CustomerReview[] }) {
  const visible = reviews.filter((review) => review.comment?.trim()).slice(0, 12);
  if (!visible.length) return null;
  const loop = [...visible, ...visible];
  return (
    <section className="mt-8 overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,#ef4444_0,#18181b_36%,#050505_100%)] p-5 text-white shadow-2xl shadow-zinc-950/20 ring-1 ring-white/10 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs tracking-[0.24em] text-red-200">OUR REVIEWS</p>
          <h2 className="mt-1 text-2xl font-black md:text-3xl">Foodies are talking</h2>
          <p className="mt-1 text-sm font-semibold text-white/55">
            Real customer love, approved by The Ankapure Dhaba team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SocialPill icon={Instagram} label="Instagram" />
          <SocialPill icon={Youtube} label="YouTube" />
          <SocialPill icon={Facebook} label="Facebook" />
          <div className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-black text-zinc-950">
            {averageReviews(visible)} / 5
          </div>
        </div>
      </div>
      <div className="relative mt-5 h-[330px] overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-zinc-950/95 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-zinc-950/95 to-transparent" />
        <div className="animate-[reviews-scroll_28s_linear_infinite] space-y-3">
          {loop.map((review, index) => (
            <ReviewTile key={`${review.id}-${index}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ReviewTile({ review }: { review: CustomerReview }) {
  const rating =
    ((review.foodRating || 0) + (review.deliveryRating || 0) + (review.packagingRating || 0)) / 3;
  return (
    <article className="group rounded-[24px] border border-white/10 bg-white/10 p-4 shadow-lg shadow-black/10 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/14">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CustomerAvatar name={review.userName || "Happy customer"} />
          <div className="min-w-0">
            <div className="truncate text-sm font-black">{review.userName || "Happy customer"}</div>
            <div className="mt-0.5 text-xs font-semibold text-white/45">
              Order #{review.orderId || "The Ankapure Dhaba"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-yellow-400/15 px-2.5 py-1 text-xs font-black text-yellow-200">
            {rating.toFixed(1)}
          </span>
        </div>
      </div>
      <p className="mt-3 flex gap-2 line-clamp-3 text-sm font-medium leading-6 text-white/72">
        <Quote className="mt-1 h-4 w-4 shrink-0 text-red-200" />
        <span>"{review.comment}"</span>
      </p>
    </article>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 to-yellow-400 text-sm font-black text-white shadow-lg shadow-red-950/25 ring-2 ring-white/20">
      {initials}
    </span>
  );
}

function averageReviews(reviews: CustomerReview[]) {
  if (!reviews.length) return "5.0";
  const avg =
    reviews.reduce(
      (sum, review) =>
        sum +
        ((review.foodRating || 0) + (review.deliveryRating || 0) + (review.packagingRating || 0)) /
          3,
      0,
    ) / reviews.length;
  return avg.toFixed(1);
}
function FoodSection({
  title,
  subtitle,
  items,
  onAdd,
}: {
  title: string;
  subtitle: string;
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <SectionTitle title={title} subtitle={subtitle} action="See all" to="/menu" />
      <div className="-mx-3 mt-3 flex gap-4 overflow-x-auto px-3 pb-3 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-5">
        {items.slice(0, 10).map((item) => (
          <FoodTile key={item.id} item={item} onAdd={() => onAdd(item)} />
        ))}
      </div>
    </section>
  );
}

function FoodTile({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  return (
    <article className="min-w-[230px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl md:min-w-0">
      <Link to="/menu" className="block">
        <div className="relative aspect-[4/3] bg-zinc-100">
          <img
            src={resolveMediaUrl(item.image)}
            alt={item.name}
            loading="lazy"
            onError={imageFallback}
            className="h-full w-full object-cover"
          />
          {item.discountPercent ? (
            <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-2 py-1 text-xs font-black text-zinc-950">
              {item.discountPercent}% OFF
            </span>
          ) : null}
          {item.bestseller ? (
            <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white">
              BEST
            </span>
          ) : null}
          <FavoriteButton
            itemId={item.id}
            itemName={item.name}
            compact
            className="absolute right-3 bottom-3"
          />
        </div>
      </Link>
      <div className="p-4">
        <div className="line-clamp-1 text-base font-black">{item.name}</div>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-zinc-500">
          {item.rating ? (
            <>
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {item.rating}
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
            </>
          ) : null}
          {item.prepTimeMinutes ? (
            <>
              <Clock3 className="h-3.5 w-3.5" /> {item.prepTimeMinutes} min
            </>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-lg font-black">₹{item.price}</div>
            {item.basePrice && item.basePrice > item.price ? (
              <div className="text-xs font-semibold text-zinc-500 line-through">
                ₹{item.basePrice}
              </div>
            ) : null}
          </div>
          <button
            onClick={onAdd}
            disabled={!item.available}
            className="min-h-10 rounded-2xl bg-red-600 px-4 text-sm font-black text-white shadow-lg shadow-red-600/20 disabled:bg-zinc-300"
          >
            ADD
          </button>
        </div>
      </div>
    </article>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 p-3 shadow-sm backdrop-blur-xl sm:p-4">
      <Icon className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
      <div className="mt-1.5 text-[11px] font-semibold text-zinc-500 sm:mt-2 sm:text-xs">
        {label}
      </div>
      <div className="text-sm font-black sm:text-base">{value}</div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
  to,
  search = {},
}: {
  title: string;
  subtitle?: string;
  action?: string;
  to?: string;
  search?: Record<string, unknown>;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-black tracking-tight md:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm font-semibold text-zinc-500">{subtitle}</p> : null}
      </div>
      {action && to && (
        <Link
          to={to}
          search={search}
          className="shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-sm font-black text-red-700"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4">
      <div className="h-24 animate-pulse rounded-[28px] bg-white" />
      <div className="h-[230px] animate-pulse rounded-[26px] bg-zinc-200 md:h-[390px]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 animate-pulse rounded-[22px] bg-white" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white" />
        <div className="h-24 animate-pulse rounded-[22px] bg-white" />
      </div>
    </div>
  );
}

function BannerMedia({ banner }: { banner: CustomerBanner }) {
  const desktopUrl = resolveMediaUrl(banner.image);
  const mobileUrl = resolveMediaUrl(banner.mobileImage || banner.image);
  const url = desktopUrl;
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        autoPlay
        loop
        playsInline
      />
    );
  }
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobileUrl} />
      <img
        src={desktopUrl}
        alt=""
        onError={imageFallback}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}

function isAdBanner(type?: string) {
  return Boolean(type && /ad|sponsor|brand/i.test(type));
}

function storeStatusLabel(status: string, statusMessage?: string | null) {
  if (status === "online") return "Delivering now";
  if (status === "busy") return statusMessage || "Busy right now";
  return statusMessage || "Store paused";
}

function formatStoreTime(value?: string) {
  if (!value) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${minute} ${suffix}`;
}

function heroHeightClasses(banner: CustomerBanner) {
  const mobileHeight =
    banner.heightMobile === "tall"
      ? "min-h-[210px]"
      : banner.heightMobile === "standard"
        ? "min-h-[190px]"
        : "min-h-[170px]";
  const desktopHeight =
    banner.heightDesktop === "tall"
      ? "md:min-h-[430px] lg:min-h-[470px]"
      : banner.heightDesktop === "compact"
        ? "md:min-h-[300px] lg:min-h-[340px]"
        : "md:min-h-[360px] lg:min-h-[410px]";
  return `${mobileHeight} ${desktopHeight}`;
}
