"use client";

import { useEffect } from "react";

export default function useNextFrame(effect: () => void, deps: unknown[]) {
  useEffect(() => {
    const id = requestAnimationFrame(() => effect());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

