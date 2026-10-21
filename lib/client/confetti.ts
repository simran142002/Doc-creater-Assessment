"use client";

const COLORS = ["#2E5E4E", "#E39B2D", "#FFF0AE", "#D9734E", "#8E5BB5"];

/** Bigger burst on a person's first share, smaller after. Skipped under reduced motion. */
export async function celebrate(userId: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const key = `ajaia.sharedOnce.${userId}`;
  let big = true;
  try {
    big = !localStorage.getItem(key);
    localStorage.setItem(key, "1");
  } catch {}
  const { default: confetti } = await import("canvas-confetti");
  void confetti({
    particleCount: big ? 120 : 40, spread: big ? 80 : 50, startVelocity: big ? 42 : 30,
    origin: { y: 0.55 }, colors: COLORS, zIndex: 120, scalar: 0.9, disableForReducedMotion: true,
  });
}
