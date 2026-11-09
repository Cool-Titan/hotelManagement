import Image, { type ImageProps } from "next/image";
import blur from "@/data/blur.json";

// next/image serves AVIF/WebP at the size each screen needs; the 16px blur
// placeholder shows instantly on slow hill-station connections.
export function Photo({ src, alt, ...rest }: Omit<ImageProps, "src" | "placeholder" | "blurDataURL"> & { src: string }) {
  const placeholder = (blur as Record<string, string>)[src];
  return (
    <Image
      src={src}
      alt={alt}
      placeholder={placeholder ? "blur" : "empty"}
      blurDataURL={placeholder}
      quality={70}
      {...rest}
    />
  );
}
