import { useParams, Link } from "wouter";
import { useGetProductBySku, getGetProductBySkuQueryKey, useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Truck, ShieldCheck, AlertCircle, PackageCheck, Mail, Camera, Wrench, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";

interface Variant {
  sku: string; name: string; variantLabel: string | null;
  price: string; inStock: boolean; imageUrl: string | null;
}

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
    limit: 8,
  }, {
    query: {
      enabled: !!product?.category,
      queryKey: getGetProductsQueryKey({ category: product?.category, limit: 8 }),
    }
  });

  const relatedProducts = relatedProductsData?.products.filter(p => p.sku !== sku).slice(0, 4);

  // Cross-sell: products from a complementary search term based on category
  const crossSellSearch = product?.category?.toLowerCase().includes("balance") ? "casement operator"
    : product?.category?.toLowerCase().includes("casement") ? "sash balance"
    : product?.category?.toLowerCase().includes("door") ? "weatherstripping"
    : product?.category?.toLowerCase().includes("screen") ? "window lock"
    : "weatherstripping";

  const { data: crossSellData } = useGetProducts({
    search: crossSellSearch,
    limit: 4,
  }, {
    query: {
      enabled: !!product,
      queryKey: getGetProductsQueryKey({ search: crossSellSearch, limit: 4 }),
    }
  });

  const crossSellProducts = crossSellData?.products.filter(p => p.sku !== sku).slice(0, 4);

  // Fetch sibling variants
  const { data: variantsData } = useQuery({
    queryKey: ["variants", sku],
    queryFn: async () => {
      const res = await fetch(`/api/products/${encodeURIComponent(sku!)}/variants`);
      if (!res.ok) return { variants: [] };
      return res.json() as Promise<{ variants: Variant[] }>;
    },
    enabled: !!sku,
  });
  const variants = variantsData?.variants ?? [];

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
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white border-0"><Link href="/parts-identification">Use Free Parts ID Service</Link></Button>
        </div>
      </div>
    );
  }

  const price = Number(product.price);
  const isCallForPricing = price < 50;
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const isSale = !isCallForPricing && originalPrice !== null && originalPrice > price;
  const savings = isSale ? originalPrice - price : 0;

  const CATEGORY_INTROS: Record<string, string> = {
    "Window Balances": "If your window won't stay open, slams shut, or feels too heavy to lift, the window balance is usually the cause. Balances wear out gradually — especially in older or frequently-used windows.",
    "Window Hardware": "Difficulty opening or closing a casement or awning window often points to a worn operator. A stripped crank, seized mechanism, or cracked arm are common signs the operator needs replacing.",
    "Sash Hardware": "Loose sash locks, broken tilt latches, or a sash that won't stay in place are common issues in double-hung windows. These parts are designed to be user-replaceable without removing the window.",
    "Door Hardware": "A sliding glass door that sticks, drags, or jumps off the track usually has worn rollers. Replacing the roller assembly is one of the most effective repairs for a patio door.",
    "Window Glazing and Weatherstrip": "Drafts, water infiltration, or rising heating and cooling bills are clear signs your weatherstripping has worn out. Most profiles pull out of the kerf channel and press back in — no tools required.",
    "Screen Hardware and Accessories": "Torn screen fabric, bent frame sections, or missing hardware can usually be repaired piece by piece. You rarely need a whole new screen — just the parts that have failed.",
    "Other Hardware": "Can't find your part in the standard categories? Many specialty and discontinued window and door parts are available here. Use our Free Parts ID service if you need help identifying an unusual or obsolete part.",
  };
  const categoryIntro = CATEGORY_INTROS[product.category] ?? null;

  const productAlt = `${product.name} — SKU ${product.sku} replacement window door part`;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo
        title={`${product.name} — SKU ${product.sku}`}
        path={`/product/${product.sku}`}
        description={`Buy ${product.name} (SKU: ${product.sku}) — ${product.category} replacement part. ${product.description ? product.description.slice(0, 100) + "…" : "In stock at All Window Door Parts. Veteran-owned, 40+ years experience. Email info@allwindowdoorparts.com."}`}
        image={product.imageUrl ?? undefined}
        type="product"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            sku: product.sku,
            description: product.description ?? `${product.name} — window or door replacement part`,
            image: product.imageUrl ?? undefined,
            brand: { "@type": "Brand", name: product.supplier ?? "All Window Door Parts" },
            ...(Number(product.price) > 0 ? {
              offers: {
                "@type": "Offer",
                price: Number(product.price).toFixed(2),
                priceCurrency: "USD",
                availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                url: `https://www.allwindowdoorparts.com/product/${product.sku}`,
                seller: { "@type": "Organization", name: "All Window Door Parts" }
              }
            } : {})
          },
          ] as unknown as object}
      />

      <Breadcrumb items={[
        { label: "Shop Parts", href: "/shop" },
        { label: product.category, href: `/shop?category=${encodeURIComponent(product.category)}` },
        { label: product.name },
      ]} />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-10 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Product Image */}
            <div className="relative rounded-xl border bg-white aspect-square flex items-center justify-center overflow-hidden p-8">
              <ProductImage
                src={product.imageUrl}
                alt={productAlt}
                className="w-full h-full object-contain"
                placeholderClassName="w-full h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50"
                loading="eager"
              />
              {isSale && (
                <div className="absolute top-6 left-6 bg-accent text-accent-foreground px-4 py-1.5 rounded text-sm font-bold shadow-md">
                  Sale - Save ${savings.toFixed(2)}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Category symptom intro */}
              {categoryIntro && (
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-sm text-blue-800 leading-relaxed">{categoryIntro}</p>
                </div>
              )}

              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm tracking-wider text-muted-foreground bg-slate-100 px-2 py-1 rounded">SKU: {product.sku}</span>
                {product.inStock ? (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                    <PackageCheck className="w-4 h-4" /> In Stock
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
                {isCallForPricing ? (
                  <div className="text-2xl font-bold text-primary">Email for Details</div>
                ) : isSale ? (
                  <>
                    <div className="text-4xl font-bold text-accent">${price.toFixed(2)}</div>
                    <div className="text-xl text-muted-foreground line-through pb-1">${originalPrice!.toFixed(2)}</div>
                  </>
                ) : (
                  <div className="text-4xl font-bold text-primary">${price.toFixed(2)}</div>
                )}
              </div>
              
              {product.description && (
                <div className="text-slate-600 mb-6 leading-relaxed">
                  <p>{product.description}</p>
                </div>
              )}

              {/* Variant picker */}
              {variants.length > 1 && (
                <div className="mb-6">
                  <p className="text-sm font-bold text-slate-700 mb-2">Available Variants</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <Link href={`/product/${encodeURIComponent(v.sku)}`} key={v.sku}>
                        <button
                          type="button"
                          className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                            v.sku === sku
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-slate-700 border-slate-300 hover:border-primary hover:text-primary"
                          }`}
                          aria-current={v.sku === sku ? "true" : undefined}
                        >
                          {v.variantLabel ?? v.sku}
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Area */}
              <div className="bg-slate-50 border p-6 rounded-xl mb-6">
                {isCallForPricing ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-slate-600 text-sm">Email us your SKU and quantity for pricing — we respond within 1 business day.</p>
                    <Button size="lg" className="h-14 w-full text-lg font-bold shadow-sm" asChild>
                      <a href={`mailto:info@allwindowdoorparts.com?subject=Quote Request: ${product.sku}&body=Hi, I'd like pricing for SKU ${product.sku} (${product.name}).%0A%0AQuantity needed: %0AAdditional notes: `}>
                        <Mail className="mr-2 w-5 h-5" aria-hidden="true" /> Email info@allwindowdoorparts.com
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center border bg-white rounded-md h-14 w-full sm:w-32 shrink-0">
                      <button 
                        type="button"
                        className="px-4 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xl rounded-l-md"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        min="1" 
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center font-bold text-lg border-x-0 bg-transparent h-full focus:outline-none"
                        aria-label="Quantity"
                      />
                      <button 
                        type="button"
                        className="px-4 h-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-xl rounded-r-md"
                        onClick={() => setQuantity(quantity + 1)}
                        aria-label="Increase quantity"
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
                )}
                
                <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 font-medium border-t pt-6">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-primary shrink-0" /> Shipping calculated at checkout — some items may require distributor sourcing
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Genuine Replacement Part - Quality Guaranteed
                  </div>
                  {!isCallForPricing && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800 font-semibold text-xs mt-1">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      $50 minimum on all orders &mdash; Anything below $50 will be cancelled
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Parts ID Help CTA */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-4">
                <Camera className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-900 mb-0.5">Not sure this is the right part?</p>
                  <p className="text-xs text-blue-700 leading-relaxed">Send us a photo and our experts will confirm compatibility — free, no obligation.</p>
                </div>
                <Button asChild size="sm" className="bg-blue-700 hover:bg-blue-800 text-white border-0 shrink-0 text-xs h-8">
                  <Link href="/parts-identification">Get Help</Link>
                </Button>
              </div>

              {/* Supplier / category info */}
              {product.supplier && (
                <p className="mt-5 text-xs text-slate-400">
                  Supplied by <span className="font-semibold text-slate-600">{product.supplier}</span> &middot; Category: <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary transition-colors">{product.category}</Link>
                </p>
              )}
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
              {["Window Balances", "Window Hardware", "Door Hardware", "Window Glazing and Weatherstrip"].includes(product.category) && (
                <TabsTrigger value="measure" className="text-base font-bold data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-4 px-6">Measurement Guide</TabsTrigger>
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
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">
                          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary transition-colors">
                            {product.category}
                          </Link>
                          {product.subcategory ? ` > ${product.subcategory}` : ''}
                        </td>
                      </tr>
                      <tr className={(Object.keys(product.specifications).length + 1) % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Supplier</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">{product.supplier}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl">
                  <table className="w-full text-left border-collapse">
                    <tbody>
                      <tr className="bg-slate-50">
                        <th className="py-3 px-4 font-medium text-slate-500 border-y w-1/3">SKU</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y font-mono">{product.sku}</td>
                      </tr>
                      <tr className="bg-white">
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Category</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">
                          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary transition-colors">
                            {product.category}
                          </Link>
                          {product.subcategory ? ` > ${product.subcategory}` : ''}
                        </td>
                      </tr>
                      {product.supplier && (
                        <tr className="bg-slate-50">
                          <th className="py-3 px-4 font-medium text-slate-500 border-y">Supplier</th>
                          <td className="py-3 px-4 text-slate-900 font-medium border-y">{product.supplier}</td>
                        </tr>
                      )}
                      <tr className="bg-white">
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Availability</th>
                        <td className="py-3 px-4 font-medium border-y">
                          {product.inStock ? (
                            <span className="text-emerald-600">In Stock</span>
                          ) : (
                            <span className="text-amber-600">Temporarily Out of Stock</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
                    <Wrench className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-800">
                      Need exact dimensions or specs? <Link href="/parts-identification" className="font-bold underline">Use our Free Parts ID</Link> or <a href="mailto:info@allwindowdoorparts.com" className="font-bold underline">email our experts</a> — we'll confirm the right part.
                    </p>
                  </div>
                </div>
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
            
            {["Window Balances", "Window Hardware", "Door Hardware", "Window Glazing and Weatherstrip"].includes(product.category) && (
              <TabsContent value="measure" className="mt-0 text-slate-600 space-y-6 max-w-3xl">
                {{
                  "Window Balances": (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure Your Window Balance</h3>
                      <p>Ordering the correct balance requires three measurements from your existing balance or sash:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Balance length</strong> — measure the full length of the existing balance tube or channel from end to end (in inches).</li>
                        <li><strong>Sash weight</strong> — if using a block &amp; tackle or spiral balance, the tension must match the sash weight. Weigh the sash if possible, or note the tension stamp on the existing balance.</li>
                        <li><strong>Stamp or part number</strong> — most balances have a stamp printed or embossed on the side. Include this when using our Free Parts ID service.</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        Not sure? Send us a photo of the balance and the open window channel — our experts will identify the correct replacement free of charge.
                      </div>
                    </>
                  ),
                  "Window Hardware": (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure for a Replacement Operator</h3>
                      <p>Casement and awning window operators vary by handing, arm style, and mounting pattern. To find the correct replacement:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Handing</strong> — stand inside facing the window. If the crank is on the right, it is a right-hand operator; left side means left-hand.</li>
                        <li><strong>Arm style</strong> — note whether you have a single arm, split arm, or dual arm (parallel arms). Take a photo.</li>
                        <li><strong>Mounting holes</strong> — measure the distance between mounting screw holes and compare to the new operator's spec sheet.</li>
                        <li><strong>Brand</strong> — check the sill track or crank housing for a brand name or logo (Truth, EntryGard, Andersen, etc.).</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        When in doubt, photograph the old operator from the front and side and use our Free Parts ID — we match operators by photo every day.
                      </div>
                    </>
                  ),
                  "Door Hardware": (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure Your Patio Door Roller</h3>
                      <p>Roller replacement requires matching the wheel diameter, housing width, and mounting style:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Wheel diameter</strong> — remove the roller housing from the door bottom and measure the wheel diameter in millimeters or inches.</li>
                        <li><strong>Housing dimensions</strong> — measure the overall length, width, and height of the housing assembly.</li>
                        <li><strong>Wheel material</strong> — nylon, stainless steel, or tandem wheels each perform differently and are not interchangeable.</li>
                        <li><strong>Door brand</strong> — look on the door frame header or stile for a manufacturer label.</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        A photo of the removed roller next to a coin for scale helps us identify it instantly. Use our Free Parts ID service before ordering.
                      </div>
                    </>
                  ),
                  "Window Glazing and Weatherstrip": (
                    <>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure Your Weatherstripping</h3>
                      <p>Weatherstrip profiles are highly specific to window brand and installation type. Before ordering:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Profile type</strong> — identify if it is a kerf-in (press into slot), foam tape (self-adhesive), fin seal, or bulb style.</li>
                        <li><strong>Kerf width</strong> — for kerf-in types, measure the slot width in the sash or frame (typically 3/32" or 1/8").</li>
                        <li><strong>Overall height</strong> — measure the full fin height of the weatherstrip from root to tip.</li>
                        <li><strong>Length needed</strong> — measure all four sides of the window or door opening in linear feet.</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        Send us a cross-section photo of the existing strip (cut a 1" piece with scissors) and we will match the profile for you — free.
                      </div>
                    </>
                  ),
                }[product.category]}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                  <Link href="/parts-identification" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
                    <Camera className="w-4 h-4" /> Use Free Parts ID — Upload a Photo
                  </Link>
                  <a href="mailto:info@allwindowdoorparts.com" className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 hover:border-primary hover:text-primary font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                    <Mail className="w-4 h-4" /> Email Our Experts
                  </a>
                </div>
              </TabsContent>
            )}

            <TabsContent value="shipping" className="mt-0 text-slate-600 space-y-4 max-w-3xl">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Shipping Information</h3>
              <p>Shipping costs are calculated at checkout based on your delivery address, package weight, and dimensions. We ship via UPS, FedEx, and/or USPS.</p>
              <p>Please note that <strong>not all orders ship immediately</strong>. Some items need to be sourced from our distributors before they can be sent out. If your order requires additional lead time, we will contact you.</p>
              <ul className="list-disc pl-5 space-y-1 mb-6">
                <li>Standard Shipping (3-5 business days from ship date)</li>
                <li>Expedited Shipping (2-3 business days from ship date)</li>
                <li>Next Day Air available at checkout</li>
              </ul>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 mt-8">Return Policy</h3>
              <p>We accept returns on unused, uninstalled parts within 30 days of delivery. Parts must be in original packaging.</p>
              <p className="text-sm italic">Note: Special order and custom-cut weatherstripping are non-returnable.</p>

              <div className="mt-6 bg-slate-50 border rounded-lg px-4 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-slate-700">Questions about your order? Email us at <a href="mailto:info@allwindowdoorparts.com" className="font-bold text-primary">info@allwindowdoorparts.com</a> — we respond within 1 business day.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products — same category */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-slate-900">More {product.category}</h2>
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

        {/* Cross-sell — complementary parts */}
        {crossSellProducts && crossSellProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-serif font-bold text-slate-900">Customers Also Buy</h2>
                <p className="text-sm text-slate-500 mt-1">Frequently purchased together with {product.category} hardware</p>
              </div>
              <Button variant="ghost" asChild>
                <Link href={`/shop?search=${encodeURIComponent(crossSellSearch)}`}>Browse More <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {crossSellProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
