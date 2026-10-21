const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** "just now", "26 min ago", "2 h ago", "3 d ago", then a short date (matches the prototype). */
export function ago(iso: string, now = Date.now()) {
  const t = Date.parse(iso);
  const s = (now - t) / 1000;
  if (s < 45) return "just now";
  if (now - t < HOUR) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (now - t < DAY) return `${Math.round((now - t) / HOUR)} h ago`;
  if (now - t < 7 * DAY) return `${Math.round((now - t) / DAY)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const firstName = (name: string) => name.split(/\s+/)[0];
export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "Priya", "Priya and Leo", "Priya and 2 others". */
export const namesOf = (names: string[]) =>
  names.length <= 1 ? firstName(names[0] ?? "Someone")
    : names.length === 2 ? `${firstName(names[0])} and ${firstName(names[1])}`
      : `${firstName(names[0])} and ${names.length - 1} others`;

const SEEDED: Record<string, string> = { Aarav: "#D9734E", Priya: "#8E5BB5", Leo: "#3E8A86" };
const PALETTE = ["#D9734E", "#8E5BB5", "#3E8A86", "#5A57A6", "#B5654A", "#2E5E4E", "#A0742B"];

/** Prototype avatar colours for the seeded people; a stable pick from the same family for anyone else. */
export function avatarColor(name: string) {
  const seeded = SEEDED[firstName(name)];
  if (seeded) return seeded;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;
