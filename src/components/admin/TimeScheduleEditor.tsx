import { Clock3 } from "lucide-react";
import {
  DEFAULT_SCHEDULE_DAYS,
  formatAvailabilityWindow,
  normalizeAvailabilityRules,
  type ScheduleDay,
} from "@/lib/menu-availability";

type Props = {
  value?: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
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

export function TimeScheduleEditor({ value, onChange }: Props) {
  const rules = normalizeAvailabilityRules(value);
  const days = rules.days?.length ? rules.days : [...DEFAULT_SCHEDULE_DAYS];

  function update(patch: Record<string, unknown>) {
    onChange({
      scheduled: rules.scheduled,
      startTime: rules.startTime || "05:00",
      endTime: rules.endTime || "12:00",
      days,
      closedMessage: rules.closedMessage || "",
      ...patch,
    });
  }

  function toggleScheduled(enabled: boolean) {
    if (!enabled) {
      onChange({});
      return;
    }
    onChange({
      scheduled: true,
      startTime: rules.startTime || "05:00",
      endTime: rules.endTime || "12:00",
      days,
      closedMessage:
        rules.closedMessage || `Available ${formatAvailabilityWindow({ ...rules, scheduled: true })}`,
    });
  }

  function toggleDay(day: ScheduleDay) {
    const nextDays = days.includes(day) ? days.filter((entry) => entry !== day) : [...days, day];
    update({ days: nextDays.length ? nextDays : [day] });
  }

  return (
    <section className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-black">
            <Clock3 className="h-4 w-4 text-primary" /> Time Schedule
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Show this menu only during a selected time window.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleScheduled(!rules.scheduled)}
          className={`rounded-full px-4 py-2 text-xs font-black ${
            rules.scheduled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {rules.scheduled ? "Scheduled" : "Always available"}
        </button>
      </div>

      {rules.scheduled ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
                Start time
              </span>
              <input
                type="time"
                value={rules.startTime || "05:00"}
                onChange={(event) => update({ startTime: event.target.value })}
                className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
                End time
              </span>
              <input
                type="time"
                value={rules.endTime || "12:00"}
                onChange={(event) => update({ endTime: event.target.value })}
                className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
              Days
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEFAULT_SCHEDULE_DAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-3 py-2 text-xs font-black ${
                    days.includes(day)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
              Closed message
            </span>
            <input
              value={rules.closedMessage || ""}
              onChange={(event) => update({ closedMessage: event.target.value })}
              placeholder="Tiffins available from 5 AM to 12 PM"
              className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
            Current window: {formatAvailabilityWindow(rules)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
