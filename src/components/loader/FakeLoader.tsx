"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { isReducedMotion } from "@/components/lookbook/lookbookUtils";

export default function FakeLoader({
  minDurationMs = 180,
  fadeOutMs = 260,
}: {
  minDurationMs?: number;
  fadeOutMs?: number;
}) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    startedAtRef.current = performance.now();

    if (isReducedMotion()) {
      setVisible(false);
      return;
    }

    const t0 = window.setTimeout(() => {
      const elapsed = performance.now() - (startedAtRef.current ?? 0);
      const remaining = Math.max(minDurationMs - elapsed, 0);
      const t1 = window.setTimeout(() => {
        setExiting(true);
        const t2 = window.setTimeout(() => setVisible(false), fadeOutMs);
        timeoutsRef.current.push(t2);
      }, remaining);
      timeoutsRef.current.push(t1);
    }, 0);
    timeoutsRef.current.push(t0);

    return () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, [fadeOutMs, minDurationMs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={clsx(
        "fixed inset-0 z-[9999] bg-white",
        "flex items-center justify-center",
        "transition-opacity ease-[cubic-bezier(.22,1,.36,1)]",
        exiting ? "opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${fadeOutMs}ms` }}
    >
      <div className="w-[220px]">
        <div className="h-[1px] w-full bg-black/15 overflow-hidden">
          <div
            className="h-full w-full bg-black fake-loader-fill"
            style={{ ["--fake-loader-ms" as any]: `${minDurationMs}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

