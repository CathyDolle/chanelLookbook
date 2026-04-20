import type { LookbookImageKey } from "@/assets/images";

import look001img3 from "@/assets/images/chanel/001/3.jpg";
import look001img4 from "@/assets/images/chanel/001/4.jpg";

export type LookContentItem =
  | { type: "image"; src: string }
  | { type: "video"; src: string };

export const lookContentByLook: Partial<Record<LookbookImageKey, LookContentItem[]>> = {
  "001": [
    { type: "image", src: look001img3.src },
    // Les vidéos doivent venir de /public (pas d'import binaire via webpack)
    { type: "video", src: "/assets/chanel/001/2.mp4" },
    { type: "image", src: look001img4.src },
  ],
};

