"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StaticImageData } from "next/image";
import clsx from "clsx";
import { lookbookImages } from "@/assets/images";

type LoadableImage = string | StaticImageData;

function toSrc(img: LoadableImage): string {
  return typeof img === "string" ? img : img.src;
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // on compte les erreurs comme "terminées" pour ne pas bloquer
    img.src = src;
  });
}

export default function InitialLoader() {
  const assets = useMemo(() => Object.values(lookbookImages).map(toSrc), []);

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    startedAtRef.current = performance.now();

    // Bloque le scroll pendant le loader.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const total = Math.max(assets.length, 1);
    let loaded = 0;

    const tickProgress = () => {
      if (cancelled) return;
      setProgress(loaded / total);
      rafRef.current = requestAnimationFrame(tickProgress);
    };

    rafRef.current = requestAnimationFrame(tickProgress);

    (async () => {
      await Promise.all(
        assets.map(async (src) => {
          await preloadImage(src);
          loaded += 1;
        }),
      );

      const minDurationMs = 450;
      const elapsed = performance.now() - (startedAtRef.current ?? 0);
      const remaining = Math.max(minDurationMs - elapsed, 0);

      await new Promise<void>((r) => setTimeout(() => r(), remaining));
      if (cancelled) return;

      setProgress(1);
      setExiting(true);
      const t = window.setTimeout(() => {
        if (!cancelled) setVisible(false);
      }, 280);
      timeoutsRef.current.push(t);
    })();

    return () => {
      cancelled = true;
      document.documentElement.style.overflow = previousOverflow;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, [assets]);

  if (!visible) return null;

  const pct = Math.max(0, Math.min(1, progress));

  return (
    <div
      aria-label="Chargement"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx(
        "fixed inset-0 z-[9999] bg-white",
        "flex items-center justify-center",
        "transition-opacity duration-300 ease-out",
        exiting ? "opacity-0" : "opacity-100",
      )}
    >
      <div className="w-[240px]">
        <div className="h-[2px] w-full bg-black/15 overflow-hidden">
          <div
            className="h-full bg-black"
            style={{
              width: `${pct * 100}%`,
              transition: "width 120ms linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}

