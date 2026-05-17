import { useCart } from "@/lib/cart";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import { ShoppingCart, PackageCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product-image";

const CATEGORY_SNIPPETS: Record<string, string> = {
  "Window Balances":                   "Replacement sash balance for smooth, reliable window operation.",
  "Window Hardware":                   "Genuine replacement hardware for casement, awning, and double-hung windows.",
  "Sash Hardware":                     "Tilt latches, pivot bars, and sash components for proper window function.",
  "Door Hardware":                     "Replacement locks, handles, hinges, and rollers for patio and entry doors.",
  "Window Glazing and Weatherstrip":   "Seals, glazing, and weatherstripping to stop drafts and improve energy efficiency.",
  "Screen Hardware and Accessories":   "Screen frames, spline, rollers, and hardware for screen door and window repair.",
  "Other Hardware":                    "Specialty and hard-to-find window and door replacement parts.",
};

function getCategorySnippet(category?: string | null, description?: string | null): string | null {
  if (!category) return null;
  const isGeneric = description?.toLowerCase().includes("email us photos");
  if (!isGeneric && description && description.length > 20) return null;
  return CATEGORY_SNIPPETS[category] ?? null;
}

type ProductWithVariantCount = Product & { variantCount?: number };

interface ProductCardProps {
  product: ProductWithVariantCount;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  const price = Number(product.price);
  const isCallForPricing = !product.price || price === 0 || isNaN(price);
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const isSale = !isCallForPricing && originalPrice !== null && originalPrice > price;
  const snippet = getCategorySnippet(product.category, product.description);
  const variantCount = product.variantCount ?? 1;

  return (
    <div className="group relative bg-card border border-border rounded-lg overflow-hidden hover-elevate transition-all duration-300 flex flex-col h-full">
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {isSale && (
          <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded shadow-sm">
            Sale
          </span>
        )}
        {isCallForPricing && (
          <span className="bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
            Contact for Price
          </span>
        )}
        {!product.inStock && (
          <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded border shadow-sm">
            Out of Stock
          </span>
        )}
      </div>
      {/* Variant count badge — top right */}
      {variantCount > 1 && (
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-slate-800/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm backdrop-blur-sm">
            <Layers className="w-3 h-3" />
            {variantCount} options
          </span>
        </div>
      )}

      <Link href={`/product/${product.sku}`} className="block relative aspect-square bg-white border-b overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
        />
      </Link>

      <div className="p-4 md:p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-xs text-muted-foreground font-mono truncate">{product.sku}</span>
          {product.category && (
            <span className="text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 uppercase tracking-wide">
              {product.category.replace(" and ", " & ")}
            </span>
          )}
        </div>
        
        <Link href={`/product/${product.sku}`}>
          <h3 className="font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>

        {snippet && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-1.5">{snippet}</p>
        )}
        
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            {isCallForPricing ? (
              <span className="text-sm font-bold text-amber-700 block mb-1">Contact for Pricing</span>
            ) : (
              isSale ? (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground line-through">${originalPrice!.toFixed(2)}</span>
                  <span className="text-xl font-bold text-accent">${price.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-xl font-bold text-primary block">${price.toFixed(2)}</span>
              )
            )}
            {product.inStock ? (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1 uppercase tracking-wider">
                <PackageCheck className="w-3 h-3" /> In Stock
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-wider block">
                Backordered
              </span>
            )}
          </div>
          
          <Button 
            size="icon" 
            variant="secondary"
            className="rounded-full w-10 h-10 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm"
            disabled={!product.inStock || isCallForPricing}
            onClick={(e) => {
              e.preventDefault();
              addToCart(product);
            }}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="sr-only">Add to Cart</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
