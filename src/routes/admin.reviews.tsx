import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Instagram,
  MessageSquareText,
  Search,
  Share2,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listAdminReviews,
  updateAdminReview,
  type CustomerReview,
} from "@/services/api";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews - The Ankapure Dhaba Admin" }] }),
  component: AdminReviewsPage,
});

type ReviewStatus = "all" | "pending" | "published";

function AdminReviewsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>("all");
  const [query, setQuery] = useState("");
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews", status],
    queryFn: () => listAdminReviews(status),
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reviews;
    return reviews.filter((review) =>
      `${review.orderId ?? ""} ${review.userName ?? ""} ${review.userPhone ?? ""} ${review.comment}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, reviews]);

  const publish = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      updateAdminReview(id, { published }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["customer-home"] });
      toast.success("Review updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update review"),
  });

  const metrics = {
    total: reviews.length,
    published: reviews.filter((review) => review.published).length,
    pending: reviews.filter((review) => !review.published).length,
    avg:
      reviews.length > 0
        ? (reviews.reduce((sum, review) => sum + averageRating(review), 0) / reviews.length).toFixed(1)
        : "0.0",
  };

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <section className="rounded-[30px] border border-white/10 bg-[#151013] p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.24em] text-red-300">CUSTOMER VOICE</p>
            <h1 className="mt-1 text-3xl font-black">Food Reviews</h1>
            <p className="mt-1 text-sm text-white/55">
              Review customer feedback and publish the best comments to the home page.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Total" value={metrics.total} />
            <Metric label="Published" value={metrics.published} />
            <Metric label="Pending" value={metrics.pending} />
            <Metric label="Avg" value={metrics.avg} />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-white/10 bg-[#151013] p-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "published"] as ReviewStatus[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-2xl px-4 py-2 text-sm font-black capitalize ${
                status === item ? "bg-red-600 text-white" : "bg-white/8 text-white/65"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="mt-4 flex h-13 items-center gap-3 rounded-2xl bg-black/30 px-4 text-white ring-1 ring-white/10">
          <Search className="h-4 w-4 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, customer, phone or review..."
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
          />
        </label>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[24px] bg-white/5" />
            ))
          ) : filtered.length ? (
            filtered.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                busy={publish.isPending}
                onToggle={() => publish.mutate({ id: review.id, published: !review.published })}
              />
            ))
          ) : (
            <div className="rounded-[24px] bg-white/5 p-6 text-sm font-semibold text-white/45">
              No reviews found.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ReviewCard({
  review,
  busy,
  onToggle,
}: {
  review: CustomerReview;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="group animate-[review-pop_420ms_ease-out_both] rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),rgba(0,0,0,0.26)_42%,rgba(0,0,0,0.36))] p-5 text-white shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-red-400/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <AdminReviewAvatar name={review.userName || "Customer"} />
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Rating value={averageRating(review)} />
                <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black uppercase text-white/55">
                  #{review.orderId || "Order"}
                </span>
              </div>
              <h2 className="mt-3 flex items-center gap-1 truncate text-lg font-black">
                {review.userName || "Customer"}
                <BadgeCheck className="h-4 w-4 shrink-0 text-sky-300" />
              </h2>
              <p className="text-xs font-semibold text-white/45">
                {review.userPhone || "No phone"} - {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            review.published ? "bg-green-500/15 text-green-200" : "bg-yellow-400/15 text-yellow-100"
          }`}
        >
          {review.published ? "Published" : "Pending"}
        </span>
      </div>
      <p className="mt-4 min-h-16 rounded-2xl bg-white/5 p-4 text-sm font-medium text-white/75">
        {review.comment || "No written comment. Customer submitted star ratings only."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs font-black text-white/55">
          <Instagram className="h-3.5 w-3.5" /> App review
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs font-black text-white/55">
          <Share2 className="h-3.5 w-3.5" /> Website ready
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini label="Food" value={review.foodRating} />
        <Mini label="Delivery" value={review.deliveryRating} />
        <Mini label="Packing" value={review.packagingRating} />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-black ${
          review.published ? "bg-white/10 text-white" : "bg-red-600 text-white shadow-lg shadow-red-950/30"
        } disabled:opacity-60`}
      >
        {review.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {review.published ? "Unpublish" : "Publish on website"}
      </button>
    </article>
  );
}

function AdminReviewAvatar({ name }: { name: string }) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 to-yellow-400 text-sm font-black text-white shadow-lg shadow-red-950/30 ring-2 ring-white/15">
      {initials}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-yellow-400/15 px-2.5 py-1 text-yellow-200">
      <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
      <span className="text-sm font-black">{value.toFixed(1)}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[92px] rounded-2xl bg-white/8 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <MessageSquareText className="mx-auto h-4 w-4 text-red-300" />
      <div className="mt-1 text-xs font-black text-white/45">{label}</div>
      <div className="text-lg font-black">{value}/5</div>
    </div>
  );
}

function averageRating(review: CustomerReview) {
  return (Number(review.foodRating || 0) + Number(review.deliveryRating || 0) + Number(review.packagingRating || 0)) / 3;
}
