'use client'
import { Container } from "@/components";
import LookbookCard from "@/components/ui/lookbookCard";
import { lookbookImages, type LookbookImageKey } from "@/assets/images";
import lookbook from "@/data/lookbook.json";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export function Lookbook() {
  const spanSteps = useMemo(() => [3, 4, 6, 12] as const, []);
  const gutterSteps = useMemo(() => ["xs", "s", "m", "l"] as const, []);

  // Vue par défaut: 2 items par ligne (équivalent "w/2")
  const [stepIdx, setStepIdx] = useState<number>(2);
  const stepIdxRef = useRef<number>(2);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastDesktopGestureAt = useRef<number>(0);
  const pendingFocus = useRef<{
    idx: number;
    desiredViewportY: number;
    anchorY: number; // 0..1 dans la card
  } | null>(null);

  const pinch = useRef<{
    startDist: number;
    lastActionAt: number;
    targetIdx: number | null;
    anchorY: number;
    desiredViewportY: number;
  }>({ startDist: 0, lastActionAt: 0, targetIdx: null, anchorY: 0.5, desiredViewportY: 0 });

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

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const computeDesiredViewportY = (clientY: number) => {
    // La target doit rester dans la même "zone" que le doigt / curseur.
    // On garde donc le Y de départ, avec une petite marge pour éviter d'être hors-écran.
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    if (!vh) return clientY;
    const margin = 16;
    return clamp(clientY, margin, vh - margin);
  };

  const setFocusLocked = (idx: number, clientY: number, anchorY: number) => {
    pendingFocus.current = {
      idx,
      desiredViewportY: computeDesiredViewportY(clientY),
      anchorY: clamp01(anchorY),
    };
  };

  const setFocusFromPoint = (clientX: number, clientY: number) => {
    const idx = findCardIndexAtPoint(clientX, clientY);
    if (idx === null) return;
    const el = cardRefs.current[idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorY = rect.height ? (clientY - rect.top) / rect.height : 0.5;
    setFocusLocked(idx, clientY, anchorY);
  };

  const requestZoomTo = (
    next: number,
    focusPoint?: { clientX: number; clientY: number },
    locked?: { idx: number; clientY: number; anchorY: number },
  ) => {
    const clamped = clampStep(next);
    if (clamped === stepIdxRef.current) return;
    // Si le pinch est actif, ne jamais repicker une autre card pendant le reflow.
    if (locked) setFocusLocked(locked.idx, locked.clientY, locked.anchorY);
    else if (focusPoint) setFocusFromPoint(focusPoint.clientX, focusPoint.clientY);
    setStepIdx(clamped);
  };

  const zoomInAll = (
    focusPoint?: { clientX: number; clientY: number },
    locked?: { idx: number; clientY: number; anchorY: number },
  ) => requestZoomTo(stepIdxRef.current + 1, focusPoint, locked);
  const zoomOutAll = (
    focusPoint?: { clientX: number; clientY: number },
    locked?: { idx: number; clientY: number; anchorY: number },
  ) => requestZoomTo(stepIdxRef.current - 1, focusPoint, locked);

  useEffect(() => {
    // Au refresh, repartir toujours en haut de la page.
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

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
    const anchorClientY = rect.top + rect.height * focus.anchorY;
    const deltaY = anchorClientY - focus.desiredViewportY;
    if (Math.abs(deltaY) > 1) window.scrollTo({ top: window.scrollY + deltaY });
  }, [stepIdx]);

  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);

  useEffect(() => {
    // Rend la gouttière globale (toute la page), pas juste le composant.
    const key = gutterSteps[stepIdx] ?? "m";
    const root = document.documentElement;
    root.classList.remove("gutter-gap-xs", "gutter-gap-s", "gutter-gap-m", "gutter-gap-l");
    root.classList.add(`gutter-gap-${key}`);

    return () => {
      root.classList.remove("gutter-gap-xs", "gutter-gap-s", "gutter-gap-m", "gutter-gap-l");
      root.classList.add("gutter-gap-m");
    };
  }, [stepIdx, gutterSteps]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Plus d'animations sur resize.
    return;
  }, []);

  const getTouchDist = (
    t1: { clientX: number; clientY: number },
    t2: { clientX: number; clientY: number },
  ) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const itemsPerRow = stepIdx === 0 ? 4 : stepIdx === 1 ? 3 : stepIdx === 2 ? 2 : 1;
  const cardBasis =
    itemsPerRow === 1
      ? "100%"
      : `calc((100% - ${(itemsPerRow - 1)} * var(--gutter-gap, 5px)) / ${itemsPerRow})`;

  return (
    <section className="w-full">
      <Container>
        <div
          ref={gridRef}
          className={clsx(
            "flex flex-wrap gutter-gap",
          )}
          style={{
            overflowAnchor: "none",
            backgroundColor: "#fff",
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
                "shrink-0",
                // Laisse le scroll vertical sur mobile.
                "touch-pan-y select-none",
              )}
              style={{ flexBasis: cardBasis, width: cardBasis }}
              onTouchStart={(e) => {
                if (e.touches.length !== 2) return;
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                // Verrouille la target dès le début du pinch (même image du début à la fin).
                const targetIdx = findCardIndexAtPoint(midX, midY);
                if (targetIdx === null) return;
                pinch.current.targetIdx = targetIdx;
                const el = cardRefs.current[targetIdx];
                const rect = el?.getBoundingClientRect();
                pinch.current.anchorY = rect?.height ? clamp01((midY - rect.top) / rect.height) : 0.5;
                pinch.current.desiredViewportY = computeDesiredViewportY(midY);

                setFocusLocked(targetIdx, midY, pinch.current.anchorY);
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
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const focusPoint = { clientX: midX, clientY: midY };
                const locked =
                  pinch.current.targetIdx === null
                    ? undefined
                    : {
                        idx: pinch.current.targetIdx,
                        clientY: pinch.current.desiredViewportY,
                        anchorY: pinch.current.anchorY,
                      };

                if (ratio > PINCH_OUT_THRESHOLD) {
                  zoomInAll(focusPoint, locked);
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                } else if (ratio < PINCH_IN_THRESHOLD) {
                  zoomOutAll(focusPoint, locked);
                  pinch.current.startDist = dist;
                  pinch.current.lastActionAt = now;
                }
              }}
              onTouchEnd={() => {
                pinch.current.startDist = 0;
                pinch.current.targetIdx = null;
              }}
              onTouchCancel={() => {
                pinch.current.startDist = 0;
                pinch.current.targetIdx = null;
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

