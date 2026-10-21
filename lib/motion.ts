"use client";

import { useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";

/** CSS `linear()` easing as a JS function (piecewise linear between stops). */
function linearEasing(spec: string) {
  const raw = spec.split(",").map((s) => s.trim().split(/\s+/));
  const pts: { v: number; x: number | null }[] = raw.map(([v, x], i) => ({
    v: +v,
    x: x ? parseFloat(x) / 100 : i === 0 ? 0 : i === raw.length - 1 ? 1 : null,
  }));
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x !== null) continue;
    let j = i;
    while (pts[j].x === null) j++;
    const a = pts[i - 1].x!, b = pts[j].x!, n = j - i + 1;
    for (let k = i; k < j; k++) pts[k].x = a + ((b - a) * (k - i + 1)) / n;
  }
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let i = 1;
    while (pts[i].x! < t) i++;
    const p = pts[i - 1], q = pts[i];
    return q.x === p.x ? q.v : p.v + ((q.v - p.v) * (t - p.x!)) / (q.x! - p.x!);
  };
}

/** Mirrors the prototype's --dur-* / --ease-* tokens. */
export const dur = { 1: 0.12, 2: 0.2, 3: 0.32, 4: 0.52, 5: 0.9 } as const;
export const ease = {
  out: [0.2, 0.8, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
  spring: linearEasing(
    "0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077 21.8%, 1.101 24.3%, 1.104, 1.095 28.2%, 1.031 35.5%, 1.004 40.5%, 0.989 46.2%, 0.996 58.8%, 1 70%, 1",
  ),
} as const;

type Preset = { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition };

const t = (duration: number, e: Transition["ease"], delay = 0): Transition => ({ duration, ease: e, delay });

/** Same keyframes as the prototype's bannerIn/Out, noteDrop/Away, rowIn/Out. */
const presets = {
  banner: {
    initial: { opacity: 0, y: -8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: t(dur[4], ease.spring) },
    exit: { opacity: 0, y: -6, scale: 0.98, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, transition: t(dur[3], ease.inOut) },
  },
  note: {
    initial: { opacity: 0, y: -18, rotate: -8 },
    animate: { opacity: 1, y: 0, rotate: 0, transition: t(dur[5], ease.spring, 0.3) },
    exit: { opacity: 0, x: 40, y: -20, rotate: 12, scale: 0.9, transition: t(dur[4], ease.inOut) },
  },
  row: {
    initial: { opacity: 0, y: -6 },
    animate: { opacity: 1, y: 0, transition: t(dur[4], ease.spring) },
    exit: { opacity: 0, x: 16, height: 0, paddingTop: 0, paddingBottom: 0, transition: t(dur[3], ease.inOut) },
  },
} satisfies Record<string, Preset>;

const instant = { duration: 0.001 };

/** Spread onto a motion element: `<motion.div {...m("banner")} />`. Collapses to instant under reduced motion. */
export function useMotionPreset() {
  const reduce = useReducedMotion();
  return (name: keyof typeof presets, opts: { skipInitial?: boolean } = {}) => {
    const p: Preset = presets[name];
    if (reduce)
      return { initial: false as const, animate: { ...p.animate, transition: instant }, exit: { opacity: 0, transition: instant } };
    return { initial: opts.skipInitial ? (false as const) : p.initial, animate: p.animate, exit: p.exit };
  };
}
