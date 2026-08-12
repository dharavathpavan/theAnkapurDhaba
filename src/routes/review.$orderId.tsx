import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type React from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChefHat,
  Facebook,
  Heart,
  Instagram,
  PackageCheck,
  Send,
  Sparkles,
  Star,
  Truck,
  Youtube,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createCustomerReview, getOrder } from "@/services/api";

export const Route = createFileRoute("/review/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `Review order ${params.orderId} - The Ankapure Dhaba` }] }),
  component: ReviewOrderPage,
});

function ReviewOrderPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [foodRating, setFoodRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [packagingRating, setPackagingRating] = useState(5);
  const [comment, setComment] = useState("");
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
  });

  const itemNames = useMemo(
    () => order?.items.map((item) => `${item.qty} x ${item.name}`).join(", ") || "",
    [order?.items],
  );

  const submit = useMutation({
    mutationFn: () =>
      createCustomerReview({
        orderId,
        foodRating,
        deliveryRating,
        packagingRating,
        comment,
        photos: [],
      }),
    onSuccess: () => {
      toast.success("Thanks for your review");
      navigate({ to: "/orders/$orderId", params: { orderId } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save review"),
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4f2] px-4 py-6">
        <div className="mx-auto max-w-xl space-y-4">
          <div className="h-16 animate-pulse rounded-[24px] bg-white" />
          <div className="h-72 animate-pulse rounded-[28px] bg-white" />
          <div className="h-52 animate-pulse rounded-[28px] bg-white" />
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f4f2] px-4 text-center">
        <div>
          <h1 className="text-3xl font-black">Order not found</h1>
          <Link to="/orders" className="mt-5 inline-flex rounded-2xl bg-red-600 px-5 py-3 font-black text-white">
            View orders
          </Link>
        </div>
      </main>
    );
  }

  const delivered = order.status === "delivered";

  const customerName = order.customer?.name || "Food lover";
  const customerPhone = order.customer?.phone || "";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed_0,#f7f4f2_38%,#f4f4f5_100%)] px-4 pb-24 pt-4 text-zinc-950">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-zinc-500 shadow-sm">
            #{order.id}
          </span>
        </div>

        <section className="mt-5 animate-[review-pop_450ms_ease-out_both] overflow-hidden rounded-[34px] bg-zinc-950 text-white shadow-2xl shadow-zinc-950/20">
          <div className="relative bg-[radial-gradient(circle_at_top_left,#ef4444_0,#18181b_45%,#09090b_100%)] p-6">
            <div className="absolute right-5 top-5 flex gap-2">
              <SocialBubble icon={Instagram} label="Instagram" />
              <SocialBubble icon={Youtube} label="YouTube" />
              <SocialBubble icon={Facebook} label="Facebook" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-red-100">
              <CheckCircle2 className="h-4 w-4" /> Food review
            </div>
            <h1 className="mt-4 text-3xl font-black leading-tight">How was your order?</h1>
            <p className="mt-2 text-sm font-medium text-white/70">
              Your feedback helps us improve every plate from The Ankapure Dhaba.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-white/10 p-3 ring-1 ring-white/10">
              <ReviewAvatar name={customerName} />
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate text-sm font-black">
                  {customerName}
                  <BadgeCheck className="h-4 w-4 shrink-0 text-sky-300" />
                </div>
                <div className="truncate text-xs font-semibold text-white/50">
                  {customerPhone || "The Ankapure Dhaba customer"}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Items</p>
            <p className="mt-2 text-sm font-semibold text-white/85">{itemNames}</p>
            {!delivered ? (
              <p className="mt-4 rounded-2xl bg-yellow-400/15 px-4 py-3 text-sm font-bold text-yellow-100">
                Reviews open after the order is delivered.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-4 animate-[review-pop_520ms_ease-out_90ms_both] rounded-[30px] bg-white p-5 shadow-xl shadow-zinc-200/70 ring-1 ring-zinc-100">
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            <Sparkles className="h-4 w-4" /> Your review may be featured on our website
          </div>
          <RatingRow icon={ChefHat} label="Food taste" value={foodRating} onChange={setFoodRating} />
          <RatingRow icon={Truck} label="Delivery experience" value={deliveryRating} onChange={setDeliveryRating} />
          <RatingRow icon={PackageCheck} label="Packing quality" value={packagingRating} onChange={setPackagingRating} />
          <label className="mt-5 block">
            <span className="text-sm font-black">Write your review</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              maxLength={600}
              placeholder="Tell us what you loved, what can improve, or which dish was your favorite."
              className="mt-2 w-full resize-none rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold outline-none focus:border-red-500 focus:bg-white"
            />
          </label>
          <button
            type="button"
            disabled={!delivered || submit.isPending}
            onClick={() => submit.mutate()}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-red-600 px-5 font-black text-white shadow-lg shadow-red-600/20 transition hover:-translate-y-0.5 hover:bg-red-700 disabled:bg-zinc-300 disabled:shadow-none disabled:hover:translate-y-0"
          >
            <Send className="h-5 w-5" />
            {submit.isPending ? "Saving review..." : "Submit Review"}
          </button>
        </section>
      </div>
    </main>
  );
}

function SocialBubble({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
      <Icon className="h-4 w-4" aria-label={label} />
    </span>
  );
}

function ReviewAvatar({ name }: { name: string }) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 via-orange-400 to-yellow-300 text-sm font-black text-white shadow-lg shadow-red-950/30 ring-2 ring-white/25">
      {initials}
    </span>
  );
}

function RatingRow({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 py-4 first:pt-0 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-black">{label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className="grid h-9 w-9 place-items-center rounded-full transition hover:-translate-y-0.5 hover:bg-yellow-50"
            aria-label={`${label} ${rating} stars`}
          >
            <Star
              className={`h-6 w-6 transition duration-200 ${rating <= value ? "scale-110 fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-zinc-300"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
