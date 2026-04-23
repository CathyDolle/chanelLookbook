"use client";

export const SPAN_STEPS = [3, 4, 6, 12] as const;
export const GUTTER_STEPS = ["xs", "s", "m", "l"] as const;

export const FOCUS_ZOOM_MS = 1400;
export const FOCUS_ZOOM_EASE = "cubic-bezier(.22,1,.36,1)";

export const PINCH_COOLDOWN_MS = 90;
export const PINCH_IN_THRESHOLD = 0.95; // plus sensible (zoom out)
export const PINCH_OUT_THRESHOLD = 1.05; // plus sensible (zoom in)

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);

export const isReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export const getTouchDist = (
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number },
) => {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
};

