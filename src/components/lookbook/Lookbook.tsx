"use client";
import { Container } from "@/components";
import LookbookCard from "@/components/ui/lookbookCard";
import { lookbookImages, type LookbookImageKey } from "@/assets/images";
import lookbook from "@/data/lookbook.json";
import { lookContentByLook, type LookContentItem } from "./lookContent";
import { LookTopNav } from "./LookTopNav";
import clsx from "clsx";
import Image from "next/image";
import closeIcon from "@/assets/svgs/close.svg";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type FocusState =
  | { open: false }
  | {
      open: true;
      idx: number;
      phase: "entering" | "settling" | "open" | "exiting";
    };

type CoverTransitionState = null | {
  idx: number;
  lookKey: LookbookImageKey;
  title: string;
  from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number };
  phase: "from" | "to" | "final";
};

export function Lookbook() {
  const spanSteps = useMemo(() => [3, 4, 6, 12] as const, []);
  const gutterSteps = useMemo(() => ["xs", "s", "m", "l"] as const, []);

  const FOCUS_ZOOM_MS = 1400;
  const FOCUS_ZOOM_EASE = "cubic-bezier(.22,1,.36,1)";

  // Vue par défaut: 2 items par ligne (équivalent "w/2")
  const [stepIdx, setStepIdx] = useState<number>(2);
  const stepIdxRef = useRef<number>(2);

  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridHeight, setGridHeight] = useState<number>(0);
  const [focus, setFocus] = useState<FocusState>({ open: false });
  const [topNavHidden, setTopNavHidden] = useState(false);
  const [activeLookIdx, setActiveLookIdx] = useState(0);
  const [fullUiVisible, setFullUiVisible] = useState(false);
  const [coverZoomGlobalOpen, setCoverZoomGlobalOpen] = useState(false);
  const coverZoomGlobalOpenRef = useRef(false);
  const globalClosePinch = useRef<{ startDist: number } | null>(null);
  const [activeCarouselSlideIdx, setActiveCarouselSlideIdx] = useState(0);
  const activeCarouselSlideIdxRef = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const scrollYAtOpenRef = useRef<number>(0);
  const [coverReadyIdx, setCoverReadyIdx] = useState<number | null>(null);
  const [coverTransition, setCoverTransition] =
    useState<CoverTransitionState>(null);
  const gridAnim = useRef<{
    backupCssText: string;
    transformOpen: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const lastDesktopGestureAt = useRef<number>(0);
  const focusOpenRef = useRef(false);
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
  }>({
    startDist: 0,
    lastActionAt: 0,
    targetIdx: null,
    anchorY: 0.5,
    desiredViewportY: 0,
  });

  const PINCH_COOLDOWN_MS = 90;
  const PINCH_IN_THRESHOLD = 0.95; // plus sensible (zoom out)
  const PINCH_OUT_THRESHOLD = 1.05; // plus sensible (zoom in)

  const isFeedMode = focus.open && focus.phase === "open";

  const clampStep = (idx: number) =>
    Math.max(0, Math.min(spanSteps.length - 1, idx));

  const isReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const findCardIndexAtPoint = (clientX: number, clientY: number) => {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(
      clientX,
      clientY,
    ) as HTMLElement | null;
    if (!el) return null;
    const card = el.closest?.("[data-lookbook-idx]") as HTMLElement | null;
    if (!card) return null;
    const raw = card.getAttribute("data-lookbook-idx");
    const idx = raw ? Number(raw) : NaN;
    return Number.isFinite(idx) ? idx : null;
  };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

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
    else if (focusPoint)
      setFocusFromPoint(focusPoint.clientX, focusPoint.clientY);
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
    focusOpenRef.current = focus.open;
  }, [focus.open]);

  useEffect(() => {
    coverZoomGlobalOpenRef.current = coverZoomGlobalOpen;
  }, [coverZoomGlobalOpen]);

  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;
    if (coverZoomGlobalOpen) {
      // Quand la cover est zoomée: aucune interaction/scroll sur le feed.
      gridEl.style.pointerEvents = "none";
      gridEl.style.overflowY = "hidden";
      gridEl.style.scrollbarWidth = "none";
      (gridEl.style as any).msOverflowStyle = "none";

      // Et on verrouille aussi le scroll root pour éviter une scrollbar à droite.
      document.documentElement.style.overflowY = "hidden";
    } else {
      gridEl.style.pointerEvents = "";
      gridEl.style.overflowY = "";
      gridEl.style.scrollbarWidth = "";
      (gridEl.style as any).msOverflowStyle = "";
      document.documentElement.style.overflowY = "";
    }
  }, [coverZoomGlobalOpen]);

  useEffect(() => {
    activeCarouselSlideIdxRef.current = activeCarouselSlideIdx;
  }, [activeCarouselSlideIdx]);

  useEffect(() => {
    // Bloque le zoom navigateur (Ctrl/Cmd +/-/0 et Ctrl/Cmd+wheel/pinch trackpad)
    // pour réutiliser ces gestes pour la resize des cartes.
    const onKeyDown = (e: KeyboardEvent) => {
      // En vue full, pas de zoom/dezoom du "canvas" via raccourcis.
      if (focusOpenRef.current) return;
      const key = e.key;
      const isZoomShortcut =
        (e.ctrlKey || e.metaKey) &&
        (key === "+" || key === "-" || key === "=" || key === "0");
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

      // En vue full: pinch = zoom cover (slide 0) open/close.
      if (focusOpenRef.current) {
        const isOnCover = activeCarouselSlideIdxRef.current === 0;
        if (!isOnCover) return;

        if (!coverZoomGlobalOpenRef.current && e.deltaY < 0) {
          setCoverZoomGlobalOpen(true);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("lookbook:coverZoomOpen"));
          }
          return;
        }

        if (coverZoomGlobalOpenRef.current && e.deltaY > 0) {
          setCoverZoomGlobalOpen(false);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("lookbook:coverZoomClose"));
          }
          return;
        }
        return;
      }

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
    window.addEventListener("gesturestart", onGesture as EventListener, {
      passive: false,
    });
    window.addEventListener("gesturechange", onGesture as EventListener, {
      passive: false,
    });
    window.addEventListener("gestureend", onGesture as EventListener, {
      passive: false,
    });

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
      // Évite les jumps de scroll: on fige la hauteur du spacer
      // pendant la vue full (open/exiting) car le layout de la grille change.
      if (focus.open) return;
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
  }, [stepIdx, focus.open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!focus.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [focus.open]);

  useEffect(() => {
    if (!focus.open) {
      setFullUiVisible(false);
      return;
    }
    if (focus.phase !== "open") {
      setFullUiVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setFullUiVisible(true));
    return () => cancelAnimationFrame(id);
  }, [focus]);

  useLayoutEffect(() => {
    if (!focus.open) return;
    if (focus.phase !== "open") return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    gridEl.scrollTo({
      top: focus.idx * window.innerHeight,
      left: 0,
      behavior: "auto",
    });
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
          // Fullscreen atteint: on "commit" le canvas en plein écran (100% viewport),
          // sans scale résiduel, puis on révèle le feed.
          gridEl.style.transition = "none";
          gridEl.style.left = "0px";
          gridEl.style.top = "0px";
          gridEl.style.width = "100vw";
          gridEl.style.height = "var(--vvh, 100vh)";
          gridEl.style.transform =
            "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
          void gridEl.getBoundingClientRect();
          setCoverTransition(null);
          return { ...prev, phase: "open" };
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

  useLayoutEffect(() => {
    if (!focus.open) return;
    if (focus.phase !== "exiting") return;
    const gridEl = gridRef.current;
    const st = gridAnim.current;
    if (!gridEl || !st) return;

    // Remet la grille "au-dessus" avant l'anim inverse
    gridEl.style.opacity = "1";
    gridEl.style.pointerEvents = "auto";
    // Évite un flash: on garde un fond transparent pendant l'exit,
    // puis `backupCssText` est restauré en fin de transition.
    gridEl.style.background = "transparent";

    // Recrée le transformOpen pour le look actif en layout grille (flex-wrap).
    gridEl.style.transition = "none";
    gridEl.style.position = "fixed";
    gridEl.style.left = `${st.left}px`;
    gridEl.style.top = `${st.top}px`;
    gridEl.style.width = `${st.width}px`;
    gridEl.style.height = `${st.height}px`;
    gridEl.style.transformOrigin = "0 0";
    gridEl.style.willChange = "transform";
    gridEl.style.transform = "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
    void gridEl.getBoundingClientRect();

    const cardEl = cardRefs.current[focus.idx];
    if (!cardEl) return;

    const gridR = gridEl.getBoundingClientRect();
    const cardR = cardEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.max(vw / cardR.width, vh / cardR.height);
    const x = cardR.left - gridR.left;
    const y = cardR.top - gridR.top;
    const desiredLeft = (vw - cardR.width * s) / 2;
    const desiredTop = (vh - cardR.height * s) / 2;
    const tx = desiredLeft - gridR.left - x * s;
    const ty = desiredTop - gridR.top - y * s;
    const transformOpen3d = `translate3d(${tx}px, ${ty}px, 0px) scale3d(${s}, ${s}, 1)`;

    gridEl.style.transform = transformOpen3d;
    void gridEl.getBoundingClientRect();

    gridEl.style.transition = isReducedMotion()
      ? "none"
      : `transform ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}`;
    void gridEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      gridEl.style.transform = "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
    });
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

    // Cible "full": le média cliqué doit aller en plein écran (100% w/h).
    const targetLeft = 0;
    const targetTop = 0;
    const targetW = vw;
    const targetH = vh;

    // Overlay cover: anime width+height (même source/qualité que la vue full),
    // pour éviter le "switch" visible entre thumb et cover.
    setCoverTransition({
      idx,
      lookKey,
      title,
      from: {
        left: cardR.left,
        top: cardR.top,
        width: cardR.width,
        height: cardR.height,
      },
      to: { left: targetLeft, top: targetTop, width: targetW, height: targetH },
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
      : `transform ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}`;
    gridEl.style.background = "transparent";
    gridEl.style.opacity = "1";
    gridEl.style.pointerEvents = "auto";

    // état initial
    gridEl.style.transform = "translate3d(0px, 0px, 0px) scale3d(1, 1, 1)";
    void gridEl.getBoundingClientRect();

    scrollYAtOpenRef.current = window.scrollY;
    setFocus({ open: true, idx, phase: "entering" });
    setTopNavHidden(false);
    setCoverZoomGlobalOpen(false);
    setActiveLookIdx(idx);

    requestAnimationFrame(() => {
      gridEl.style.transform = transformOpen3d;
    });
  };

  const closeFocusToGrid = () => {
    if (!focus.open) return;
    // Cache la top-nav immédiatement au clic (avant l'anim)
    setTopNavHidden(true);
    setCoverZoomGlobalOpen(false);
    setCoverTransition(null);
    // Ferme depuis le look actuellement visible dans le feed
    setFocus((prev) =>
      prev.open ? { ...prev, idx: activeLookIdx, phase: "exiting" } : prev,
    );
  };

  const formatLookTitle = (idx: number) => {
    const n = idx + 1;
    return `Look ${String(n).padStart(2, "0")}`;
  };

  const onFeedScroll = () => {
    const el = gridRef.current;
    if (!el) return;
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const vh = window.innerHeight || 1;
      const idx = Math.max(0, Math.min(lookbook.length - 1, Math.round(el.scrollTop / vh)));
      setActiveLookIdx((prev) => (prev === idx ? prev : idx));
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
    root.classList.remove(
      "gutter-gap-xs",
      "gutter-gap-s",
      "gutter-gap-m",
      "gutter-gap-l",
    );
    root.classList.add(`gutter-gap-${key}`);

    return () => {
      root.classList.remove(
        "gutter-gap-xs",
        "gutter-gap-s",
        "gutter-gap-m",
        "gutter-gap-l",
      );
      root.classList.add("gutter-gap-m");
    };
  }, [stepIdx, gutterSteps]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Unifie la hauteur viewport entre JS (innerHeight) et CSS (mobile bars, etc.)
    // pour éviter un mismatch entre la transition cover et la cover en page.
    const root = document.documentElement;
    const setVvh = () => {
      root.style.setProperty("--vvh", `${window.innerHeight}px`);
    };
    setVvh();
    window.addEventListener("resize", setVvh);
    return () => window.removeEventListener("resize", setVvh);
  }, []);

  const getTouchDist = (
    t1: { clientX: number; clientY: number },
    t2: { clientX: number; clientY: number },
  ) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const itemsPerRow =
    stepIdx === 0 ? 4 : stepIdx === 1 ? 3 : stepIdx === 2 ? 2 : 1;
  const cardBasis =
    itemsPerRow === 1
      ? "100%"
      : `calc((100% - ${itemsPerRow - 1} * var(--gutter-gap, 5px)) / ${itemsPerRow})`;

  return (
    <section className="w-full">
      <Container>
        <div className="relative w-full overflow-visible">
          <div aria-hidden className="w-full" style={{ height: gridHeight }} />
          <div
            ref={gridRef}
            className={clsx(
              "absolute left-0 top-0 z-50 flex w-full",
              isFeedMode
                ? "flex-col overflow-y-scroll overscroll-contain [scroll-snap-type:y_mandatory] bg-black no-scrollbar"
                : "flex-wrap gutter-gap",
              isFeedMode && "touch-pan-y",
            )}
            style={{
              overflowAnchor: "none",
              backgroundColor: isFeedMode ? "#000" : "#fff",
            }}
            onScroll={isFeedMode ? onFeedScroll : undefined}
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
                  !isFeedMode && "touch-pan-y",
                  "select-none",
                  isFeedMode && "w-full [scroll-snap-align:start]",
                )}
                style={{
                  flexBasis: isFeedMode ? "100%" : cardBasis,
                  width: isFeedMode ? "100%" : cardBasis,
                  height: isFeedMode ? "var(--vvh, 100vh)" : undefined,
                }}
                onClick={() => {
                  // En vue full (feed), on ne doit plus pouvoir "recliquer" pour ouvrir un autre look.
                  if (focus.open) return;
                  openFocusFromGrid(idx);
                }}
                onTouchStart={(e) => {
                  // En vue full, on ne pinch pas pour zoomer/dézoomer la grille.
                  if (focus.open) return;
                  if (e.touches.length !== 2) return;
                  const midX =
                    (e.touches[0].clientX + e.touches[1].clientX) / 2;
                  const midY =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;

                  // Verrouille la target dès le début du pinch (même image du début à la fin).
                  const targetIdx = findCardIndexAtPoint(midX, midY);
                  if (targetIdx === null) return;
                  pinch.current.targetIdx = targetIdx;
                  const el = cardRefs.current[targetIdx];
                  const rect = el?.getBoundingClientRect();
                  pinch.current.anchorY = rect?.height
                    ? clamp01((midY - rect.top) / rect.height)
                    : 0.5;
                  pinch.current.desiredViewportY =
                    computeDesiredViewportY(midY);

                  setFocusLocked(targetIdx, midY, pinch.current.anchorY);
                  pinch.current.startDist = getTouchDist(
                    e.touches[0],
                    e.touches[1],
                  );
                  pinch.current.lastActionAt = Date.now();
                }}
                onTouchMove={(e) => {
                  // En vue full, on ne pinch pas pour zoomer/dézoomer la grille.
                  if (focus.open) return;
                  if (e.touches.length !== 2) return;
                  e.preventDefault();

                  const now = Date.now();
                  if (now - pinch.current.lastActionAt < PINCH_COOLDOWN_MS)
                    return;

                  const dist = getTouchDist(e.touches[0], e.touches[1]);
                  if (!pinch.current.startDist) return;

                  const ratio = dist / pinch.current.startDist;
                  const midX =
                    (e.touches[0].clientX + e.touches[1].clientX) / 2;
                  const midY =
                    (e.touches[0].clientY + e.touches[1].clientY) / 2;
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
                {isFeedMode ? (
                  <LookHorizontalCarousel
                    lookKey={item.src as LookbookImageKey}
                    coverTitle={item.title}
                    coverImg={lookbookImages[item.src as LookbookImageKey]}
                    content={
                      lookContentByLook[item.src as LookbookImageKey] ?? []
                    }
                    active={
                      focus.open &&
                      focus.phase === "open" &&
                      activeLookIdx === idx
                    }
                    uiVisible={fullUiVisible}
                    onCoverZoomChange={(open) => {
                      setCoverZoomGlobalOpen(open);
                    }}
                    onSlideIdxChange={(i) => {
                      setActiveCarouselSlideIdx(i);
                    }}
                    onCoverReady={() => {
                      if (idx === focus.idx) setCoverReadyIdx(idx);
                    }}
                  />
                ) : (
                  <div
                    style={{
                      opacity:
                        coverTransition &&
                        coverTransition.idx === idx &&
                        focus.open
                          ? 0
                          : 1,
                    }}
                  >
                    <LookbookCard
                      img={lookbookImages[item.src as LookbookImageKey]}
                      title={item.title}
                    />
                  </div>
                )}
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
              (coverTransition.phase === "to" ||
              coverTransition.phase === "final"
                ? coverTransition.to.left
                : coverTransition.from.left) + "px",
            top:
              (coverTransition.phase === "to" ||
              coverTransition.phase === "final"
                ? coverTransition.to.top
                : coverTransition.from.top) + "px",
            width:
              (coverTransition.phase === "to" ||
              coverTransition.phase === "final"
                ? coverTransition.to.width
                : coverTransition.from.width) + "px",
            height:
              (coverTransition.phase === "to" ||
              coverTransition.phase === "final"
                ? coverTransition.to.height
                : coverTransition.from.height) + "px",
            transition: isReducedMotion()
              ? "none"
              : coverTransition.phase === "to"
                ? `left ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}, top ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}, width ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}, height ${FOCUS_ZOOM_MS}ms ${FOCUS_ZOOM_EASE}`
                : "none",
            willChange: "left, top, width, height",
            transform: "translateZ(0)",
            pointerEvents: "none",
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName !== "width" && e.propertyName !== "height")
              return;
            setCoverTransition((prev) =>
              prev ? { ...prev, phase: "final" } : prev,
            );
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
              if (focus.open && focus.idx === coverTransition.idx)
                setCoverReadyIdx(coverTransition.idx);
            }}
          />
        </div>
      )}

      {focus.open &&
        focus.phase === "open" &&
        !topNavHidden &&
        !coverZoomGlobalOpen && (
        <>
          <LookTopNav
            onBack={closeFocusToGrid}
            onToggleFav={() => {
              // placeholder: favoris à venir
            }}
          />

          {/* Titre séparé, au-dessus du stepper */}
          <div
            className={clsx(
              "pointer-events-none fixed left-0 right-0 bottom-[120px] z-[1002] flex justify-center",
              "transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
              fullUiVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            )}
          >
            <div className="text-[11px] font-serif tracking-wide text-white">
              {formatLookTitle(activeLookIdx)}
            </div>
          </div>
        </>
      )}

      {/* Zoom cover: croix globale + blocage total des interactions */}
      {focus.open && focus.phase === "open" && coverZoomGlobalOpen && (
        <div
          className="fixed inset-0 z-[2000] pointer-events-auto"
          onPointerDown={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          onTouchStart={(e) => {
            if (e.touches.length !== 2) return;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            globalClosePinch.current = { startDist: Math.hypot(dx, dy) };
          }}
          onTouchEnd={() => {
            globalClosePinch.current = null;
          }}
          onTouchCancel={() => {
            globalClosePinch.current = null;
          }}
          onTouchMoveCapture={(e) => {
            // Pinch inverse sur mobile pour fermer (même comportement que desktop pad).
            if (!globalClosePinch.current) return;
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / (globalClosePinch.current.startDist || 1);
            if (ratio < 0.92) {
              globalClosePinch.current = null;
              setCoverZoomGlobalOpen(false);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("lookbook:coverZoomClose"));
              }
            }
          }}
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute right-16 top-16 z-[2001] grid h-40 w-40 place-items-center"
            onClick={() => {
              setCoverZoomGlobalOpen(false);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("lookbook:coverZoomClose"));
              }
            }}
          >
            <Image
              src={closeIcon}
              alt="fermer"
              width={16}
              height={16}
              className="brightness-0 invert"
            />
          </button>
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
  active,
  uiVisible,
  onCoverZoomChange,
  onSlideIdxChange,
  onCoverReady,
}: {
  lookKey: LookbookImageKey;
  coverTitle: string;
  coverImg: any;
  content: LookContentItem[];
  active?: boolean;
  uiVisible?: boolean;
  onCoverZoomChange?: (open: boolean) => void;
  onSlideIdxChange?: (idx: number) => void;
  onCoverReady?: () => void;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [coverZoomOpen, setCoverZoomOpen] = useState(false);
  const [coverZoomVisible, setCoverZoomVisible] = useState(false);
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const tapMoved = useRef(false);
  const coverPinch = useRef<{ startDist: number; opened: boolean } | null>(null);

  const getDist = (
    t1: { clientX: number; clientY: number },
    t2: { clientX: number; clientY: number },
  ) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };
  const media = useMemo<LookContentItem[]>(() => {
    if (lookKey !== "001") return content;
    const i = content.findIndex((x) => x.type === "video");
    if (i <= 0) return content;
    const next = content.slice();
    const [vid] = next.splice(i, 1);
    next.unshift(vid);
    return next;
  }, [content, lookKey]);

  // Slides: cover + media + details
  const slideCount = 2 + media.length;

  useEffect(() => {
    if (!active) return;
    const el = localRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, top: 0, behavior: "auto" });
    setSlideIdx(0);
    setCoverZoomOpen(false);
    setCoverZoomVisible(false);
    onCoverZoomChange?.(false);
    onSlideIdxChange?.(0);
  }, [active]);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    // Quand la modale est ouverte, on bloque le carousel derrière (sinon swipe/scroll "part en vrille").
    el.style.pointerEvents = coverZoomOpen ? "none" : "";
    return () => {
      el.style.pointerEvents = "";
    };
  }, [coverZoomOpen]);

  useEffect(() => {
    const onClose = () => {
      setCoverZoomOpen(false);
      onCoverZoomChange?.(false);
    };
    window.addEventListener("lookbook:coverZoomClose", onClose);
    return () => window.removeEventListener("lookbook:coverZoomClose", onClose);
  }, [onCoverZoomChange]);

  useEffect(() => {
    const onOpen = () => {
      setCoverZoomOpen(true);
      onCoverZoomChange?.(true);
    };
    window.addEventListener("lookbook:coverZoomOpen", onOpen);
    return () => window.removeEventListener("lookbook:coverZoomOpen", onOpen);
  }, [onCoverZoomChange]);

  useEffect(() => {
    if (!coverZoomOpen) {
      setCoverZoomVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setCoverZoomVisible(true));
    return () => cancelAnimationFrame(id);
  }, [coverZoomOpen]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={localRef}
        className="h-full w-full touch-pan-x touch-pan-y overflow-x-scroll overscroll-x-contain [scroll-snap-type:x_mandatory] no-scrollbar"
        style={{ scrollBehavior: "auto" }}
        onScroll={() => {
          const el = localRef.current;
          if (!el) return;
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            const w = window.innerWidth || 1;
            const next = Math.max(
              0,
              Math.min(slideCount - 1, Math.round(el.scrollLeft / w)),
            );
            setSlideIdx(next);
            onSlideIdxChange?.(next);
          });
        }}
      >
        <div className="flex h-full w-max">
          {/* Slide 0: cover (retour au feed en swipant back ici) */}
          <div className="relative flex h-full w-[100vw] items-center justify-center overflow-hidden bg-black [scroll-snap-align:start]">
            <div
              className={clsx(
                "relative overflow-hidden will-change-transform",
                "transition-transform duration-[1800ms] ease-[cubic-bezier(.16,1,.3,1)]",
                coverZoomVisible ? "scale-[1.4]" : "scale-100",
              )}
              style={{
                aspectRatio: "3 / 4",
                height: "var(--vvh, 100vh)",
                width: "calc(var(--vvh, 100vh) * 0.75)",
                transformOrigin: "top",
              }}
              onPointerDown={(e) => {
                tapMoved.current = false;
                tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
              }}
              onPointerMove={(e) => {
                const start = tapStart.current;
                if (!start) return;
                const dx = Math.abs(e.clientX - start.x);
                const dy = Math.abs(e.clientY - start.y);
                if (dx > 10 || dy > 10) tapMoved.current = true;
              }}
              onPointerUp={(e) => {
                const start = tapStart.current;
                tapStart.current = null;
                if (!start) return;
                const dt = Date.now() - start.t;
                if (tapMoved.current || dt > 350) return;
                setCoverZoomOpen(true);
                onCoverZoomChange?.(true);
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  coverPinch.current = {
                    startDist: getDist(e.touches[0], e.touches[1]),
                    opened: false,
                  };
                  return;
                }
                if (e.touches.length !== 1) return;
                tapMoved.current = false;
                tapStart.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  t: Date.now(),
                };
              }}
              onTouchMove={(e) => {
                // Pinch zoom-in => ouvre le zoom cover
                if (e.touches.length === 2 && coverPinch.current) {
                  const st = coverPinch.current;
                  if (!st.startDist) return;
                  const dist = getDist(e.touches[0], e.touches[1]);
                  const ratio = dist / st.startDist;
                  // seuil volontairement un peu “ferme” pour ne pas déclencher sur un swipe
                  if (ratio > 1.08) {
                    st.opened = true;
                    e.preventDefault();
                    setCoverZoomOpen(true);
                    onCoverZoomChange?.(true);
                  }
                  // pinch inverse => ferme
                  if (coverZoomOpen && ratio < 0.92) {
                    e.preventDefault();
                    setCoverZoomOpen(false);
                    onCoverZoomChange?.(false);
                    coverPinch.current = null;
                  }
                  return;
                }
                const start = tapStart.current;
                if (!start) return;
                if (e.touches.length !== 1) return;
                const dx = Math.abs(e.touches[0].clientX - start.x);
                const dy = Math.abs(e.touches[0].clientY - start.y);
                if (dx > 10 || dy > 10) tapMoved.current = true;
              }}
              onTouchEnd={() => {
                coverPinch.current = null;
                const start = tapStart.current;
                tapStart.current = null;
                if (!start) return;
                const dt = Date.now() - start.t;
                if (tapMoved.current || dt > 350) return;
                setCoverZoomOpen(true);
                onCoverZoomChange?.(true);
              }}
              onTouchCancel={() => {
                coverPinch.current = null;
                tapStart.current = null;
              }}
            >
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
            <div
              aria-hidden
              className={clsx(
                "pointer-events-none absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black/90 to-transparent",
                "transition-opacity duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
                uiVisible && !coverZoomOpen ? "opacity-100" : "opacity-0",
              )}
            />
          </div>

          {/* Slides suivants: media + details */}
          {(lookKey === "001" && media.length ? (
            <>
              {/* 2e slide: video (ou 1er media) */}
              <MediaSlide
                key={`${lookKey}-media-0`}
                item={media[0]!}
                coverTitle={coverTitle}
                uiVisible={uiVisible}
              />
              {/* 3e slide: details */}
              <DetailsSlide
                key={`${lookKey}-details`}
                title={coverTitle}
                lookKey={lookKey}
                uiVisible={uiVisible}
              />
              {/* reste du media */}
              {media.slice(1).map((it, i) => (
                <MediaSlide
                  key={`${lookKey}-media-${i + 1}-${it.type}`}
                  item={it}
                  coverTitle={coverTitle}
                  uiVisible={uiVisible}
                />
              ))}
            </>
          ) : (
            <>
              {media.map((it, i) => (
                <MediaSlide
                  key={`${lookKey}-media-${i}-${it.type}`}
                  item={it}
                  coverTitle={coverTitle}
                  uiVisible={uiVisible}
                />
              ))}
              <DetailsSlide
                key={`${lookKey}-details`}
                title={coverTitle}
                lookKey={lookKey}
                uiVisible={uiVisible}
              />
            </>
          )) as any}
        </div>
      </div>

      {/* Zoom cover: overlay local supprimé (croix = overlay global) */}

      {/* Stepper */}
      <div
        className={clsx(
          "pointer-events-none absolute bottom-60 left-0 right-0 z-10 flex justify-center",
          "transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
          uiVisible && !coverZoomOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3",
        )}
      >
        <div className="flex items-center gap-6">
          {Array.from({ length: Math.max(1, slideCount) }).map((_, i) => (
            <div
              key={`${lookKey}-sq-${i}`}
              className={clsx(
                "h-4 w-4 bg-white transition-opacity",
                i === slideIdx ? "opacity-100" : "opacity-40",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaSlide({
  item,
  coverTitle,
  uiVisible,
}: {
  item: LookContentItem;
  coverTitle: string;
  uiVisible?: boolean;
}) {
  return (
    <div className="relative h-[var(--vvh,100vh)] w-[100vw] overflow-hidden bg-black [scroll-snap-align:start]">
      {item.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.src} alt={coverTitle} className="h-full w-full object-cover" />
      ) : (
        <video
          className="h-full w-full object-cover"
          src={item.src}
          playsInline
          muted
          autoPlay
          loop
        />
      )}
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black/90 to-transparent",
          "transition-opacity duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
          uiVisible ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function DetailsSlide({
  title,
  lookKey,
  uiVisible,
}: {
  title: string;
  lookKey: LookbookImageKey;
  uiVisible?: boolean;
}) {
  return (
    <section className="relative flex h-full w-[100vw] items-center justify-center bg-black px-26 text-center text-white [scroll-snap-align:start]">
      <div>
        <div className="text-14 font-serif tracking-wide">{title}</div>
        <div className="mt-13 span-w-10 text-12 leading-[125%] font-abchanel">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua.
        </div>
      </div>
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black/90 to-transparent",
          "transition-opacity duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
          uiVisible ? "opacity-100" : "opacity-0",
        )}
      />
    </section>
  );
}
