import React, { useMemo, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import arrow from "@/assets/svgs/arrow.svg";
import star from "@/assets/svgs/star.svg";
import { useNextFrame } from "@/hooks";

export function LookTopNav({
  onBack,
  onToggleFav,
  className,
}: {
  onBack: () => void;
  onToggleFav?: () => void;
  className?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useNextFrame(() => setIsMounted(true), []);

  const appear = useMemo(
    () =>
      clsx(
        "transform-gpu opacity-0 -translate-y-6",
        "transition-[opacity,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
        isMounted && "opacity-100 translate-y-0",
      ),
    [isMounted],
  );

  return (
    <div
      className={clsx(
        "fixed left-0 right-0 top-0 z-[1002] px-16 pt-16",
        "pointer-events-none",
        className,
      )}
    >
      <div
        className={clsx(
          "pointer-events-auto",
          "flex items-center justify-between",
          "px-10 py-8 text-white",
        )}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className={clsx(
            "grid h-32 w-32 place-items-center rounded-full transition-opacity hover:opacity-80 active:opacity-70",
            appear,
          )}
        >
          <Image
            src={arrow}
            alt="retour"
            width={14}
            height={14}
            className="rotate-180 brightness-0 invert"
          />
        </button>

        <div aria-hidden className="w-32" />

        <button
          type="button"
          onClick={onToggleFav}
          aria-label="Ajouter aux favoris"
          className={clsx(
            "grid h-32 w-32 place-items-center rounded-full transition-opacity hover:opacity-80 active:opacity-70",
            !onToggleFav && "opacity-70",
            appear,
            "delay-[80ms]",
          )}
        >
          <Image src={star} alt="favori" width={22} height={22} />
        </button>
      </div>
    </div>
  );
}
