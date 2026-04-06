import { useState } from "react";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export function ProductImage({ src, alt, className, placeholderClassName }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={placeholderClassName ?? "w-full h-full flex items-center justify-center bg-slate-50"}>
        <img
          src="/awdp-logo-placeholder.png"
          alt="All Window Door Parts"
          className="w-3/4 max-w-[200px] object-contain"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
