import type { MenuItem } from "@/data/menu";
import type { CatalogCategory } from "@/services/api";

export const RESTAURANT_TIME_ZONE = "Asia/Kolkata";

export const DEFAULT_SCHEDULE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type ScheduleDay = (typeof DEFAULT_SCHEDULE_DAYS)[number];

export type TimedAvailabilityRules = {
  scheduled?: boolean;
  startTime?: string;
  endTime?: string;
  days?: ScheduleDay[];
  closedMessage?: string;
};

type AvailabilityResult = {
  available: boolean;
  message: string;
  windowLabel: string;
};

type SchedulableCategory = Pick<CatalogCategory, "id" | "name" | "availabilityRules"> & {
  active?: boolean;
};

const DAY_LABELS: Record<ScheduleDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const WEEKDAY_TO_DAY: Record<string, ScheduleDay> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function normalizeAvailabilityRules(value: unknown): TimedAvailabilityRules {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const days = Array.isArray(raw.days)
    ? raw.days.filter((day): day is ScheduleDay =>
        DEFAULT_SCHEDULE_DAYS.includes(String(day).toLowerCase() as ScheduleDay),
      )
    : [...DEFAULT_SCHEDULE_DAYS];
  return {
    scheduled: Boolean(raw.scheduled),
    startTime: typeof raw.startTime === "string" ? raw.startTime : "05:00",
    endTime: typeof raw.endTime === "string" ? raw.endTime : "12:00",
    days,
    closedMessage: typeof raw.closedMessage === "string" ? raw.closedMessage : "",
  };
}

export function formatAvailabilityWindow(rulesInput: unknown) {
  const rules = normalizeAvailabilityRules(rulesInput);
  const start = formatTime(rules.startTime || "05:00");
  const end = formatTime(rules.endTime || "12:00");
  const days = rules.days?.length === 7 ? "Daily" : (rules.days || []).map((day) => DAY_LABELS[day]).join(", ");
  return `${days}, ${start} - ${end}`;
}

export function isRuleAvailableNow(rulesInput: unknown, now = new Date()): AvailabilityResult {
  const rules = normalizeAvailabilityRules(rulesInput);
  const windowLabel = formatAvailabilityWindow(rules);
  if (!rules.scheduled) return { available: true, message: "", windowLabel };

  const zoned = getKolkataTime(now);
  const days = rules.days?.length ? rules.days : [...DEFAULT_SCHEDULE_DAYS];
  const start = toMinutes(rules.startTime || "05:00");
  const end = toMinutes(rules.endTime || "12:00");
  const current = zoned.minutes;
  const dayAllowed = days.includes(zoned.day);
  const withinTime =
    start <= end ? current >= start && current < end : current >= start || current < end;
  const available = dayAllowed && withinTime;
  return {
    available,
    message: available
      ? ""
      : rules.closedMessage?.trim() || `Available ${windowLabel}`,
    windowLabel,
  };
}

export function isCategoryAvailableNow(category?: SchedulableCategory | null, now = new Date()) {
  if (category && category.active === false) {
    return { available: false, message: "This menu is turned off right now.", windowLabel: "" };
  }
  return isRuleAvailableNow(category?.availabilityRules, now);
}

export function isMenuItemAvailableNow(
  item: Pick<MenuItem, "availabilityRules" | "category" | "categoryId">,
  categories: SchedulableCategory[],
  now = new Date(),
) {
  const itemRules = normalizeAvailabilityRules(item.availabilityRules);
  if (itemRules.scheduled) return isRuleAvailableNow(itemRules, now);
  const category = categories.find(
    (entry) => entry.id === item.categoryId || entry.name === item.category,
  );
  return isCategoryAvailableNow(category, now);
}

function getKolkataTime(date: Date): { day: ScheduleDay; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  return { day: WEEKDAY_TO_DAY[weekday] || "mon", minutes: hour * 60 + minute };
}

function toMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function formatTime(value: string) {
  const [hourRaw = "0", minuteRaw = "0"] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}
