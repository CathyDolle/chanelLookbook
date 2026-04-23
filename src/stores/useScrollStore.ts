"use client";

import Lenis from "lenis";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

const config = {
  lerp: 0.12,
  orientation: "vertical", // vertical, horizontal
  gestureOrientation: "vertical", // vertical, horizontal, both
  wheelMultiplier: 1,
  normalizeWheel: false,
  smoothTouch: false,
} as const;

type ScrollToOptions = Parameters<Lenis["scrollTo"]>[1];

interface ScrollState {
  isLocked: boolean;
  savedScrollY: number;
  setIsLocked: (value: boolean) => void;
  lenis?: Lenis;
  scrollTo: (value: number, options?: ScrollToOptions) => void;
}

const createLenis = () =>
  new Lenis({ ...config, orientation: undefined, gestureOrientation: undefined });

const initialLenis =
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover)").matches
    ? createLenis()
    : undefined;

export const useScrollStore = createWithEqualityFn<ScrollState>()(
  (set, get) => ({
    isLocked: false,
    savedScrollY: 0,
    setIsLocked: (value) => {
      const body = document.body;
      const lenis = get().lenis;
      const isLocked = get().isLocked;

      if (value && !isLocked) {
        const scrollY = lenis?.animatedScroll || window.scrollY;
        lenis?.destroy();

        body.style.position = "fixed";
        body.style.height = `${window.visualViewport?.height}px`;
        body.style.top = `-${scrollY}px`;
        body.style.left = "0";
        body.style.right = "0";

        set(() => ({
          isLocked: value,
          savedScrollY: scrollY,
        }));
        return;
      }

      if (!value && isLocked) {
        body.style.position = "";
        body.style.height = "";
        body.style.top = "";

        if (lenis) set({ lenis: createLenis() });

        if (lenis)
          get().lenis?.scrollTo(get().savedScrollY, { immediate: true, force: true });
        else window.scrollTo(0, get().savedScrollY);

        set(() => ({
          isLocked: value,
          savedScrollY: 0,
        }));
      }
    },
    lenis: initialLenis,
    scrollTo: (value, options) => (get().lenis || window).scrollTo(value, options),
  }),
  shallow,
);
