import { useState } from "react";
import { Wrench } from "lucide-react";

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
      <div className={placeholderClassName ?? "w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-slate-50"}>
        <Wrench className="w-12 h-12 mb-2 opacity-20" />
        <span className="text-xs uppercase tracking-widest opacity-50 font-bold">No Image</span>
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
