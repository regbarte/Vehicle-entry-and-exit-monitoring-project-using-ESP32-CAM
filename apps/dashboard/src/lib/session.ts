// The role and subdivision live in localStorage only. The API has no auth, so this
// is a convenience, not access control.

export type Role = "guard" | "hoa" | "provider";

export const ROLE_LABEL: Record<Role, string> = {
  guard: "Guard",
  hoa: "HOA officer",
  provider: "Provider",
};

type Session = { role: Role; subdivisionId?: string; subdivisionName?: string };

const KEY = "guardhouse.session";

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can block storage; the app still works for this visit.
  }
}

export function homePath(session: Session): string {
  if (session.role === "provider") return "/provider";
  if (!session.subdivisionId) return `/pick/${session.role}`;
  return session.role === "guard"
    ? `/guard/${session.subdivisionId}/gate`
    : `/hoa/${session.subdivisionId}/overview`;
}
