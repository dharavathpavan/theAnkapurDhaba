import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Star } from "lucide-react";
import { getCustomerMenu, listCustomerFavorites, removeCustomerFavorite } from "@/services/api";
import { useCart } from "@/stores/cart";
import { imageFallback, resolveMediaUrl } from "@/lib/media";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorites - Ankapur Dhaba" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const qc = useQueryClient();
  const add = useCart((s) => s.add);
  const { data: menu = [] } = useQuery({ queryKey: ["customer-menu"], queryFn: getCustomerMenu });
  const { data: favorites = [] } = useQuery({ queryKey: ["customer-favorites"], queryFn: listCustomerFavorites });
  const remove = useMutation({ mutationFn: removeCustomerFavorite, onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-favorites"] }) });
  const items = menu.filter((item) => favorites.some((fav) => fav.itemId === item.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-3xl font-black md:text-5xl">Favorites</h1>
      {items.length === 0 ? (
        <div className="py-20 text-center">
          <Heart className="mx-auto h-12 w-12 text-zinc-400" />
          <h2 className="mt-4 text-2xl font-black">No favorites yet</h2>
          <p className="mt-1 text-zinc-500">Save dishes you love for quick reorder.</p>
          <Link to="/menu" className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white">Explore menu</Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="flex gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-zinc-100">
              <img src={resolveMediaUrl(item.image)} alt={item.name} onError={imageFallback} className="h-28 w-28 rounded-3xl object-cover" />
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-black">{item.name}</h2>
                <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> {item.rating || 4.6}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xl font-black">₹{item.price}</span>
                  <div className="flex gap-2">
                    <button onClick={() => remove.mutate(item.id)} className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-600">Remove</button>
                    <button onClick={() => add(item)} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white">ADD</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
