import { useCart } from "@/lib/cart";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";
import { Link } from "wouter";
import { ShoppingCart, PackageCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product-image";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

  const price = Number(product.price);
  const isCallForPricing = price < 50;
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const isSale = !isCallForPricing && originalPrice !== null && originalPrice > price;

  return (
    <div className="group relative bg-card border border-border rounded-lg overflow-hidden hover-elevate transition-all duration-300 flex flex-col h-full">
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {isSale && (
          <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded shadow-sm">
            Sale
          </span>
        )}
        {!product.inStock && (
          <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded border shadow-sm">
            Out of Stock
          </span>
        )}
      </div>

      <Link href={`/product/${product.sku}`} className="block relative aspect-square bg-white border-b overflow-hidden">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
        />
      </Link>

      <div className="p-4 md:p-5 flex flex-col flex-1">
        <div className="text-xs text-muted-foreground mb-1 font-mono">{product.sku}</div>
        
        <Link href={`/product/${product.sku}`}>
          <h3 className="font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>
        
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            {isCallForPricing ? (
              <span className="text-sm font-bold text-primary block">Email for Details</span>
            ) : isSale ? (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground line-through">${originalPrice!.toFixed(2)}</span>
                <span className="text-xl font-bold text-accent">${price.toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-xl font-bold text-primary block">${price.toFixed(2)}</span>
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
          
          {isCallForPricing ? (
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full w-10 h-10 shrink-0 shadow-sm"
              asChild
            >
              <a href="mailto:info@allwindowdoorparts.com" aria-label="Email for details">
                <Mail className="w-4 h-4" />
              </a>
            </Button>
          ) : (
            <Button 
              size="icon" 
              variant="secondary"
              className="rounded-full w-10 h-10 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm"
              disabled={!product.inStock}
              onClick={(e) => {
                e.preventDefault();
                addToCart(product);
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="sr-only">Add to Cart</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
