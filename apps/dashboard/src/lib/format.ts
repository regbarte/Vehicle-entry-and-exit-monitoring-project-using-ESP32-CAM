const MANILA = "Asia/Manila";

/** "NBC1234" -> "NBC 1234". Plates that don't fit letters-then-digits stay as they are. */
export function formatPlate(plate: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(plate);
  return match ? `${match[1]} ${match[2]}` : plate;
}

const timeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  hour: "numeric",
  minute: "2-digit",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** Today's date in Manila as YYYY-MM-DD, for the entry log's date filter. */
export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA }).format(now);
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
