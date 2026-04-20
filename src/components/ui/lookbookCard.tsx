import Image from "next/image";
import type { StaticImport } from "next/dist/shared/lib/get-img-props";
import { useState } from "react";

type LookbookCardProps = {
  img: string | StaticImport;
  title: string;
};

function LookbookCard({ img, title }: LookbookCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden bg-neutral-100 aspect-[3/4]">
        {!isLoaded && (
          <div className="absolute inset-0 skeleton-shimmer" />
        )}
        <Image
          src={img}
          alt={title}
          fill
          className="object-cover transition-opacity duration-700"
          style={{ opacity: isLoaded ? 1 : 0 }}
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          unoptimized={typeof img === "string" && img.endsWith(".svg")}
          onLoadingComplete={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
}

export default LookbookCard;
