'use client'
import { Container } from "@/components";
import LookbookCard from "@/components/ui/lookbookCard";
import { lookbookImages, type LookbookImageKey } from "@/assets/images";
import lookbook from "@/data/lookbook.json";
import { lookContentByLook, type LookContentItem } from "./lookContent";
import clsx from "clsx";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type FocusState =
  | { open: false }
  | {
      open: true;
      idx: number;
      phase: "entering" | "settling" | "open" | "exiting";
    };

type CoverTransitionState =
  | null
  | {
      idx: number;
      lookKey: LookbookImageKey;
      title: string;
      from: { left: number; top: number; width: number; height: number };
      to: { left: number; top: number; width: number; height: number };
      phase: "from" | "to";
    };

export function Lookbook() {
  const spanSteps = useMemo(() => [3, 4, 6, 12] as const, []);
  const gutterSteps = useMemo(() => ["xs", "s", "m", "l"] as const, []);

  // Vue par défaut: 2 items par ligne (équivalent "w/2")
  const [stepIdx, setStepIdx] = useState<number>(2);
  const stepIdxRef = useRef<number>(2);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridHeight, setGridHeight] = useState<number>(0);
  const [focus, setFocus] = useState<FocusState>({ open: false });
  const focusListRef = useRef<HTMLDivElement | null>(null);
  const focusItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const focusHCarouselRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [coverReadyIdx, setCoverReadyIdx] = useState<number | null>(null);
  const [coverTransition, setCoverTransition] = useState<CoverTransitionState>(null);
  const gridAnim = useRef<{
    backupCssText: string;
    transformOpen: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
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

  useLayoutEffect(() => {
    // La grille est en absolute (pour pouvoir scale au-dessus du header),
    // mais on conserve le flow via un spacer qui reprend sa hauteur.
    const el = gridRef.current;
    if (!el) return;

    const update = () => {
      // On ne peut pas utiliser "inset-0" sinon la hauteur est contrainte par le spacer (boucle).
      // Ici on mesure la hauteur réelle du contenu.
      const next = Math.ceil(el.getBoundingClientRect().height);
      setGridHeight((prev) => (prev === next ? prev : next));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      const id = window.setInterval(update, 250);
      return () => window.clearInterval(id);
    }

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepIdx]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!focus.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [focus.open]);

  useLayoutEffect(() => {
    if (!focus.open) return;
    if (focus.phase !== "open") return;
    const el = focusItemRefs.current[focus.idx];
    if (!el) return;
    el.scrollIntoView({ block: "start", inline: "nearest" });
  }, [focus]);

  useLayoutEffect(() => {
    // Pré-positionne le feed sans scroll visible (avant reveal).
    if (!focus.open) return;
    if (focus.phase !== "settling") return;
    const list = focusListRef.current;
    if (list) {
      list.scrollTo({ top: focus.idx * window.innerHeight, left: 0, behavior: "auto" });
    }
    const h = focusHCarouselRefs.current[focus.idx];
    if (h) h.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [focus]);

  useEffect(() => {
    if (!focus.open) {
      setCoverReadyIdx(null);
      setCoverTransition(null);
      return;
    }
    // reset pour éviter un reveal trop tôt sur une ancienne image
    setCoverReadyIdx(null);
  }, [focus.open, focus.open && focus.idx]);

  useLayoutEffect(() => {
    if (!coverTransition) return;
    if (coverTransition.phase !== "from") return;
    if (isReducedMotion()) {
      setCoverTransition((prev) => (prev ? { ...prev, phase: "to" } : prev));
      return;
    }
    const id = requestAnimationFrame(() => {
      setCoverTransition((prev) => (prev ? { ...prev, phase: "to" } : prev));
    });
    return () => cancelAnimationFrame(id);
  }, [coverTransition]);

  useLayoutEffect(() => {
    if (!focus.open) return;
    const gridEl = gridRef.current;
    const st = gridAnim.current;
    if (!gridEl || !st) return;
    if (isReducedMotion()) {
      setFocus((prev) => (prev.open ? { ...prev, phase: "open" } : prev));
      return;
    }

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      gridEl.removeEventListener("transitionend", onTransitionEnd);
      setFocus((prev) => {
        if (!prev.open) return prev;

        if (prev.phase === "entering") {
          // Fullscreen atteint: on passe en "settling" (feed positionné + image chargée)
          return { ...prev, phase: "settling" };
        }

        if (prev.phase === "exiting") {
          // Fin de l'anim inverse: restore la grille en flow et ferme.
          gridEl.style.cssText = st.backupCssText;
          gridAnim.current = null;
          return { open: false };
        }

        return prev;
      });
    };

    gridEl.addEventListener("transitionend", onTransitionEnd);
    return () => gridEl.removeEventListener("transitionend", onTransitionEnd);
  }, [focus]);

  const openFocusFromGrid = (idx: number) => {
    const el = cardRefs.current[idx];
    const gridEl = gridRef.current;
    if (!el || !gridEl) return;

    const gridR = gridEl.getBoundingClientRect();
    const cardR = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const lookKey = lookbook[idx]?.src as LookbookImageKey;
    const title = lookbook[idx]?.title ?? "";

    // Overlay cover: anime width+height (même source/qualité que la vue full),
    // pour éviter le "switch" visible entre thumb et cover.
    setCoverTransition({
      idx,
      lookKey,
      title,
      from: { left: cardR.left, top: cardR.top, width: cardR.width, height: cardR.height },
      to: { left: 0, top: 0, width: vw, height: vh },
      phase: "from",
    });

    // scale "cover" pour que la card cible devienne full screen.
    const s = Math.max(vw / cardR.width, vh / cardR.height);
    const x = cardR.left - gridR.left;
    const y = cardR.top - gridR.top;
    const desiredLeft = (vw - cardR.width * s) / 2;
    const desiredTop = (vh - cardR.height * s) / 2;
    const tx = desiredLeft - gridR.left - x * s;
    const ty = desiredTop - gridR.top - y * s;
    const transformOpen = `translate(${tx}px, ${ty}px) scale(${s})`;
    const transformOpen3d = `translate3d(${tx}px, ${ty}px, 0px) scale3d(${s}, ${s}, 1)`;

    gridAnim.current = {
      backupCssText: gridEl.style.cssText,
      transformOpen: transformOpen3d,
      left: gridR.left,
      top: gridR.top,
      width: gridR.width,
      height: gridR.height,
    };

    // Passer la grille en fixed pour qu'elle puisse passer au-dessus du header pendant l'anim.
    gridEl.style.position = "fixed";
    gridEl.style.left = `${gridR.left}px`;
    gridEl.style.top = `${gridR.top}px`;
    gridEl.style.width = `${gridR.width}px`;
    gridEl.style.height = `${gridR.height}px`;
    gridEl.style.zIndex = "1000";
    gridEl.style.transformOrigin = "0 0";
    gridEl.style.willChange = "transform";
    gridEl.style.transition = isReducedMotion()
      ? "none"
      : "transform 900ms cubic-bezier(.16,1,.3,1)";
    gridEl.style.background = "#fff";
    gridEl.style.opacity = "1";
    gridEl.style.pointerEvents = "auto";

    // état initial
    gridEl.style.transform = "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
    void gridEl.getBoundingClientRect();

    setFocus({ open: true, idx, phase: "entering" });

    requestAnimationFrame(() => {
      gridEl.style.transform = transformOpen3d;
    });
  };

  const closeFocusToGrid = () => {
    if (!focus.open) return;
    const gridEl = gridRef.current;
    const st = gridAnim.current;
    if (!gridEl || !st) {
      setFocus({ open: false });
      return;
    }

    setCoverTransition(null);
    setFocus((prev) => (prev.open ? { ...prev, phase: "exiting" } : prev));
    // On repasse la grille visible au-dessus du feed avant l'anim inverse.
    gridEl.style.opacity = "1";
    gridEl.style.pointerEvents = "auto";
    // force layout puis anim inverse
    gridEl.style.transition = isReducedMotion()
      ? "none"
      : "transform 850ms cubic-bezier(.16,1,.3,1)";
    void gridEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      gridEl.style.transform = "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
    });
  };

  useEffect(() => {
    // Reveal du feed seulement quand la cover du look courant est prête.
    if (!focus.open) return;
    if (focus.phase !== "settling") return;
    if (coverReadyIdx !== focus.idx) return;

    const gridEl = gridRef.current;
    if (gridEl) {
      gridEl.style.opacity = "0";
      gridEl.style.pointerEvents = "none";
    }

    // Une fois le feed révélé, on peut enlever l'overlay de transition.
    setCoverTransition(null);
    setFocus((prev) => (prev.open ? { ...prev, phase: "open" } : prev));
  }, [focus, coverReadyIdx]);

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
        <div className="relative w-full overflow-visible">
          <div aria-hidden className="w-full" style={{ height: gridHeight }} />
          <div
            ref={gridRef}
            className={clsx("absolute left-0 top-0 z-50 flex w-full flex-wrap gutter-gap")}
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
                onClick={() => openFocusFromGrid(idx)}
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
                  pinch.current.anchorY = rect?.height
                    ? clamp01((midY - rect.top) / rect.height)
                    : 0.5;
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
        </div>
      </Container>

      {coverTransition && (
        <div
          className="fixed z-[1001] overflow-hidden bg-white"
          style={{
            left:
              (coverTransition.phase === "to" ? coverTransition.to.left : coverTransition.from.left) +
              "px",
            top:
              (coverTransition.phase === "to" ? coverTransition.to.top : coverTransition.from.top) +
              "px",
            width:
              (coverTransition.phase === "to"
                ? coverTransition.to.width
                : coverTransition.from.width) + "px",
            height:
              (coverTransition.phase === "to"
                ? coverTransition.to.height
                : coverTransition.from.height) + "px",
            transition: isReducedMotion()
              ? "none"
              : "left 900ms cubic-bezier(.16,1,.3,1), top 900ms cubic-bezier(.16,1,.3,1), width 900ms cubic-bezier(.16,1,.3,1), height 900ms cubic-bezier(.16,1,.3,1)",
            willChange: "left, top, width, height",
            transform: "translateZ(0)",
            pointerEvents: "none",
          }}
        >
          <Image
            src={lookbookImages[coverTransition.lookKey]}
            alt={coverTransition.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
            quality={100}
            onLoadingComplete={() => {
              if (focus.open && focus.idx === coverTransition.idx) setCoverReadyIdx(coverTransition.idx);
            }}
          />
        </div>
      )}

      {focus.open && (
        <div className="fixed inset-0 z-[999] bg-white">
          <button
            type="button"
            className="fixed left-16 top-16 z-[1000] rounded-full bg-black/70 px-12 py-8 text-12 text-white backdrop-blur"
            onClick={closeFocusToGrid}
          >
            Fermer
          </button>

          <div
            ref={focusListRef}
            className={clsx(
              "h-full w-full overflow-y-scroll overscroll-contain [scroll-snap-type:y_mandatory]",
              focus.phase === "open" ? "opacity-100" : "opacity-0",
            )}
            style={{
              transition: "opacity 260ms ease",
              pointerEvents: focus.phase === "open" ? "auto" : "none",
              scrollBehavior: focus.phase === "open" ? "smooth" : "auto",
            }}
          >
            {lookbook.map((item, idx) => {
              const lookKey = item.src as LookbookImageKey;
              const content = lookContentByLook[lookKey] ?? [];

              return (
                <div
                  key={`focus-${item.src}-${idx}`}
                  ref={(el) => {
                    focusItemRefs.current[idx] = el;
                  }}
                  className="relative h-[100svh] w-full [scroll-snap-align:start]"
                >
                  <LookHorizontalCarousel
                    lookKey={lookKey}
                    coverTitle={item.title}
                    coverImg={lookbookImages[lookKey]}
                    content={content}
                    carouselRef={(el) => {
                      focusHCarouselRefs.current[idx] = el;
                    }}
                    onCoverReady={() => {
                      if (idx === focus.idx) setCoverReadyIdx(idx);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function LookHorizontalCarousel({
  lookKey,
  coverTitle,
  coverImg,
  content,
  carouselRef,
  onCoverReady,
}: {
  lookKey: LookbookImageKey;
  coverTitle: string;
  coverImg: any;
  content: LookContentItem[];
  carouselRef?: (el: HTMLDivElement | null) => void;
  onCoverReady?: () => void;
}) {
  return (
    <div
      ref={carouselRef}
      className="h-full w-full overflow-x-scroll overscroll-x-contain [scroll-snap-type:x_mandatory]"
      style={{ scrollBehavior: "auto" }}
    >
      <div className="flex h-full w-max">
        {/* Slide 0: cover (retour au feed en swipant back ici) */}
        <div className="relative h-full w-[100vw] overflow-hidden [scroll-snap-align:start]">
          <Image
            src={coverImg}
            alt={coverTitle}
            fill
            className="object-cover"
            sizes="100vw"
            priority
            quality={100}
            onLoadingComplete={onCoverReady}
          />
        </div>

        {/* Slides suivants: contenu */}
        {content.length ? (
          content.map((it, i) => (
            <div
              key={`${lookKey}-${it.type}-${i}`}
              className="relative h-full w-[100vw] overflow-hidden bg-black [scroll-snap-align:start]"
            >
              {it.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.src} alt={coverTitle} className="h-full w-full object-cover" />
              ) : (
                <video
                  className="h-full w-full object-cover"
                  src={it.src}
                  playsInline
                  muted
                  autoPlay
                  loop
                />
              )}
            </div>
          ))
        ) : (
          <div className="flex h-full w-[100vw] items-center justify-center bg-black px-24 text-center text-white [scroll-snap-align:start]">
            <div>
              <div className="text-14 opacity-80">{coverTitle}</div>
              <div className="mt-8 text-12 opacity-60">Contenu à venir pour {lookKey}.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

