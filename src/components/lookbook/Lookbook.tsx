'use client'
import { Container } from "@/components";
import LookbookCard from "@/components/ui/lookbookCard";
import { lookbookImages, type LookbookImageKey } from "@/assets/images";
import lookbook from "@/data/lookbook.json";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

export function Lookbook() {
  const spanSteps = useMemo(() => [3, 4, 6, 12] as const, []);

  const [stepIdx, setStepIdx] = useState<number>(0);

  const pinch = useRef<{
    startDist: number;
    lastActionAt: number;
  }>({ startDist: 0, lastActionAt: 0 });

  const clampStep = (idx: number) =>
    Math.max(0, Math.min(spanSteps.length - 1, idx));

  const zoomInAll = () => setStepIdx((i) => clampStep(i + 1));
  const zoomOutAll = () => setStepIdx((i) => clampStep(i - 1));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const key = e.key.toLowerCase();
      if (key === "a") {
        zoomInAll();
      } else if (key === "z") {
        zoomOutAll();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        <div className="flex flex-wrap gutter-gap-1">
          {lookbook.map((item, idx) => (
            <div
              key={item.title}
              className={clsx(
                stepIdx === 0 && "span-w-3",
                stepIdx === 1 && "span-w-4",
                stepIdx === 2 && "span-w-6",
                stepIdx === 3 && "span-w-12",
                "touch-none select-none will-change-[width] transition-[width,flex-basis,max-width] duration-500 ease-out",
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

