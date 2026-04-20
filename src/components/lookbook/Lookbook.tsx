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
  const pendingFocus = useRef<{
    idx: number;
    clientY: number;
  } | null>(null);

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

  const findCardIndexAtPoint = (clientX: number, clientY: number) => {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el) return null;
    const card = el.closest?.("[data-lookbook-idx]") as HTMLElement | null;
    if (!card) return null;
    const raw = card.getAttribute("data-lookbook-idx");
    const idx = raw ? Number(raw) : NaN;
    return Number.isFinite(idx) ? idx : null;
  };

  const setFocusFromPoint = (clientX: number, clientY: number) => {
    const idx = findCardIndexAtPoint(clientX, clientY);
    if (idx === null) return;
    pendingFocus.current = { idx, clientY };
  };

  const requestZoom = (delta: 1 | -1, focusPoint?: { clientX: number; clientY: number }) => {
    const next = clampStep(stepIdxRef.current + delta);
    // Si on est déjà au min/max, on ne retrigger rien.
    if (next === stepIdxRef.current) return;

    if (focusPoint) setFocusFromPoint(focusPoint.clientX, focusPoint.clientY);

    setIsReloading(true);
    setStepIdx(next);
    setGridKey((k) => k + 1);

    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      setIsReloading(false);
    }, 260);
  };

  const zoomInAll = (focusPoint?: { clientX: number; clientY: number }) => requestZoom(1, focusPoint);
  const zoomOutAll = (focusPoint?: { clientX: number; clientY: number }) => requestZoom(-1, focusPoint);

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

      const focusPoint = { clientX: e.clientX, clientY: e.clientY };
      if (e.deltaY < 0) zoomInAll(focusPoint);
      else if (e.deltaY > 0) zoomOutAll(focusPoint);
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
    // Re-centre le zoom/dézoom sur la carte "sous les doigts / le curseur".
    const focus = pendingFocus.current;
    if (!focus) return;
    pendingFocus.current = null;

    const el = cardRefs.current[focus.idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deltaY = rect.top - focus.clientY;
    if (Math.abs(deltaY) > 1) window.scrollTo({ top: window.scrollY + deltaY });
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
              data-lookbook-idx={idx}
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
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                setFocusFromPoint(midX, midY);
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
                  const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                  const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                  zoomInAll({ clientX: midX, clientY: midY });
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                } else if (ratio < PINCH_IN_THRESHOLD) {
                  const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                  const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                  zoomOutAll({ clientX: midX, clientY: midY });
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                }
              }}
              onTouchEnd={() => {
                pinch.current.startDist = 0;
              }}
              onTouchCancel={() => {
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

