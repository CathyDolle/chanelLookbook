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
  const [gridKey, setGridKey] = useState<number>(0);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const reloadTimer = useRef<number | null>(null);
  const stepIdxRef = useRef<number>(0);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lastDesktopGestureAt = useRef<number>(0);
  const pendingScrollY = useRef<number | null>(null);
  const scrollLockUntil = useRef<number>(0);
  const isPinching = useRef<boolean>(false);
  const prevBodyTouchAction = useRef<string | null>(null);

  const pinch = useRef<{
    startDist: number;
    lastActionAt: number;
  }>({ startDist: 0, lastActionAt: 0 });

  const PINCH_COOLDOWN_MS = 90;
  const PINCH_IN_THRESHOLD = 0.95; // plus sensible (zoom out)
  const PINCH_OUT_THRESHOLD = 1.05; // plus sensible (zoom in)

  const clampStep = (idx: number) =>
    Math.max(0, Math.min(spanSteps.length - 1, idx));

  const isReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const shouldLockScrollY = () =>
    isPinching.current || Date.now() < scrollLockUntil.current;

  const requestZoom = (delta: 1 | -1) => {
    const next = clampStep(stepIdxRef.current + delta);
    // Si on est déjà au min/max, on ne retrigger rien.
    if (next === stepIdxRef.current) return;

    if (typeof window !== "undefined" && shouldLockScrollY()) {
      pendingScrollY.current = window.scrollY;
    } else pendingScrollY.current = null;

    setIsReloading(true);
    setStepIdx(next);
    setGridKey((k) => k + 1);

    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      setIsReloading(false);
    }, 260);
  };

  const zoomInAll = () => requestZoom(1);
  const zoomOutAll = () => requestZoom(-1);

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
      // Pendant un pinch trackpad, on verrouille temporairement le scroll Y.
      scrollLockUntil.current = now + 320;

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
    const y = pendingScrollY.current;
    if (typeof y === "number") {
      pendingScrollY.current = null;
      // Restaure uniquement pendant le pinch/zoom gesture (sinon on laisse scroller normalement).
      if (shouldLockScrollY() && Math.abs(window.scrollY - y) > 1) {
        window.scrollTo({ top: y });
      }
    }
  }, [stepIdx]);

  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Plus d'animations sur resize.
    return;
  }, []);

  useEffect(() => {
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    };
  }, []);

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
        <div
          key={gridKey}
          className="flex flex-wrap gutter-gap-1"
          style={{
            overflowAnchor: "none",
            opacity: isReloading ? 0.55 : 1,
            transition: isReducedMotion()
              ? undefined
              : "opacity 260ms cubic-bezier(0.2, 0.9, 0.2, 1)",
          }}
        >
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
                // Laisse le scroll vertical sur mobile.
                "touch-pan-y select-none",
              )}
              onTouchStart={(e) => {
                if (e.touches.length !== 2) return;
                isPinching.current = true;
                scrollLockUntil.current = Date.now() + 600;
                if (prevBodyTouchAction.current === null) {
                  prevBodyTouchAction.current = document.body.style.touchAction || "";
                }
                // Bloque le pan/scroll pendant le pinch, puis on restaure à la fin.
                document.body.style.touchAction = "none";
                pinch.current.startDist = getTouchDist(e.touches[0], e.touches[1]);
                pinch.current.lastActionAt = Date.now();
              }}
              onTouchMove={(e) => {
                if (e.touches.length !== 2) return;
                e.preventDefault();

                const now = Date.now();
                if (now - pinch.current.lastActionAt < PINCH_COOLDOWN_MS) return;

                const dist = getTouchDist(e.touches[0], e.touches[1]);
                if (!pinch.current.startDist) return;

                const ratio = dist / pinch.current.startDist;
                if (ratio > PINCH_OUT_THRESHOLD) {
                  zoomInAll();
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                } else if (ratio < PINCH_IN_THRESHOLD) {
                  zoomOutAll();
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                }
              }}
              onTouchEnd={() => {
                pinch.current.startDist = 0;
                isPinching.current = false;
                scrollLockUntil.current = Date.now() + 120;
                if (prevBodyTouchAction.current !== null) {
                  document.body.style.touchAction = prevBodyTouchAction.current;
                  prevBodyTouchAction.current = null;
                }
              }}
              onTouchCancel={() => {
                pinch.current.startDist = 0;
                isPinching.current = false;
                scrollLockUntil.current = Date.now() + 120;
                if (prevBodyTouchAction.current !== null) {
                  document.body.style.touchAction = prevBodyTouchAction.current;
                  prevBodyTouchAction.current = null;
                }
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

