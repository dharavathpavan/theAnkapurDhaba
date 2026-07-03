import chickenImg from "@/assets/dish-chicken.jpg";
import type React from "react";
import dessertImg from "@/assets/dish-dessert.jpg";
import muttonImg from "@/assets/dish-mutton.jpg";
import naanImg from "@/assets/dish-naan.jpg";
import paneerImg from "@/assets/dish-paneer.jpg";
import starterImg from "@/assets/dish-starter.jpg";
import biryaniImg from "@/assets/hero-biryani.jpg";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";

const assetMap: Record<string, string> = {
  "/assets/dish-chicken.jpg": chickenImg,
  "/dish-chicken.jpg": chickenImg,
  "dish-chicken.jpg": chickenImg,
  "/assets/dish-dessert.jpg": dessertImg,
  "/dish-dessert.jpg": dessertImg,
  "dish-dessert.jpg": dessertImg,
  "/assets/dish-mutton.jpg": muttonImg,
  "/dish-mutton.jpg": muttonImg,
  "dish-mutton.jpg": muttonImg,
  "/assets/dish-naan.jpg": naanImg,
  "/dish-naan.jpg": naanImg,
  "dish-naan.jpg": naanImg,
  "/assets/dish-paneer.jpg": paneerImg,
  "/dish-paneer.jpg": paneerImg,
  "dish-paneer.jpg": paneerImg,
  "/assets/dish-starter.jpg": starterImg,
  "/dish-starter.jpg": starterImg,
  "dish-starter.jpg": starterImg,
  "/assets/hero-biryani.jpg": biryaniImg,
  "/hero-biryani.jpg": biryaniImg,
  "hero-biryani.jpg": biryaniImg,
};

export const fallbackFoodImage = biryaniImg;

export function resolveMediaUrl(src?: string | null) {
  if (!src) return fallbackFoodImage;
  const clean = src.trim();
  if (!clean) return fallbackFoodImage;
  if (assetMap[clean]) return assetMap[clean];
  if (/^(https?:|data:|blob:)/i.test(clean)) return clean;
  if (clean.startsWith("/assets/")) return clean;
  if (clean.startsWith("/uploads/")) return backendAssetUrl(clean);
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function backendAssetUrl(path: string) {
  if (!apiBase || apiBase.includes("functions/v1")) return path;
  try {
    return `${new URL(apiBase).origin}${path}`;
  } catch {
    return path;
  }
}

export function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src !== fallbackFoodImage) {
    event.currentTarget.src = fallbackFoodImage;
  }
}

export function isVideoUrl(url?: string | null) {
  return Boolean(url && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url));
}
