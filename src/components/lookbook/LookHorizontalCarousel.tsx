"use client";

import type { LookbookImageKey } from "@/assets/images";
import type { LookContentItem } from "./lookContent";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { getTouchDist } from "./lookbookUtils";

export function LookHorizontalCarousel({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    startDist: getTouchDist(e.touches[0], e.touches[1]),
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
                  const dist = getTouchDist(e.touches[0], e.touches[1]);
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
  void lookKey;
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

