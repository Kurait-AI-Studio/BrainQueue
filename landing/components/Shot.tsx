import Image from "next/image";

/**
 * A real BrainQueue product screenshot in a calm frame.
 * (Replaces the old div-built fake UI: these are captures of the actual app.)
 */
export function Shot({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
  sizes = "(max-width: 768px) 92vw, 600px",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0e] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)] ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className="h-auto w-full"
      />
    </figure>
  );
}
