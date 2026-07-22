import chickenImg from "@/assets/dish-chicken.jpg";
import muttonImg from "@/assets/dish-mutton.jpg";
import starterImg from "@/assets/dish-starter.jpg";
import paneerImg from "@/assets/dish-paneer.jpg";
import naanImg from "@/assets/dish-naan.jpg";
import dessertImg from "@/assets/dish-dessert.jpg";
import biryaniImg from "@/assets/hero-biryani.jpg";

export type MenuCategory =
  | "Ankapur Specials"
  | "Chicken Specials"
  | "Mutton Specials"
  | "Biryani"
  | "Veg Curries"
  | "Starters"
  | "Breads"
  | "Desserts";

export interface MenuItem {
  id: string;
  name: string;
  displayName?: string | null;
  shortName?: string | null;
  description: string;
  richDescription?: string;
  ingredientsText?: string;
  price: number;
  basePrice?: number;
  offerPrice?: number | null;
  discountPercent?: number;
  category: MenuCategory | string;
  categoryId?: string | null;
  image: string;
  images?: Array<{ id: string; url: string; kind: string; alt?: string | null; sortOrder: number }>;
  isVeg: boolean;
  dietType?: string;
  spiceLevel: 1 | 2 | 3 | number;
  bestseller?: boolean;
  available: boolean;
  prepTimeMinutes?: number;
  tags?: string[];
  nutrition?: Record<string, unknown>;
  packaging?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  sizes?: Array<{
    id: string;
    name: string;
    price: number;
    weight?: string | null;
    serves?: string | null;
    sku?: string | null;
    barcode?: string | null;
    sortOrder: number;
  }>;
  addons?: Array<{ id: string; name: string; price: number; active: boolean; sortOrder: number }>;
  variantGroups?: Array<{
    id: string;
    name: string;
    required: boolean;
    sortOrder: number;
    options: Array<{ id: string; name: string; price: number; active: boolean; sortOrder: number }>;
  }>;
  rating?: number;
  reviewCount?: number;
  orderCount?: number;
  featured?: boolean;
  trending?: boolean;
  pinned?: boolean;
  recentlyAdded?: boolean;
  kitchenStation?: string;
}

export const CATEGORIES: MenuCategory[] = [
  "Ankapur Specials",
  "Chicken Specials",
  "Mutton Specials",
  "Biryani",
  "Veg Curries",
  "Starters",
  "Breads",
  "Desserts",
];

export const MENU: MenuItem[] = [
  {
    id: "ank-chicken",
    name: "Ankapur Chicken",
    description: "Slow-cooked country chicken in roasted coconut, sesame & red chilli masala.",
    price: 340,
    category: "Ankapur Specials",
    image: chickenImg,
    isVeg: false,
    spiceLevel: 3,
    bestseller: true,
    available: true,
  },
  {
    id: "hyd-biryani",
    name: "Hyderabadi Chicken Biryani",
    description: "Dum-cooked basmati layered with saffron, caramelised onions and tender chicken.",
    price: 320,
    category: "Biryani",
    image: biryaniImg,
    isVeg: false,
    spiceLevel: 2,
    bestseller: true,
    available: true,
  },
  {
    id: "mut-rogan",
    name: "Telangana Mutton Curry",
    description: "Bone-in mutton simmered with fiery guntur chillies and roasted spices.",
    price: 420,
    category: "Mutton Specials",
    image: muttonImg,
    isVeg: false,
    spiceLevel: 3,
    bestseller: true,
    available: true,
  },
  {
    id: "chx-65",
    name: "Chicken 65",
    description: "Crispy fried boneless chicken tossed with curry leaves, lemon & green chilli.",
    price: 280,
    category: "Starters",
    image: starterImg,
    isVeg: false,
    spiceLevel: 2,
    available: true,
  },
  {
    id: "pnr-bm",
    name: "Paneer Butter Masala",
    description: "Cottage cheese in a velvety tomato-cashew gravy finished with kasuri methi.",
    price: 260,
    category: "Veg Curries",
    image: paneerImg,
    isVeg: true,
    spiceLevel: 1,
    bestseller: true,
    available: true,
  },
  {
    id: "naan-butter",
    name: "Butter Naan",
    description: "Tandoor-fired naan brushed with cultured butter. Soft, charred, perfect.",
    price: 60,
    category: "Breads",
    image: naanImg,
    isVeg: true,
    spiceLevel: 1,
    available: true,
  },
  {
    id: "gulab",
    name: "Gulab Jamun (2 pc)",
    description: "Warm milk dumplings drowned in cardamom-rose syrup.",
    price: 120,
    category: "Desserts",
    image: dessertImg,
    isVeg: true,
    spiceLevel: 1,
    available: true,
  },
  {
    id: "veg-biryani",
    name: "Veg Dum Biryani",
    description: "Aromatic basmati with garden vegetables, mint and fried onions.",
    price: 240,
    category: "Biryani",
    image: biryaniImg,
    isVeg: true,
    spiceLevel: 2,
    available: true,
  },
];
