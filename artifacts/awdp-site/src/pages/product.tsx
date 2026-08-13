import { useParams, Link, useLocation } from "wouter";
import { useGetProductBySku, getGetProductBySkuQueryKey, useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, ShieldCheck, AlertCircle, PackageCheck, PackageSearch, Mail, Camera, Wrench, ChevronRight, CheckCircle2, Layers, Star } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { BalanceDiagram, OperatorDiagram, RollerDiagram, WeatherstripDiagram } from "@/components/measurement-diagrams";
import { AttributeConfigurator } from "@/components/attribute-configurator";
import type { Product } from "@/lib/schema/product";
import { getCategoryByName } from "@/lib/categories";

function categoryHref(category: string): string {
  const known = getCategoryByName(category);
  return known ? `/category/${known.slug}` : `/shop?category=${encodeURIComponent(category)}`;
}

interface Variant {
  sku: string; name: string; variantLabel: string | null;
  price: string; inStock: boolean; imageUrl: string | null;
}

export default function ProductDetail() {
  const params = useParams();
  const sku = params.sku;
  const { addToCart } = useCart();
  const [, navigate] = useLocation();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, isError, isFetching, isPlaceholderData } = useGetProductBySku(sku || "", {
    query: {
      enabled: !!sku,
      queryKey: getGetProductBySkuQueryKey(sku || ""),
      // Keep the currently-displayed variant on screen while a sibling variant loads,
      // instead of unmounting into the skeleton — makes the dropdown feel like an
      // in-place swap rather than a navigation to a different product page.
      placeholderData: keepPreviousData,
    }
  });
  const isSwitchingVariant = isFetching && isPlaceholderData;

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

  const relatedProducts = relatedProductsData?.products.filter((p: typeof relatedProductsData['products'][0]) => p.sku !== sku).slice(0, 4);

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

  const crossSellProducts = crossSellData?.products.filter((p: typeof crossSellData['products'][0]) => p.sku !== sku).slice(0, 4);

  // Fetch sibling variants
  const { data: variantsData } = useQuery({
    queryKey: ["variants", sku],
    queryFn: async () => {
      const res = await fetch(`/api/products/${encodeURIComponent(sku!)}/variants`);
      if (!res.ok) return { variants: [] };
      return res.json() as Promise<{ variants: Variant[] }>;
    },
    enabled: !!sku,
    placeholderData: keepPreviousData,
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
  const isCallForPricing = !product.price || price === 0 || isNaN(price);
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
  const isSale = !isCallForPricing && originalPrice !== null && originalPrice > price;
  const savings = isSale ? originalPrice - price : 0;

  // Derive "Before Ordering" notes from AWDP attributes balance type
  // Cast through `unknown`: the generated API client's Product type (orval,
  // driven by lib/api-spec/openapi.yaml) hasn't caught up with the real
  // `products` table columns below, so it doesn't structurally overlap.
  const productAttributes = (product as unknown as Product).attributes;
  const productSoldAs = (product as unknown as Product).soldAs;
  const balanceTypeRaw = productAttributes?.balance_type;
  const balanceType = (Array.isArray(balanceTypeRaw) ? balanceTypeRaw[0] : balanceTypeRaw)?.toString().toLowerCase() ?? "";
  const attrNotes: string[] =
    balanceType.includes("channel") || balanceType.includes("block")
      ? ["Match stamping code exactly", "Verify metal channel length (end to end)", "Confirm terminal shoe style (15-001, 15-002, or 15-004)"]
      : balanceType.includes("spiral")
      ? ["Match tip color to existing balance", "Verify tube diameter (3/8\" or 1/2\")", "Confirm length (end to end)"]
      : balanceType.includes("coil")
      ? ["Match coil weight rating", "Verify coil series number", "Confirm single or double pack configuration"]
      : balanceType.includes("tilt")
      ? ["Match terminal / tip color exactly", "Verify sash position (top vs. bottom)", "Confirm jamb liner type"]
      : balanceType.includes("oem")
      ? ["Verify OEM family / brand and series", "Confirm length and configuration", "Send photos if unsure"]
      : [];

  const CATEGORY_INTROS: Record<string, string> = {
    "Window Balances": "If your window won't stay open, slams shut, or feels too heavy to lift, the window balance is usually the cause. Balances wear out gradually — especially in older or frequently-used windows.",
    "Window Hardware": "Difficulty opening or closing a casement or awning window often points to a worn operator or hinge. A stripped crank, seized mechanism, or cracked hinge arm are common signs the hardware needs replacing.",
    "Sash Hardware": "Loose sash locks, broken tilt latches, or a sash that won't stay in place are common issues in double-hung windows. These parts are designed to be user-replaceable without removing the window.",
    "Window Glazing and Weatherstrip": "Drafts, water infiltration, or rising heating and cooling bills are clear signs your weatherstripping has worn out. Most profiles pull out of the kerf channel and press back in — no tools required.",
    "Screen Hardware and Accessories": "Torn screen fabric, bent frame sections, or missing hardware can usually be repaired piece by piece. You rarely need a whole new screen — just the parts that have failed.",
    "Other Hardware": "Can't find your part in the standard categories? Many specialty and discontinued window and door parts are available here. Use our Free Parts ID service if you need help identifying an unusual or obsolete part.",
  };

  // Door Hardware intro is name-sensitive — rollers vs. handles vs. hinges vs. locks
  const getDoorHardwareIntro = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("roller") || n.includes("wheel") || n.includes("tandem"))
      return "A sliding glass door that sticks, drags, or jumps off the track usually has worn rollers. Replacing the roller assembly is one of the most effective repairs for a patio door.";
    if (n.includes("handle") || n.includes("latch") || n.includes("mortise"))
      return "A broken, stiff, or loose patio door handle or latch is a common repair. Replacing the handle set restores smooth, secure door operation and proper latching.";
    if (n.includes("hinge") || n.includes("hinge arm") || n.includes("pivot"))
      return "Worn or damaged door hinges can cause misalignment, sticking, or failure to close properly. Replacing the hinge assembly restores correct door swing and sealing.";
    if (n.includes("lock") || n.includes("deadbolt") || n.includes("keeper") || n.includes("strike"))
      return "A patio or entry door that won't lock securely is a safety issue. Replacing the lock set, keeper, or strike plate restores proper security.";
    return "Patio and entry door hardware wears over time — rollers, handles, hinges, and locks all have a service life. Replacing the specific failed component is the most effective repair.";
  };

  const categoryIntro = product.category === "Door Hardware"
    ? getDoorHardwareIntro(product.name)
    : CATEGORY_INTROS[product.category] ?? null;

  const FIXES_MAP: Record<string, string[]> = {
    "Window Balances": [
      "Window sash won't stay open — drops or slams shut",
      "Window is too heavy or stiff to lift",
      "Sash tilts or hangs unevenly when raised",
      "Balance rattles or makes noise when moving the window",
    ],
    "Window Hardware": [
      "Crank turns but the window won't open or close",
      "Casement or awning window won't latch shut",
      "Operator arm is bent, cracked, or seized",
      "Crank handle spins freely without moving the sash",
    ],
    "Sash Hardware": [
      "Window won't lock or latch properly",
      "Tilt latch won't engage or is broken — sash falls inward",
      "Sash rattles or feels loose in the frame",
      "Window sash won't tilt in for cleaning",
    ],
    "Door Hardware": [
      "Sliding patio door is hard to open or close",
      "Door drags or scrapes on the bottom track",
      "Door jumps off the track during use",
      "Door handle or lock is broken or stiff",
    ],
    "Window Glazing and Weatherstrip": [
      "Cold drafts around windows or doors",
      "Water infiltration around the sash or frame",
      "Rising heating or cooling bills",
      "Noise coming in around the window frame",
    ],
    "Screen Hardware and Accessories": [
      "Screen falls out of the frame",
      "Screen mesh is torn, sagging, or has holes",
      "Screen door won't slide properly",
      "Screen retainer clip or frame corner is broken",
    ],
  };

  const FITMENT_MAP: Record<string, string[]> = {
    "Window Balances": [
      "Length of the existing balance (in inches, end to end)",
      "Tension stamp or number printed on the balance",
      "Balance type (spiral, block & tackle, constant force)",
      "Window brand (Andersen, Pella, Marvin, etc.) if known",
    ],
    "Window Hardware": [
      "Handing — left or right (stand inside, facing the window)",
      "Arm style — single arm, dual arm, or split arm",
      "Mounting hole spacing (center to center, in inches)",
      "Window brand and any numbers stamped on the operator",
    ],
    "Sash Hardware": [
      "Window brand and series if visible on the frame",
      "Sash width — measured inside the frame opening",
      "Tilt latch style (push-button, lever, or cam)",
      "Color finish — white, bronze, or natural",
    ],
    "Door Hardware": [
      "Wheel diameter (1\", 1-1/4\", or 1-1/2\" are most common)",
      "Housing height, width, and length (all three)",
      "Mounting hole spacing on the housing",
      "Wheel material — nylon, steel, or tandem",
    ],
    "Window Glazing and Weatherstrip": [
      "Profile type (kerf-in T-barb, bulb seal, foam tape, or pile)",
      "Kerf slot width in the sash or frame (1/8\" vs 3/16\")",
      "Overall height and width of the profile",
      "Window brand — weatherstripping profiles are often brand-specific",
    ],
    "Screen Hardware and Accessories": [
      "Frame material — aluminum or vinyl",
      "Spline diameter if replacing spline",
      "Corner key size and style",
      "Screen door brand if applicable",
    ],
  };

  const partFixes = FIXES_MAP[product.category] ?? null;
  const fitmentChecklist = FITMENT_MAP[product.category] ?? null;

  const productAlt = `${product.name} — SKU ${product.sku} replacement window door part`;

  const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    "Window Balances": "replacement window balance for double-hung and single-hung windows. Balances provide the spring tension that holds the sash in any open position.",
    "Window Hardware": "replacement casement or awning window hardware. Operators, hinges, and related components for proper window opening and closing.",
    "Door Hardware": "replacement patio door or entry door hardware. Rollers, hinges, locks, and related components for smooth, secure door operation.",
    "Sash Hardware": "replacement sash hardware for double-hung windows. Tilt latches, sash locks, keepers, and pivot hardware.",
    "Window Glazing and Weatherstrip": "replacement weatherstripping or glazing seal. Stops drafts, prevents water infiltration, and restores energy efficiency.",
    "Screen Hardware and Accessories": "replacement screen hardware. Frame components, spline, rollers, and accessories for window and door screens.",
    "Other Hardware": "specialty window or door replacement hardware part.",
  };

  const isGenericDesc = !product.description || product.description.toLowerCase().includes("email us photos");
  const categoryDesc = CATEGORY_DESCRIPTIONS[product.category] ?? "window or door replacement hardware part";
  const seoDescription = isGenericDesc
    ? `Buy ${product.name} (SKU: ${product.sku}) — ${categoryDesc} Available from All Window Door Parts. Veteran-owned, 40+ years experience. Free Parts ID service available.`
    : `${product.name} (SKU: ${product.sku}) — ${product.description!.slice(0, 120)}`;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    mpn: product.sku,
    category: product.category,
    description: isGenericDesc
      ? `${product.name} — ${categoryDesc}`
      : product.description,
    image: product.imageUrl ?? undefined,
    itemCondition: "https://schema.org/NewCondition",
    brand: { "@type": "Brand", name: product.supplier ?? "All Window Door Parts" },
    seller: { "@type": "Organization", name: "All Window Door Parts", url: "https://www.allwindowdoorparts.com" },
    ...(Number(product.price) > 0
      ? {
          offers: {
            "@type": "Offer",
            price: Number(product.price).toFixed(2),
            priceCurrency: "USD",
            availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `https://www.allwindowdoorparts.com/product/${product.sku}`,
            seller: { "@type": "Organization", name: "All Window Door Parts" },
          },
        }
      : {
          offers: {
            "@type": "Offer",
            availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `https://www.allwindowdoorparts.com/product/${product.sku}`,
            seller: { "@type": "Organization", name: "All Window Door Parts" },
          },
        }),
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo
        title={`${product.name} — SKU ${product.sku}`}
        path={`/product/${product.sku}`}
        description={seoDescription}
        image={product.imageUrl ?? undefined}
        imageAlt={productAlt}
        type="product"
        structuredData={[
          productSchema,
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://www.allwindowdoorparts.com/" },
              { "@type": "ListItem", position: 2, name: "Shop Parts", item: "https://www.allwindowdoorparts.com/shop" },
              { "@type": "ListItem", position: 3, name: product.category, item: `https://www.allwindowdoorparts.com${categoryHref(product.category)}` },
              { "@type": "ListItem", position: 4, name: product.name, item: `https://www.allwindowdoorparts.com/product/${product.sku}` },
            ],
          },
        ] as unknown as object}
      />

      <Breadcrumb items={[
        { label: "Shop Parts", href: "/shop" },
        { label: product.category, href: `${categoryHref(product.category)}` },
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
            <div className={`flex flex-col transition-opacity duration-150 ${isSwitchingVariant ? "opacity-60" : ""}`}>
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
              
              {!isCallForPricing && (
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
              )}
              
              {product.description && !isGenericDesc && (
                <div className="text-slate-600 mb-6 leading-relaxed">
                  <p>{product.description}</p>
                </div>
              )}

              {/* AWDP Standard Product Attributes */}
              {productAttributes && Object.keys(productAttributes).length > 0 && (
                <AttributeConfigurator
                  attributes={productAttributes}
                  soldAs={productSoldAs}
                  notes={attrNotes.length > 0 ? attrNotes : undefined}
                />
              )}

              {/* This Part Fixes… */}
              {partFixes && (
                <div className="mb-5 border border-emerald-200 bg-emerald-50 rounded-xl px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-3">This Part Fixes</p>
                  <ul className="space-y-1.5">
                    {partFixes.map((fix) => (
                      <li key={fix} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Before ordering, confirm */}
              {fitmentChecklist && (
                <div className="mb-5 border border-amber-200 bg-amber-50 rounded-xl px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">Before Ordering, Confirm</p>
                  <ul className="space-y-1.5">
                    {fitmentChecklist.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <span className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center rounded-full border border-amber-400 text-amber-600 font-bold text-[10px]">!</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Variant picker */}
              {variants.length > 1 && (
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-primary" />
                    <p className="text-sm font-bold text-slate-800">
                      {variants.length} Options Available
                    </p>
                  </div>
                  <Select
                    value={sku}
                    disabled={isSwitchingVariant}
                    onValueChange={(val) => navigate(`/product/${encodeURIComponent(val)}`, { replace: true })}
                  >
                    <SelectTrigger className={`w-full bg-white transition-opacity ${isSwitchingVariant ? "opacity-60" : ""}`}>
                      <SelectValue placeholder="Select a variant…" />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((v) => (
                        <SelectItem key={v.sku} value={v.sku}>
                          <span className="font-medium">{v.variantLabel ?? v.name}</span>
                          {v.price && Number(v.price) > 0 && (
                            <span className="ml-2 text-muted-foreground text-xs">
                              ${Number(v.price).toFixed(2)}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isSwitchingVariant ? "Updating price and availability…" : "Price, availability, and details update instantly — no page reload."}
                  </p>
                </div>
              )}

              {/* Action Area */}
              <div className="bg-slate-50 border p-6 rounded-xl mb-6">
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
                  
                  {isCallForPricing ? (
                    <Button 
                      size="lg" 
                      className="h-14 flex-1 text-lg font-bold shadow-sm bg-amber-600 hover:bg-amber-700" 
                      asChild
                    >
                      <Link href="/parts-identification">
                        <PackageSearch className="mr-2 w-5 h-5" /> 
                        Get Pricing — Free Parts ID
                      </Link>
                    </Button>
                  ) : (
                    <Button 
                      size="lg" 
                      className="h-14 flex-1 text-lg font-bold shadow-sm" 
                      disabled={!product.inStock}
                      onClick={() => addToCart(product as unknown as Product, quantity)}
                    >
                      <ShoppingCart className="mr-2 w-5 h-5" /> 
                      {!product.inStock ? "Out of Stock" : "Add to Cart"}
                    </Button>
                  )}
                </div>
                
                <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 font-medium border-t pt-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Genuine replacement part — quality guaranteed
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> 40+ years expertise — we verify compatibility
                  </div>
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
                  Supplied by <span className="font-semibold text-slate-600">{product.supplier}</span> &middot; Category: <Link href={`${categoryHref(product.category)}`} className="hover:text-primary transition-colors">{product.category}</Link>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Full-width Upload a Photo CTA */}
        <div className="rounded-2xl mb-8 overflow-hidden border border-red-200 bg-gradient-to-r from-red-700 to-red-900 text-white flex flex-col sm:flex-row items-center gap-6 px-8 py-7">
          <Camera className="w-10 h-10 shrink-0 opacity-90" aria-hidden="true" />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xl font-bold mb-1">Still not sure this is the right part?</p>
            <p className="text-red-200 text-sm">Upload a photo and our experts will confirm the correct part — free, no obligation, usually same business day.</p>
          </div>
          <Button asChild size="lg" className="bg-white text-red-800 hover:bg-red-50 font-bold shrink-0 border-0 shadow-md px-8">
            <Link href="/parts-identification">Upload a Photo &rarr;</Link>
          </Button>
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
              <TabsTrigger value="install" className="text-base font-bold data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-4 px-6">Installation</TabsTrigger>
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
                          <td className="py-3 px-4 text-slate-900 font-medium border-y">{String(value)}</td>
                        </tr>
                      ))}
                      <tr className={Object.keys(product.specifications).length % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <th className="py-3 px-4 font-medium text-slate-500 border-y">Category</th>
                        <td className="py-3 px-4 text-slate-900 font-medium border-y">
                          <Link href={`${categoryHref(product.category)}`} className="hover:text-primary transition-colors">
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
                          <Link href={`${categoryHref(product.category)}`} className="hover:text-primary transition-colors">
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
                  {product.compatibleBrands.map((brand: string) => (
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
                {(({
                  "Window Balances": (
                    <>
                      <BalanceDiagram />
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
                      <div className="bg-slate-900 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mt-2">
                        <p className="text-sm text-slate-300">Need full step-by-step identification help? Read our detailed guide — all balance types covered.</p>
                        <Link href="/guides/window-balance" className="shrink-0 inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                          Read the Guide <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </>
                  ),
                  "Window Hardware": (
                    <>
                      <OperatorDiagram />
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
                      <div className="bg-slate-900 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mt-2">
                        <p className="text-sm text-slate-300">Need help identifying your operator arm style or brand? Read our detailed guide — single arm, dual arm, dyad, and scissor operators all covered.</p>
                        <Link href="/guides/window-operator" className="shrink-0 inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                          Read the Guide <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </>
                  ),
                  "Door Hardware": (
                    <>
                      <RollerDiagram />
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure Your Patio Door Roller</h3>
                      <p>Roller replacement requires matching the wheel diameter, housing dimensions, and mounting style. All five measurements below are needed:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Wheel diameter</strong> — remove the roller housing from the door bottom and measure the wheel diameter (1", 1-1/4", or 1-1/2" are the most common).</li>
                        <li><strong>Housing height, width, and length</strong> — measure all three housing dimensions separately. Two rollers with the same wheel size can have completely different housings.</li>
                        <li><strong>Mounting hole spacing</strong> — measure center-to-center between the two mounting screw holes.</li>
                        <li><strong>Wheel material</strong> — nylon, steel, or tandem wheels each serve different door types and are not interchangeable.</li>
                        <li><strong>Door brand</strong> — look on the door frame header or stile for a manufacturer label. Check the roller body for any stamped initials or numbers.</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        A photo of the removed roller next to a coin for scale helps us identify it instantly. Use our Free Parts ID service before ordering.
                      </div>
                      <div className="bg-slate-900 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mt-2">
                        <p className="text-sm text-slate-300">Need help identifying your roller type or housing shape? Read our detailed guide — steel, nylon, and tandem rollers all covered.</p>
                        <Link href="/guides/patio-door-roller" className="shrink-0 inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                          Read the Guide <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </>
                  ),
                  "Window Glazing and Weatherstrip": (
                    <>
                      <WeatherstripDiagram />
                      <h3 className="text-lg font-bold text-slate-900 mb-1">How to Measure Your Weatherstripping</h3>
                      <p>Weatherstrip profiles are highly specific to window brand and installation type. Before ordering:</p>
                      <ol className="list-decimal pl-5 space-y-3 text-sm">
                        <li><strong>Profile type</strong> — identify if it is kerf-in (T-barb into slot), bulb seal, foam tape (adhesive-backed), or fin/pile weatherstripping.</li>
                        <li><strong>Kerf width</strong> — for kerf-in types, measure the slot width in the sash or frame (typically 1/8" or 3/16" — these are not interchangeable).</li>
                        <li><strong>Overall height and width</strong> — measure from an undamaged section, never from a flattened or worn area.</li>
                        <li><strong>Length needed</strong> — measure all four sides of the window or door opening in linear feet.</li>
                      </ol>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                        Send us a cross-section photo of the existing strip (cut a clean 1–2" piece) and we will match the profile for you — free.
                      </div>
                      <div className="bg-slate-900 rounded-lg px-4 py-3 flex items-center justify-between gap-4 mt-2">
                        <p className="text-sm text-slate-300">Need help identifying your weatherstrip profile type? Read our detailed guide — kerf, bulb, foam, fin seal, and OEM profiles all covered.</p>
                        <Link href="/guides/weatherstripping" className="shrink-0 inline-flex items-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                          Read the Guide <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </>
                  ),
                }) as Record<string, React.ReactNode>)[product.category]}
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

            <TabsContent value="install" className="mt-0 text-slate-600 space-y-6 max-w-3xl">
              {(({
                "Window Balances": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Replace a Window Balance</h3>
                    <p className="text-sm">Most window balances can be replaced without tools in under 15 minutes. Here is the general process for double-hung windows:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Tilt the sash inward</strong> — unlock the sash, lift it slightly, and pull the top toward you to disengage the tilt-latch pivots.</li>
                      <li><strong>Unhook the old balance</strong> — locate the balance shoe in the track and disengage the balance pin from the shoe. Slide the balance upward out of the channel.</li>
                      <li><strong>Install the new balance</strong> — insert the top of the new balance into the channel and press the pin into the balance shoe. Ensure the stamp or tension rating matches the original.</li>
                      <li><strong>Re-seat the sash</strong> — tilt the sash back into place and lock it. Test by raising and lowering the sash to confirm it holds position.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> Always replace both balances at the same time, even if only one has failed. Unequal tension causes the sash to rack and wear out the new balance faster.
                    </div>
                  </>
                ),
                "Window Hardware": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Replace a Casement Window Operator</h3>
                    <p className="text-sm">Replacing a casement or awning window operator is a straightforward repair that restores full crank function:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Open the window fully</strong> — crank the window open to its maximum position to give yourself clearance.</li>
                      <li><strong>Detach the sash arm</strong> — locate where the operator arm connects to the sash track. Slide the arm forward or press the release tab to disengage it.</li>
                      <li><strong>Remove the old operator</strong> — unscrew the mounting screws (typically 2–4 screws on the sill or frame). Note the handing (left or right) before removal.</li>
                      <li><strong>Install the new operator</strong> — align the mounting holes and secure with screws. Reconnect the sash arm to the track.</li>
                      <li><strong>Test operation</strong> — crank the window open and closed several times to confirm smooth movement and proper seating.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> Photograph the old operator from the front and back before removal. The mounting pattern and arm style must match exactly.
                    </div>
                  </>
                ),
                "Door Hardware": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Replace a Patio Door Roller</h3>
                    <p className="text-sm">Roller replacement is the most effective fix for a patio door that drags, sticks, or jumps off the track:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Lift the door off the track</strong> — turn the adjustment screws (usually on the bottom rail) counterclockwise to retract the rollers, then lift the door up and off the track.</li>
                      <li><strong>Locate the roller housing</strong> — the roller assembly sits inside cavities in the bottom rail at each end of the door. Remove the cover screws to access it.</li>
                      <li><strong>Replace the rollers</strong> — pull out the old roller housing and press or snap in the new assembly. Ensure the wheel spins freely.</li>
                      <li><strong>Reinstall the door</strong> — hang the door back on the upper track first, then lower it onto the bottom track. Adjust the roller height with the adjustment screws until the door runs level and the gap is even.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> Clean the track thoroughly before installing new rollers. Debris in the track is the leading cause of premature roller wear.
                    </div>
                  </>
                ),
                "Sash Hardware": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Replace Sash Locks and Tilt Latches</h3>
                    <p className="text-sm">Sash hardware replacement is one of the easiest window repairs — usually no special tools required:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Tilt latch replacement</strong> — press the old latch inward to compress it, then slide it out of the sash hole. Compress the new latch, insert it into the hole, and release. It should click into place.</li>
                      <li><strong>Sash lock replacement</strong> — unscrew the mounting screws on the rail. Note how the lock cam aligns before removal. Install the new lock in the same position and secure with screws. Test that the cam engages the keeper correctly.</li>
                      <li><strong>Keeper replacement</strong> — unscrew the keeper from the upper rail. Position the new keeper so the cam from the lower sash lock hits it squarely when locked.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> Match the cam height of the new sash lock to the old one. A cam that is too tall or too short will prevent the window from locking fully.
                    </div>
                  </>
                ),
                "Window Glazing and Weatherstrip": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Replace Window Weatherstripping</h3>
                    <p className="text-sm">Most weatherstrip profiles are designed for simple field replacement without removing the window:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Remove the old strip</strong> — for kerf-in profiles, grip the fin and pull it straight out of the channel. For foam tape profiles, peel the backing and clean the surface with isopropyl alcohol before installing the new strip.</li>
                      <li><strong>Measure and cut</strong> — measure each side of the window opening and cut the new weatherstrip to length with scissors or a utility knife. Miter the corners at 45° for a clean seal.</li>
                      <li><strong>Install the new strip</strong> — for kerf profiles, press the fin firmly into the slot until fully seated. Work from one corner to the other without stretching. For foam tape, peel and press firmly along the entire length.</li>
                      <li><strong>Test the seal</strong> — close the window and run your hand along the perimeter to feel for air gaps. Adjust the strip position as needed.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> Install weatherstrip at room temperature. Cold vinyl becomes brittle and may crack when pressed into the kerf. Store the new strip indoors overnight before installation in winter.
                    </div>
                  </>
                ),
                "Screen Hardware and Accessories": (
                  <>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">How to Repair Window Screen Hardware</h3>
                    <p className="text-sm">Screen hardware repairs can usually be completed in minutes with basic tools:</p>
                    <ol className="list-decimal pl-5 space-y-3 text-sm">
                      <li><strong>Spline replacement</strong> — use a spline roller to press the old spline out of the frame groove. Lay the new screen fabric over the frame, cut to size with a 1" overhang, then press the new spline into the groove starting at one corner.</li>
                      <li><strong>Corner key replacement</strong> — flex the frame at the corner to pop the old corner key out. Insert the new corner key into both frame channels and press until fully seated.</li>
                      <li><strong>Screen door roller replacement</strong> — remove the door from the track, unscrew the roller housing, swap in the new roller assembly, and reinstall. Adjust the height screws so the door slides evenly.</li>
                    </ol>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <strong>Tip:</strong> When re-screening, pull the fabric slightly taut — but not stretched — before pressing the spline. Overstretching causes the screen to bow and the frame to distort.
                    </div>
                  </>
                ),
              }) as Record<string, React.ReactNode>)[product.category] ?? (
                <>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Installation Help</h3>
                  <p className="text-sm">Installation steps vary by part type and window or door model. If you need guidance specific to this part, our experts are happy to help before you purchase.</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                    Upload a photo of your window or door and the part you are replacing using our Free Parts ID service — our team will confirm fit and provide installation guidance.
                  </div>
                </>
              )}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                <Link href="/parts-identification" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
                  <Camera className="w-4 h-4" /> Use Free Parts ID — Upload a Photo
                </Link>
                <a href="mailto:info@allwindowdoorparts.com" className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 hover:border-primary hover:text-primary font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                  <Mail className="w-4 h-4" /> Email Our Experts
                </a>
              </div>
            </TabsContent>

            <TabsContent value="shipping" className="mt-0 text-slate-600 space-y-4 max-w-3xl">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Shipping Information</h3>
              <p>Shipping costs are calculated at checkout based on your delivery address, package weight, and dimensions. We ship via UPS, FedEx, and/or USPS.</p>
              <p>Please note that <strong>not all orders ship immediately</strong>. Some items need to be sourced from our distributors before they can be sent out. If your order requires additional lead time, we will contact you.</p>
              <ul className="list-disc pl-5 space-y-1 mb-6">
                <li>Standard Shipping (estimated 3-5 business days from ship date)</li>
                <li>Expedited Shipping (estimated 2-3 business days from ship date)</li>
                <li>Next Day Air available at checkout</li>
              </ul>
              
              <h3 className="text-lg font-bold text-slate-900 mb-2 mt-8">Return Policy</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
                <strong>Most items are special order and cannot be returned.</strong> Special order items are sourced specifically for your order through our national distribution network and are non-returnable and non-exchangeable. Custom-cut weatherstripping is also non-returnable.
              </div>
              <p className="mt-3 text-sm text-slate-600">If you are unsure whether a part qualifies as a special order, please contact us <strong>before purchasing</strong>. Our experts will confirm compatibility and ordering terms — <a href="mailto:info@allwindowdoorparts.com" className="text-primary font-semibold underline">info@allwindowdoorparts.com</a> or <a href="tel:+17855330244" className="text-primary font-semibold underline">785-533-0244</a>.</p>

              <div className="mt-6 bg-slate-50 border rounded-lg px-4 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-slate-700">Questions about your order? Email us at <a href="mailto:info@allwindowdoorparts.com" className="font-bold text-primary">info@allwindowdoorparts.com</a> — we respond within 1 business day.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Customer Reviews Prompt */}
        <div className="mb-16 bg-white rounded-2xl shadow-sm border p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold text-slate-900">Customer Reviews</h2>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className="w-5 h-5 text-slate-200" aria-hidden="true" />
              ))}
            </div>
          </div>
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
            <p className="text-slate-500 mb-4">No reviews yet. Be the first to share your experience with this part.</p>
            <a
              href={`mailto:info@allwindowdoorparts.com?subject=Review%20for%20${encodeURIComponent(product.sku)}%20-%20${encodeURIComponent(product.name)}&body=Hi%2C%20I'd%20like%20to%20leave%20a%20review%20for%20${encodeURIComponent(product.name)}%20(SKU%3A%20${encodeURIComponent(product.sku)}).%0A%0ARating%20(1-5)%3A%20%0AReview%3A%20`}
              className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" /> Write a Review
            </a>
          </div>
        </div>

        {/* Related Products — same category */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-slate-900">More {product.category}</h2>
              <Button variant="ghost" asChild>
                <Link href={`${categoryHref(product.category)}`}>View All <ChevronRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts?.map((p: typeof relatedProducts[0]) => (
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
              {crossSellProducts?.map((p: typeof crossSellProducts[0]) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
