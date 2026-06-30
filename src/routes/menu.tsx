import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock3, Flame, Heart, Leaf, Minus, Plus, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { addCustomerFavorite, getCustomerHome, getCustomerMenu } from "@/services/api";
import { useCart } from "@/stores/cart";
import type { MenuItem } from "@/data/menu";
import { toast } from "sonner";

export const Route = createFileRoute("/menu")({
  validateSearch: (search: Record<string, unknown>) => ({ category: typeof search.category === "string" ? search.category : undefined }),
  head: () => ({
    meta: [
      { title: "Menu - Ankapur Dhaba" },
      { name: "description", content: "Browse Ankapur Dhaba menu with biryani, chicken, mutton, veg curries, breads and desserts." },
    ],
  }),
  component: MenuPage,
});

type Diet = "all" | "veg" | "nonveg";

function MenuPage() {
  const searchParams = Route.useSearch();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["customer-menu"], queryFn: getCustomerMenu, staleTime: 30_000 });
  const { data: home } = useQuery({ queryKey: ["customer-home"], queryFn: getCustomerHome, staleTime: 30_000 });
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(searchParams.category || "All");
  const [diet, setDiet] = useState<Diet>("all");
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const add = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);

  const categories = useMemo(() => ["All", ...(home?.categories.map((c) => c.name) ?? Array.from(new Set(items.map((i) => i.category))))], [home, items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory) return false;
      if (diet === "veg" && !item.isVeg) return false;
      if (diet === "nonveg" && item.isVeg) return false;
      if (q && ![item.name, item.description, item.category, ...(item.tags || [])].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, activeCategory, diet, query]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4 md:px-6 md:py-8">
      <header className="mb-4 md:mb-5">
        <div className="text-xs font-black uppercase tracking-[0.25em] text-red-600">Menu</div>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl md:text-5xl">What are you craving?</h1>
      </header>

      <div className="sticky top-0 z-30 -mx-3 bg-[#F8F9FB]/95 px-3 py-2.5 backdrop-blur sm:-mx-4 sm:px-4 md:top-0 md:mx-0 md:rounded-3xl md:py-3">
        <div className="flex h-12 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-zinc-100 md:h-14 md:rounded-3xl">
          <Search className="h-5 w-5 text-zinc-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dishes, tags, categories" className="min-w-0 flex-1 bg-transparent text-base outline-none" />
          <SlidersHorizontal className="h-5 w-5 text-zinc-400" />
        </div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 md:mt-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`whitespace-nowrap rounded-2xl px-3.5 py-2 text-xs font-black sm:text-sm ${activeCategory === category ? "bg-red-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-100"}`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2 md:mt-3">
          {(["all", "veg", "nonveg"] as Diet[]).map((value) => (
            <button key={value} onClick={() => setDiet(value)} className={`rounded-2xl px-4 py-2 text-xs font-black ${diet === value ? "bg-green-600 text-white" : "bg-white text-zinc-600"}`}>
              {value === "all" ? "All" : value === "veg" ? "Veg" : "Non Veg"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 grid gap-3 md:mt-5 md:grid-cols-2 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">No dishes match your filters.</div>
      ) : (
        <div className="mt-4 grid gap-3 md:mt-5 md:grid-cols-2 md:gap-4">
          {filtered.map((item) => {
            const line = lines.find((l) => l.id === item.id);
            return <MenuCard key={item.id} item={item} qty={line?.qty || 0} onOpen={() => setSelected(item)} onAdd={() => item.sizes?.length || item.addons?.length || item.variantGroups?.length ? setSelected(item) : add(item)} />;
          })}
        </div>
      )}

      {selected && <ItemSheet item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MenuCard({ item, qty, onOpen, onAdd }: { item: MenuItem; qty: number; onOpen: () => void; onAdd: () => void }) {
  return (
    <article className="grid grid-cols-[1fr_112px] gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 sm:grid-cols-[1fr_132px] sm:rounded-3xl md:grid-cols-[1fr_170px]">
      <button onClick={onOpen} className="min-w-0 text-left">
        <div className="flex flex-wrap gap-2">
          <Badge tone={item.isVeg ? "veg" : "nonveg"}>{item.isVeg ? "Veg" : "Non Veg"}</Badge>
          {item.bestseller && <Badge tone="hot">Best Seller</Badge>}
          {item.tags?.slice(0, 1).map((tag) => <Badge key={tag} tone="plain">{tag}</Badge>)}
        </div>
        <h2 className="mt-2 line-clamp-2 text-base font-black sm:mt-3 sm:text-lg">{item.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {item.rating || 4.6}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.prepTimeMinutes || 20} min</span>
          <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-red-500" /> Spice {item.spiceLevel}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-zinc-500 sm:text-sm">{item.description}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-lg font-black sm:text-xl">₹{item.price}</span>
          {item.basePrice && item.basePrice > item.price && <span className="text-sm text-zinc-400 line-through">₹{item.basePrice}</span>}
          {item.discountPercent ? <span className="text-xs font-black text-green-600">{item.discountPercent}% OFF</span> : null}
        </div>
      </button>
      <div className="relative">
        <button onClick={onOpen} className="block aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100 sm:rounded-3xl">
          <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        </button>
        <button onClick={onAdd} disabled={!item.available} className="absolute -bottom-2 left-1/2 min-w-20 -translate-x-1/2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-red-600 shadow-lg ring-1 ring-red-100 disabled:text-zinc-400 sm:min-w-24 sm:px-4 sm:text-sm">
          {qty > 0 ? `${qty} ADDED` : item.available ? "ADD" : "SOLD OUT"}
        </button>
      </div>
    </article>
  );
}

function ItemSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const [size, setSize] = useState(item.sizes?.[0]?.id || "");
  const [addons, setAddons] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const selectedSize = item.sizes?.find((s) => s.id === size);
  const selectedAddons = item.addons?.filter((a) => addons.includes(a.id)).map((a) => ({ id: a.id, name: a.name, price: a.price })) || [];
  const selectedVariants = item.variantGroups?.map((group) => {
    const option = group.options.find((o) => o.id === variants[group.id]) || group.options[0];
    return option ? { group: group.name, option: option.name, price: option.price } : null;
  }).filter(Boolean) as Array<{ group: string; option: string; price: number }>;
  const price = (selectedSize?.price ?? item.price) + selectedAddons.reduce((s, a) => s + a.price, 0) + selectedVariants.reduce((s, v) => s + v.price, 0);

  function addConfigured() {
    add(item, {
      price,
      name: selectedSize ? `${item.name} (${selectedSize.name})` : item.name,
      size: selectedSize?.name,
      addons: selectedAddons,
      variants: selectedVariants,
      instructions,
    });
    onClose();
  }

  async function saveFavorite() {
    try {
      await addCustomerFavorite(item.id);
      toast.success("Added to favorites");
    } catch {
      toast.error("Sign in to save favorites");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-[#F8F9FB] shadow-2xl md:left-1/2 md:top-1/2 md:max-h-[88vh] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[32px]">
        <div className="relative aspect-[16/10] bg-zinc-100">
          <img src={item.images?.[0]?.url || item.image} alt={item.name} className="h-full w-full object-cover" />
          <button onClick={onClose} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90"><X className="h-5 w-5" /></button>
          <button onClick={saveFavorite} className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-red-600"><Heart className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <h2 className="text-2xl font-black">{item.name}</h2>
            <p className="mt-2 text-sm text-zinc-600">{item.richDescription || item.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <Badge tone={item.isVeg ? "veg" : "nonveg"}>{item.isVeg ? "Veg" : "Non Veg"}</Badge>
              <Badge tone="plain">{item.prepTimeMinutes || 20} min</Badge>
              <Badge tone="plain">{item.kitchenStation || "Main Course"}</Badge>
            </div>
          </div>

          {item.sizes?.length ? (
            <OptionBlock title="Choose size">
              {item.sizes.map((s) => (
                <button key={s.id} onClick={() => setSize(s.id)} className={`flex items-center justify-between rounded-2xl p-4 text-left ${size === s.id ? "bg-red-50 ring-2 ring-red-500" : "bg-white"}`}>
                  <span className="font-bold">{s.name}<span className="ml-2 text-xs text-zinc-500">{s.serves}</span></span>
                  <span className="font-black">₹{s.price}</span>
                </button>
              ))}
            </OptionBlock>
          ) : null}

          {item.variantGroups?.map((group) => (
            <OptionBlock key={group.id} title={group.name}>
              {group.options.map((option) => (
                <button key={option.id} onClick={() => setVariants((v) => ({ ...v, [group.id]: option.id }))} className={`flex items-center justify-between rounded-2xl p-4 text-left ${(variants[group.id] || group.options[0]?.id) === option.id ? "bg-green-50 ring-2 ring-green-500" : "bg-white"}`}>
                  <span className="font-bold">{option.name}</span>
                  <span className="font-black">{option.price ? `+₹${option.price}` : "Free"}</span>
                </button>
              ))}
            </OptionBlock>
          ))}

          {item.addons?.length ? (
            <OptionBlock title="Add extras">
              {item.addons.map((addon) => (
                <button key={addon.id} onClick={() => setAddons((curr) => curr.includes(addon.id) ? curr.filter((id) => id !== addon.id) : [...curr, addon.id])} className={`flex items-center justify-between rounded-2xl p-4 text-left ${addons.includes(addon.id) ? "bg-yellow-50 ring-2 ring-yellow-400" : "bg-white"}`}>
                  <span className="font-bold">{addon.name}</span>
                  <span className="font-black">+₹{addon.price}</span>
                </button>
              ))}
            </OptionBlock>
          ) : null}

          <label className="block">
            <span className="text-sm font-black">Special instructions</span>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="No onion, less spicy, extra masala..." className="mt-2 w-full rounded-3xl border border-zinc-200 bg-white p-4 outline-none focus:border-red-400" rows={3} />
          </label>

          <button onClick={addConfigured} disabled={!item.available} className="sticky bottom-4 flex min-h-14 w-full items-center justify-between rounded-3xl bg-red-600 px-5 font-black text-white shadow-xl shadow-red-600/25 disabled:bg-zinc-300">
            <span>Add item</span>
            <span>₹{price}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 font-black">{title}</h3><div className="space-y-2">{children}</div></section>;
}

function Badge({ tone, children }: { tone: "veg" | "nonveg" | "hot" | "plain"; children: React.ReactNode }) {
  const cls = tone === "veg" ? "bg-green-50 text-green-700" : tone === "nonveg" ? "bg-red-50 text-red-700" : tone === "hot" ? "bg-yellow-100 text-yellow-800" : "bg-zinc-100 text-zinc-600";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${cls}`}>{tone === "veg" && <Leaf className="h-3 w-3" />}{children}</span>;
}
