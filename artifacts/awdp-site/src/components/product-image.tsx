import { useState } from "react";
import { Wrench } from "lucide-react";
import { logo as logoRainbow } from "../lib/assetUrls.js";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  loading?: "lazy" | "eager";
}

export function ProductImage({ src, alt, className, placeholderClassName, loading = "lazy" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={placeholderClassName ?? "w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-slate-50"}>
        <Wrench className="w-12 h-12 mb-2 opacity-20" />
        <span className="text-xs uppercase tracking-widest opacity-50 font-bold">No Image</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <img
        src={src}
        alt={alt}
        width="400"
        height="400"
        className={className}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
      />
      {/* Rainbow logo watermark — bottom-right corner */}
      <img
        src={logoRainbow}
        alt=""
        aria-hidden="true"
        className="absolute bottom-1.5 right-1.5 w-[38%] max-w-[120px] opacity-85 pointer-events-none select-none"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
