import { useEffect, useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { logo as logoRainbow } from "../lib/assetUrls.js";
import { getProductImageCandidates } from "../lib/product-image-url.js";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  loading?: "lazy" | "eager";
}

export function ProductImage({ src, alt, className, placeholderClassName, loading = "lazy" }: ProductImageProps) {
  const candidates = useMemo(() => getProductImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  const activeSrc = candidates[candidateIndex];
  if (!activeSrc) {
    return (
      <div className={placeholderClassName ?? "w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-slate-50"}>
        <Wrench className="w-12 h-12 mb-2 opacity-20" aria-hidden="true" />
        <span className="text-xs uppercase tracking-widest opacity-50 font-bold">No Image</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <img
        src={activeSrc}
        alt={alt}
        className={`${className ?? ""} !w-auto !h-auto max-w-full max-h-full object-contain`}
        loading={loading}
        decoding="async"
        fetchPriority={loading === "eager" ? "high" : "auto"}
        draggable={false}
        style={{ imageRendering: "auto" }}
        onError={() => setCandidateIndex((index) => index + 1)}
      />
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
