import Image from "next/image";
import type { StaticImport } from "next/dist/shared/lib/get-img-props";

type LookbookCardProps = {
  img: string | StaticImport;
  title: string;
};

function LookbookCard({ img, title }: LookbookCardProps) {
  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden bg-neutral-100 aspect-[3/4]">
        <Image
          src={img}
          alt={title}
          fill
          className="object-cover"
          sizes="span-w-3"
          unoptimized={typeof img === "string" && img.endsWith(".svg")}
        />
      </div>
    </div>
  );
}

export default LookbookCard;
