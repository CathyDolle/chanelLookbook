"use client";

import cx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components";

export interface GridProps {
  //
}

export const Grid = () => {
  const isDev = process.env.NODE_ENV === "development";
  const [isVisible, setIsVisible] = useState(true);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "g") setIsVisible((v) => !v);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isDev) return null;

  return (
    <div className="fixed inset-0 z-[999] h-full w-full pointer-events-none">
      <Container className="flex h-full flex-row gutter-gap">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={cx(
              "lg-max:hidden span-w-1 h-full bg-red bg-opacity-10",
              "transition-transform duration-500 ease-in-out origin-top",
              !isVisible ? "scale-y-0" : "scale-y-full",
            )}
          />
        ))}

        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cx(
              "lg:hidden span-w-1 h-full bg-red bg-opacity-10",
              "transition-transform duration-500 ease-in-out origin-top",
              !isVisible ? "scale-y-0" : "scale-y-full",
            )}
          />
        ))}
      </Container>
    </div>
  );
};
