"use client";

import type { LookbookImageKey } from "@/assets/images";

export type FocusState =
  | { open: false }
  | {
      open: true;
      idx: number;
      phase: "entering" | "settling" | "open" | "exiting";
    };

export type CoverTransitionState = null | {
  idx: number;
  lookKey: LookbookImageKey;
  title: string;
  from: { left: number; top: number; width: number; height: number };
  to: { left: number; top: number; width: number; height: number };
  phase: "from" | "to" | "final";
};

