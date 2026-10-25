// Times show in the laptop's local time, the same clock the server uses for days.

/** "NBC1234" -> "NBC 1234". Plates that don't fit letters-then-digits stay as they are. */
export function formatPlate(plate: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(plate);
  return match ? `${match[1]} ${match[2]}` : plate;
}

const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** Today's local date as YYYY-MM-DD, for the entry log's date filter. */
export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA").format(now);
}

/** 0 -> "12 AM", 13 -> "1 PM" */
export function formatHour(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

/** "2 h 05 min", "12 min" */
export function formatDuration(fromIso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export const PURPOSES = [
  { value: "delivery", label: "Delivery" },
  { value: "guest", label: "Guest" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
] as const;

export const purposeLabel = (value: string) =>
  PURPOSES.find((p) => p.value === value)?.label ?? value;
