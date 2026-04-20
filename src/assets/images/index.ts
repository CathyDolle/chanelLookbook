import i1 from "./i1.jpg";
import i2 from "./i2.jpg";
import i3 from "./i3.jpg";
import i4 from "./i4.webp";

export const lookbookImages = {
  i1,
  i2,
  i3,
  i4,
} as const;

export type LookbookImageKey = keyof typeof lookbookImages;

