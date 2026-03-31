import { useParams, Link } from "wouter";
import { useGetProductBySku, getGetProductBySkuQueryKey, useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, Home, ShoppingCart, Truck, ShieldCheck, Wrench, AlertCircle, PackageCheck } from "lucide-react";
import { ProductCard } from "@/components/product-card";

export default function ProductDetail() {
  const params = useParams();
  const sku = params.sku;
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, isError } = useGetProductBySku(sku || "", {
    query: {
      enabled: !!sku,
      queryKey: getGetProductBySkuQueryKey(sku || ""),
    }
  });

  // Fetch related products from same category
  const { data: relatedProductsData } = useGetProducts({
    category: product?.category,
    limit: 4,
  }, {
    query: {
      enabled: !!product?.category,
      queryKey: getGetProductsQueryKey({ category: product?.category, limit: 4 }),
    }
  });

  const relatedProducts = relatedProductsData?.products.filter(p => p.sku !== sku).slice(0, 4);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-6 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-32 w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-14 w-32" />
              <Skeleton className="h-14 flex-1" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-serif font-bold mb-4">Product Not Found</h1>
        <p className="text-muted-foreground mb-8">We couldn't find a part matching the SKU "{sku}". The item may have been discontinued or replaced.</p>
        <div className="flex flex-col gap-4">
          <Button asChild size="lg"><Link href="/shop">Browse Catalog</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/parts-identification">Use Free Parts ID Service</Link></Button>
        </div>
      </div>
    );
  }

  const price = Number(product.price);
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const isSale = originalPrice !== null && originalPrice > price;
  const savings = isSale ? originalPrice - price : 0;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Breadcrumbs */}
      <div className="bg-white border-b py-3 text-sm">
        <div className="container mx-auto px-4 flex items-center text-muted-foreground whitespace-nowrap overflow-x-auto hide-scrollbar">
          <Link href="/" className="hover:text-primary flex items-center shrink-0">
            <Home className="w-4 h-4" />
          </Link>
          <ChevronRight className="w-4 h-4 mx-2 shrink-0 opacity-50" />
          <Link href="/shop" className="hover:text-primary shrink-0">Shop</Link>
          <ChevronRight className="w-4 h-4 mx-2 shrink-0 opacity-50" />
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary shrink-0">{product.category}</Link>
          <ChevronRight className="w-4 h-4 mx-2 shrink-0 opacity-50" />
          <span className="text-foreground font-medium truncate">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-10 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Image Gallery (Simplified for now) */}
            <div className="relative rounded-xl border bg-white aspect-square flex items-center justify-center overflow-hidden p-8">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground opacity-50">
                  <Wrench className="w-24 h-24 mx-auto mb-4" />
                  <p className="font-bold uppercase tracking-wider">No Image Available</p>
                </div>
              )}
              {isSale && (
                <div className="absolute top-6 left-6 bg-accent text-accent-foreground px-4 py-1.5 rounded text-sm font-bold shadow-md">
                  Sale - Save ${savings.toFixed(2)}

                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm tracking-wider text-muted-foreground bg-slate-100 px-2 py-1 rounded">SKU: {product.sku}</span>
                {product.inStock ? (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                    <PackageCheck className="w-4 h-4" /> In Stock & Ready to Ship
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded">
                    <AlertCircle className="w-4 h-4" /> Temporarily Out of Stock
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 leading-tight mb-4">
                {product.name}
              </h1>
              
              <div className="mb-6 flex items-end gap-4">
                {isSale ? (
                  <>
                    <div className="text-4xl font-bold text-accent">${price.toFixed(2)}</div>
                    <div className="text-xl text-muted-foreground line-through pb-1">${originalPrice!.toFixed(2)}</div>
                  </>
                ) : (
                  <div className="text-4xl font-bold text-primary">${price.toFixed(2)}</div>
                )}
              </div>
              
              {product.description && (
                <div className="text-slate-600 mb-8 leading-relaxed">
                  <p>{product.description}</p>
                </div>
              )}

              {/* Action Area */}
              <div className="bg-slate-50 border p-6 rounded-xl mb-8">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center border bg-white rounded-md h-14 w-full sm:w-32 shrink-0">
                    <button 
                      type="button"
                      className="px-4 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xl rounded-l-md"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      min="1" 
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full text-center font-bold text-lg border-x-0 bg-transparent h-full focus:outline-none"
                    />
                    <button 
                      type="button"
                      className="px-4 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xl rounded-r-md"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  
                  <Button 
                    size="lg" 
                    className="h-14 flex-1 text-lg font-bold shadow-sm" 
                    disabled={!product.inStock}
                    onClick={() => addToCart(product, quantity)}
                  >
                    <ShoppingCart className="mr-2 w-5 h-5" /> 
                    {product.inStock ? "Add to Cart" : "Out of Stock"}
                  </Button>
                </div>
                
                <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 font-medium border-t pt-6">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-primary" /> Ships same day if ordered before 2PM CST
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary" /> Genuine Replacement Part - Quality Guaranteed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Info Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-10 mb-16">
          <Tabs defaultValue="specs" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto bg-transparent p-0 mb-8 overflow-x-auto hide-scrollbar">
              <TabsTrigger value="specs" className="text-base font-bold data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-4 px-6">Specifications</TabsTrigger>
              {product.compatibleBrands && product.compatibleBrands.length > 0 && (
                <TabsTrigger value="compatibility" className="text-base font-bold data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-4 px-6">Compatibility</TabsTrigger>
              )}
              <TabsTrigger value="shipping" className="text-base font-bold data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-4 px-6">Shipping & Returns</TabsTrigger>
            </TabsList>
            
            <TabsContent value="specs" className="mt-0">
              {product.specifications && Object.keys(product.specifications).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full max-w-2xl text-left border-collapse">
                    <tbody>
                      {Object.entries(product.specifications).map(([key, value], i) => (
                        <tr key={key} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                          <th className="py-3 px-4 font-medium text-slate-500 border-y w-1/3">{key}</th>
                          <td className="py-3 px-4 text-slate-900 font-medium border-y">{value}</td>
                        </tr>
                      ))}
                      <tr className={Object.keys(product.specifications).length % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Category</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">{product.category} {product.subcategory ? `> ${product.subcategory}` : ''}</td>
                      </tr>
                      <tr className={(Object.keys(product.specifications).length + 1) % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Supplier</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">{product.supplier}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">Detailed specifications are not available for this product.</p>
              )}
            </TabsContent>
            
            {product.compatibleBrands && product.compatibleBrands.length > 0 && (
              <TabsContent value="compatibility" className="mt-0">
                <p className="mb-4 text-slate-600">This part is known to be compatible with windows and doors from the following manufacturers:</p>
                <div className="flex flex-wrap gap-2">
                  {product.compatibleBrands.map(brand => (
                    <span key={brand} className="bg-slate-100 border text-slate-800 px-4 py-2 rounded-md font-medium">
                      {brand}
                    </span>
                  ))}
                </div>
                <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-lg flex gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm"><strong>Not sure if this fits?</strong> Use our <Link href="/parts-identification" className="underline font-bold">Free Parts Identification</Link> service before ordering. We'll verify compatibility for you.</p>
                </div>
              </TabsContent>
            )}
            
            <TabsContent value="shipping" className="mt-0 text-slate-600 space-y-4 max-w-3xl">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Shipping Information</h3>
              <p>In-stock items typically ship the same day if ordered before 2:00 PM Central Time, Monday through Friday.</p>
              <ul className="list-disc pl-5 space-y-1 mb-6">
                <li>Standard Shipping (3-5 business days)</li>
                <li>Expedited Shipping (2-3 business days)</li>
                <li>Next Day Air available at checkout</li>
              </ul>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 mt-8">Return Policy</h3>
              <p>We accept returns on unused, uninstalled parts within 30 days of delivery. Parts must be in original packaging.</p>
              <p className="text-sm italic">Note: Special order and custom-cut weatherstripping are non-returnable.</p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-slate-900">Similar Parts in {product.category}</h2>
              <Button variant="ghost" asChild>
                <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>View All <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
