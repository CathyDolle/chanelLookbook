'use client'
import { Container } from "@/components";
import LookbookCard from "@/components/ui/lookbookCard";
import { lookbookImages, type LookbookImageKey } from "@/assets/images";
import lookbook from "@/data/lookbook.json";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export function Lookbook() {
  const spanSteps = useMemo(() => [3, 4, 6, 12] as const, []);

  const [stepIdx, setStepIdx] = useState<number>(0);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const prevRects = useRef<Map<number, DOMRect> | null>(null);
  const lastDesktopGestureAt = useRef<number>(0);

  const pinch = useRef<{
    startDist: number;
    lastActionAt: number;
  }>({ startDist: 0, lastActionAt: 0 });

  const clampStep = (idx: number) =>
    Math.max(0, Math.min(spanSteps.length - 1, idx));

  const isReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const captureRects = () => {
    const map = new Map<number, DOMRect>();
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      map.set(i, el.getBoundingClientRect());
    });
    prevRects.current = map;
  };

  const zoomInAll = () => {
    captureRects();
    setStepIdx((i) => clampStep(i + 1));
  };

  const zoomOutAll = () => {
    captureRects();
    setStepIdx((i) => clampStep(i - 1));
  };

  useEffect(() => {
    // Bloque le zoom navigateur (Ctrl/Cmd +/-/0 et Ctrl/Cmd+wheel/pinch trackpad)
    // pour réutiliser ces gestes pour la resize des cartes.
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const isZoomShortcut =
        (e.ctrlKey || e.metaKey) && (key === "+" || key === "-" || key === "=" || key === "0");
      if (isZoomShortcut) e.preventDefault();

      if (e.repeat) return;
      const k = key.toLowerCase();
      if (k === "a") zoomInAll();
      else if (k === "z") zoomOutAll();
    };

    const onWheel = (e: WheelEvent) => {
      // Sur mac trackpad: pinch => wheel avec ctrlKey=true.
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const now = Date.now();
      if (now - lastDesktopGestureAt.current < 140) return;
      lastDesktopGestureAt.current = now;

      if (e.deltaY < 0) zoomInAll();
      else if (e.deltaY > 0) zoomOutAll();
    };

    const onGesture = (e: Event) => {
      // iOS Safari old gesture events
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("gesturestart", onGesture as EventListener, { passive: false });
    window.addEventListener("gesturechange", onGesture as EventListener, { passive: false });
    window.addEventListener("gestureend", onGesture as EventListener, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("gesturestart", onGesture as EventListener);
      window.removeEventListener("gesturechange", onGesture as EventListener);
      window.removeEventListener("gestureend", onGesture as EventListener);
    };
  }, []);

  useLayoutEffect(() => {
    const first = prevRects.current;
    if (!first) return;
    prevRects.current = null;

    if (isReducedMotion()) return;

    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const firstRect = first.get(i);
      if (!firstRect) return;

      const lastRect = el.getBoundingClientRect();
      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const sx = firstRect.width / lastRect.width;
      const sy = firstRect.height / lastRect.height;

      if (
        !Number.isFinite(dx) ||
        !Number.isFinite(dy) ||
        !Number.isFinite(sx) ||
        !Number.isFinite(sy)
      ) {
        return;
      }

      el.animate(
        [
          {
            transformOrigin: "top left",
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          },
          { transformOrigin: "top left", transform: "none" },
        ],
        {
          duration: 650,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
  }, [stepIdx]);

  const getTouchDist = (
    t1: { clientX: number; clientY: number },
    t2: { clientX: number; clientY: number },
  ) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  return (
    <section className="w-full">
      <Container>
        <div className="flex flex-wrap gutter-gap-1">
          {lookbook.map((item, idx) => (
            <div
              key={`${item.title}-${idx}`}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className={clsx(
                stepIdx === 0 && "span-w-3",
                stepIdx === 1 && "span-w-4",
                stepIdx === 2 && "span-w-6",
                stepIdx === 3 && "span-w-12",
                "touch-none select-none",
              )}
              onTouchStart={(e) => {
                if (e.touches.length !== 2) return;
                pinch.current.startDist = getTouchDist(e.touches[0], e.touches[1]);
                pinch.current.lastActionAt = Date.now();
              }}
              onTouchMove={(e) => {
                if (e.touches.length !== 2) return;
                e.preventDefault();

                const now = Date.now();
                if (now - pinch.current.lastActionAt < 160) return;

                const dist = getTouchDist(e.touches[0], e.touches[1]);
                if (!pinch.current.startDist) return;

                const ratio = dist / pinch.current.startDist;
                if (ratio > 1.12) {
                  zoomInAll();
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                } else if (ratio < 0.88) {
                  zoomOutAll();
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                }
              }}
              onTouchEnd={() => {
                pinch.current.startDist = 0;
              }}
            >
              <LookbookCard
                img={lookbookImages[item.src as LookbookImageKey]}
                title={item.title}
              />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

