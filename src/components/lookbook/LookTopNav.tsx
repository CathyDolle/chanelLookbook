import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import arrow from "@/assets/svgs/arrow.svg";
import star from "@/assets/svgs/star.svg";

export function LookTopNav({
  title,
  onBack,
  onToggleFav,
  className,
}: {
  title: string;
  onBack: () => void;
  onToggleFav?: () => void;
  className?: string;
}) {
  const [currentTitle, setCurrentTitle] = useState(title);
  const [incomingTitle, setIncomingTitle] = useState<string | null>(null);
  const [isFadingTitle, setIsFadingTitle] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (title === currentTitle) return;
    // Si ça change en boucle pendant le scroll, on garde juste la dernière valeur.
    setIncomingTitle(title);
    // Déclenche le fade après que le DOM ait rendu le nouveau texte.
    const id = requestAnimationFrame(() => setIsFadingTitle(true));
    return () => cancelAnimationFrame(id);
  }, [title, currentTitle]);

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

        <div className={clsx("flex-1 px-10 text-center", appear, "delay-[40ms]")}>
          <div className="relative mx-auto h-[18px] overflow-hidden">
            <div className="relative h-[18px]">
              <div
                className={clsx(
                  "absolute inset-0 truncate text-14 font-serif tracking-wide leading-[18px] will-change-[opacity]",
                  "transition-opacity duration-250 ease-[cubic-bezier(.22,1,.36,1)]",
                )}
                style={{
                  opacity: isFadingTitle ? 0 : 1,
                }}
              >
                {currentTitle}
              </div>

              <div
                className={clsx(
                  "absolute inset-0 truncate text-14 font-serif tracking-wide leading-[18px] will-change-[opacity]",
                  "transition-opacity duration-250 ease-[cubic-bezier(.22,1,.36,1)]",
                )}
                style={{
                  opacity: isFadingTitle ? 1 : 0,
                }}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== "opacity") return;
                  if (!incomingTitle) return;
                  setCurrentTitle(incomingTitle);
                  setIncomingTitle(null);
                  setIsFadingTitle(false);
                }}
              >
                {incomingTitle ?? currentTitle}
              </div>
            </div>
          </div>
        </div>

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
