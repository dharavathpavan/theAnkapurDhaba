/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bike, Star } from "lucide-react";
import { toast } from "sonner";
import { rateRider, type Order } from "@/services/api";

export function RiderRatingCard({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const alreadyRated = Boolean(
    order.delivery?.riderRating && Number(order.delivery.riderRating) > 0,
  );
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(alreadyRated);

  const submit = useMutation({
    mutationFn: () => rateRider(order.id, { rating, review: review || undefined }),
    onSuccess: async () => {
      toast.success("Thanks for rating your delivery partner!");
      setSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-history"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-rider-performance"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit rating"),
  });

  if (submitted) {
    return (
      <section className="rounded-[22px] bg-white p-6 text-center shadow-sm ring-1 ring-zinc-100">
        <Bike className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="mt-3 text-lg font-black text-zinc-950">Rider rated</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Thanks for helping {order.delivery?.partnerName || "your delivery partner"}.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[22px] bg-white p-6 shadow-sm ring-1 ring-zinc-100">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-50">
          <Bike className="h-6 w-6 text-red-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-zinc-950">Rate your delivery partner</h2>
          <p className="truncate text-sm text-zinc-500">
            {order.delivery?.partnerName || order.delivery?.assignedRiderName || "Delivery partner"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
          >
            <Star
              className={`h-9 w-9 transition ${
                value <= rating ? "fill-[#FF8A00] text-[#FF8A00]" : "text-zinc-300"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="How was your delivery experience? (optional)"
        rows={2}
        className="mt-4 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium outline-none focus:border-red-300"
      />

      <button
        type="button"
        onClick={() => submit.mutate()}
        disabled={submit.isPending}
        className="mt-3 w-full rounded-2xl bg-red-600 px-5 py-4 font-black text-white shadow-lg shadow-red-600/20 disabled:opacity-50"
      >
        Submit Rating
      </button>
    </section>
  );
}
