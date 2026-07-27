import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCustomerFavorite,
  listCustomerFavorites,
  removeCustomerFavorite,
} from "@/services/api";
import { useAuth } from "@/stores/auth";

interface FavoriteButtonProps {
  itemId: string;
  itemName?: string;
  className?: string;
  compact?: boolean;
}

export function FavoriteButton({
  itemId,
  itemName = "item",
  className = "",
  compact = false,
}: FavoriteButtonProps) {
  const token = useAuth((state) => state.token);
  const qc = useQueryClient();
  const favoritesQuery = useQuery({
    queryKey: ["customer-favorites"],
    queryFn: listCustomerFavorites,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const isFavorite = Boolean(favoritesQuery.data?.some((favorite) => favorite.itemId === itemId));
  const mutation = useMutation({
    mutationFn: () => (isFavorite ? removeCustomerFavorite(itemId) : addCustomerFavorite(itemId)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["customer-favorites"] });
      toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
    },
    onError: () => toast.error("Could not update favorites"),
  });

  return (
    <button
      type="button"
      aria-label={isFavorite ? `Remove ${itemName} from favorites` : `Save ${itemName} to favorites`}
      aria-pressed={isFavorite}
      disabled={mutation.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!token) {
          toast.error("Login to save favorites");
          return;
        }
        mutation.mutate();
      }}
      className={`grid place-items-center rounded-full bg-white/95 text-red-600 shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:scale-105 disabled:opacity-70 ${
        compact ? "h-9 w-9" : "h-11 w-11"
      } ${className}`}
    >
      <Heart className={`${compact ? "h-4 w-4" : "h-5 w-5"} ${isFavorite ? "fill-red-600" : ""}`} />
    </button>
  );
}
