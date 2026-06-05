import { Link, useLocation } from "wouter";
import { ReactNode, useState, useRef, useEffect } from "react";
import { useCart } from "@/lib/cart";
import { ShoppingCart, Menu, Phone, Search, ChevronRight, CheckCircle2, Wrench, PackageSearch, Loader2, Lock, Truck, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logo, logoBanner, paypalImg, headerBg } from "@/lib/assetUrls";
import { ProductImage } from "@/components/product-image";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { PayPalCheckoutButton } from "@/components/PayPalCheckoutButton";
import { SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_MAILTO } from "@/lib/siteContact";

const SHOP_CATEGORIES = [
  ["Window Balances",               "Window+Balances"],
  ["Window Hardware",               "Window+Hardware"],
  ["Sash Hardware",                 "Sash+Hardware"],
  ["Door Hardware",                 "Door+Hardware"],
  ["Weatherstrip & Glazing",        "Window+Glazing+and+Weatherstrip"],
  ["Screen Hardware & Accessories", "Screen+Hardware+and+Accessories"],
  ["Other Hardware",                "Other+Hardware"],
] as const;

const SHOP_BY_PROBLEM = [
  ["Window won't stay open",    "balance"],
  ["Window hard to crank",      "operator"],
  ["Window won't lock",         "lock"],
  ["Drafty window or door",     "weatherstripping"],
  ["Sliding door hard to open", "roller"],
  ["Screen frame damaged",      "screen frame"],
  ["Broken tilt latch",         "tilt latch"],
  ["Window sash falls out",     "pivot bar"],
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { totalItems, isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const shopDropdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nav search autocomplete
  const [navSuggestions, setNavSuggestions]       = useState<string[]>([]);
  const [navSuggestionsOpen, setNavSuggestionsOpen] = useState(false);
  const navSuggDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ORDER_MINIMUM = 50;
  const belowMinimum = totalPrice < ORDER_MINIMUM && items.length > 0;
  const remaining = Math.max(0, ORDER_MINIMUM - totalPrice);

  const handleNavSearchChange = (val: string) => {
    setSearchQuery(val);
    if (navSuggDebounce.current) clearTimeout(navSuggDebounce.current);
    if (val.length >= 2) {
      navSuggDebounce.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/products/search-suggestions?q=${encodeURIComponent(val)}`);
          const raw = await res.json();
const data = Array.isArray(raw) ? raw : [];
setNavSuggestions(data);
setNavSuggestionsOpen(data.length > 0);

        } catch { /* ignore */ }
      }, 280);
    } else {
      setNavSuggestions([]);
      setNavSuggestionsOpen(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setNavSuggestionsOpen(false);
    if (searchQuery.trim()) {
      setLocation(`/shop?search=${encodeURIComponent(searchQuery)}`);
    }
  };
        return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-white focus:text-primary focus:font-semibold focus:px-4 focus:py-2 focus:rounded">
        Skip to main content
      </a>

      {/* CLASSIC FLAG BANNER */}
      <div className="w-full relative overflow-hidden" style={{ minHeight: 220 }}>
        {/* Background photo */}
        <img
          src={headerBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-top select-none pointer-events-none"
          fetchpriority="high"
          loading="eager"
        />

        {/* Content layered over photo — matches original image layout exactly */}
        <div className="relative z-10 w-full h-full flex flex-col" style={{ minHeight: 220 }}>

          {/* CENTER: title + email — large, centered in the image */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-6 pb-2">
            <p
              className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg leading-tight"
              style={{ color: "#3a7bd5", textShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
            >
              All Window Door Parts
            </p>
            <a
              href="mailto:info@allwindowdoorparts.com"
              className="text-xl md:text-2xl font-normal drop-shadow hover:underline mt-1"
              style={{ color: "#3a7bd5", textShadow: "0 1px 6px rgba(0,0,0,0.15)" }}
            >
              info@AllWindowDoorParts.com
            </a>
          </div>

          {/* BOTTOM ROW: veteran text left, payment logos right */}
          <div className="flex items-end justify-between px-5 pb-4">
            {/* Bottom-left: veteran + rainbow group name */}
            <div>
              <p className="text-sm font-bold tracking-wide drop-shadow" style={{ color: "#e53e3e" }}>
                Veteran Owned and Operated
              </p>
              <p
                className="text-base font-extrabold tracking-wide drop-shadow"
                style={{
                  background: "linear-gradient(90deg,#e53e3e,#dd6b20,#d69e2e,#38a169,#3182ce,#805ad5)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AllWindowDoorPartsGroup
              </p>
            </div>

            {/* Bottom-right: PayPal + card logos */}
            <div className="flex items-center gap-2">
              <img
                src={paypalImg}
                alt="PayPal, Mastercard, American Express, Discover accepted"
                className="h-10 object-contain drop-shadow"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 bg-primary shadow-md border-b border-primary/20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 md:gap-8">

            {/* Desktop Nav & Search */}
            <div className="hidden md:flex flex-1 items-center gap-6">
              <nav aria-label="Main navigation" className="flex items-center gap-5 font-semibold text-primary-foreground">
                <Link href="/" className="hover:text-accent transition-colors">Home</Link>

                {/* Shop Parts with mega-menu dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => {
                    if (shopDropdownTimer.current) clearTimeout(shopDropdownTimer.current);
                    setShopDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    shopDropdownTimer.current = setTimeout(() => setShopDropdownOpen(false), 150);
                  }}
                >
                  <Link
                    href="/shop"
                    className="hover:text-accent transition-colors flex items-center gap-1"
                    aria-haspopup="menu"
                    aria-expanded={shopDropdownOpen}
                  >
                    Shop Parts
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${shopDropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </Link>

                  {shopDropdownOpen && (
                    <div role="menu" aria-label="Shop categories" className="absolute top-full left-0 mt-2 w-[680px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                      <div className="grid grid-cols-3 gap-0 divide-x divide-slate-100">

                        {/* Column 1: By Category */}
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">By Category</p>
                          <Link
                            href="/shop"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-primary/5 hover:text-primary font-bold rounded-lg mb-1 transition-colors"
                            onClick={() => setShopDropdownOpen(false)}
                          >
                            All 4,000+ In-Stock Parts
                          </Link>
                          {SHOP_CATEGORIES.map(([label, cat]) => (
                            <Link
                              key={cat}
                              href={`/shop?category=${cat}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                              onClick={() => setShopDropdownOpen(false)}
                            >
                              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                              {label}
                            </Link>
                          ))}
                        </div>

                        {/* Column 2: Shop by Problem */}
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Shop by Problem</p>
                          {SHOP_BY_PROBLEM.map(([problem, search]) => (
                            <Link
                              key={search}
                              href={`/shop?search=${encodeURIComponent(search)}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                              onClick={() => setShopDropdownOpen(false)}
                            >
                              <Wrench className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                              {problem}
                            </Link>
                          ))}
                        </div>

                        {/* Column 3: Shop by Brand + Quick links */}
                        <div className="p-5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Shop by Brand</p>
                          {[
                            ["Truth/EntryGard",  "Truth"],
                            ["Andersen",         "Andersen"],
                            ["Pella",            "Pella"],
                            ["Milgard",          "Milgard"],
                            ["Marvin",           "Marvin"],
                            ["Amesbury",         "Amesbury"],
                            ["Caldwell",         "Caldwell"],
                          ].map(([label, brand]) => (
                            <Link
                              key={brand}
                              href={`/shop?search=${encodeURIComponent(brand)}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                              onClick={() => setShopDropdownOpen(false)}
                            >
                              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                              {label}
                            </Link>
                          ))}
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <Link
                              href="/parts-identification"
                              className="flex items-center gap-2 px-3 py-2.5 text-sm bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-lg transition-colors"
                              onClick={() => setShopDropdownOpen(false)}
                            >
                              <PackageSearch className="w-4 h-4 shrink-0" aria-hidden="true" />
                              Free Parts ID — We Help Find It
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Link href="/resources" className="hover:text-accent transition-colors">Resources</Link>
                <Link href="/parts-identification" className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 font-bold uppercase tracking-wide text-sm transition-colors">
                  <PackageSearch className="w-4 h-4" aria-hidden="true" /> Free Parts ID
                </Link>
                <Link href="/about" className="hover:text-accent transition-colors">About</Link>
                <Link href="/contact" className="hover:text-accent transition-colors">Contact</Link>
              </nav>

              {/* Desktop search with autocomplete */}
              <div className="flex-1 max-w-sm relative">
                <form onSubmit={handleSearch} role="search" aria-label="Search parts" className="group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/60 group-focus-within:text-accent transition-colors z-10" aria-hidden="true" />
                  <Input
                    type="search"
                    aria-label="Search parts by SKU, brand, or name"
                    aria-autocomplete="list"
                    aria-expanded={navSuggestionsOpen}
                    placeholder="Search by SKU, brand, or part..."
                    className="w-full pl-9 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:bg-white/20 focus-visible:ring-accent"
                    value={searchQuery}
                    onChange={(e) => handleNavSearchChange(e.target.value)}
                    onFocus={() => { if (navSuggestions.length > 0) setNavSuggestionsOpen(true); }}
                    onBlur={() => setTimeout(() => setNavSuggestionsOpen(false), 150)}
                  />
                </form>
                {navSuggestionsOpen && navSuggestions.length > 0 && (
                  <div role="listbox" aria-label="Search suggestions" className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 py-1 z-50 text-sm">
                    {navSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2"
                        onMouseDown={() => {
                          setSearchQuery(s);
                          setNavSuggestionsOpen(false);
                          setLocation(`/shop?search=${encodeURIComponent(s)}`);
                        }}
                      >
                        <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Phone - desktop */}
            <a href="tel:785-533-0244" className="hidden md:flex items-center gap-2 text-primary-foreground hover:text-accent transition-colors font-bold text-sm shrink-0">
              <Phone className="w-4 h-4" aria-hidden="true" /> 785-533-0244
            </a>

            {/* Mobile: phone */}
            <div className="md:hidden flex items-center gap-2 text-primary-foreground font-bold text-sm">
              <Phone className="w-4 h-4" aria-hidden="true" />
              <a href="tel:785-533-0244">785-533-0244</a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open cart" className="relative border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                    <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                        {totalItems}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md flex flex-col">
                  <SheetHeader>
                    <SheetTitle>Your Cart ({totalItems} items)</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="flex-1 -mx-6 px-6 py-4">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                        <p className="text-lg font-medium text-foreground mb-2">Your cart is empty</p>
                        <p className="text-muted-foreground mb-6">Looks like you haven't added any parts yet.</p>
                        <Button onClick={() => { setIsCartOpen(false); setLocation("/shop"); }}>
                          Browse Parts
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {items.map((item) => (
                          <div key={item.id} className="flex gap-4 border-b pb-4">
                            <div className="w-20 h-20 bg-muted rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                              <ProductImage
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                placeholderClassName="w-full h-full flex items-center justify-center"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm leading-tight truncate">{item.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">SKU: {item.sku}</p>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center border rounded-md">
                                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 text-muted-foreground hover:bg-muted">-</button>
                                  <span className="px-2 text-sm font-medium">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 text-muted-foreground hover:bg-muted">+</button>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-primary">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 self-start mt-1"
                              aria-label={`Remove ${item.name} from cart`}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  {items.length > 0 && (
                    <div className="border-t pt-4 mt-auto space-y-3">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Subtotal</span>
                        <span>${totalPrice.toFixed(2)}</span>
                      </div>
                      {!belowMinimum && (() => {
                        // Mirror server-side shipping tiers so customer sees the charge before PayPal opens
                        let ship = 14.95;
                        if (totalPrice >= 500)      ship = 49.95;
                        else if (totalPrice >= 300) ship = 34.95;
                        else if (totalPrice >= 150) ship = 24.95;
                        else if (totalPrice >= 75)  ship = 19.95;
                        return (
                          <>
                            <div className="flex justify-between items-center text-sm text-slate-600">
                              <span>Shipping (UPS/FedEx Ground)</span>
                              <span>${ship.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center font-bold text-base border-t pt-2">
                              <span>Est. Total</span>
                              <span>${(totalPrice + ship).toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                      {belowMinimum ? (
                        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1.5">
                          <p className="text-xs font-semibold text-amber-800">$50.00 order minimum required</p>
                          <div className="w-full bg-amber-100 rounded-full h-2">
                            <div
                              className="bg-amber-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (totalPrice / ORDER_MINIMUM) * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-amber-700">Add <span className="font-bold">${remaining.toFixed(2)}</span> more to checkout</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Shipping calculated at checkout</p>
                          <p className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                            <Truck className="w-3 h-3" /> Some items may require sourcing from our distributors before shipping
                          </p>
                        </div>
                      )}

                      {/* Trust strip */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span>Veteran Owned</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <PackageSearch className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span>Free Parts ID</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span>Expert Phone Support</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span>Secure Checkout</span>
                        </div>
                      </div>

                      <PayPalCheckoutButton
                        items={items}
                        totalPrice={totalPrice}
                        disabled={belowMinimum}
                        onSuccess={(orderId) => {
                          clearCart();
                          setIsCartOpen(false);
                          setLocation(`/checkout/success?order_id=${orderId}`);
                        }}
                      />
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> SSL encrypted · PayPal • Visa • MC • Amex • Discover
                      </p>
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="md:hidden text-white hover:bg-white/20 hover:text-white">
                    <Menu className="w-6 h-6" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px]">
                  <Link href="/" className="mb-8 block" onClick={() => setIsMobileMenuOpen(false)}>
                    <img src={logo} alt="All Window Door Parts" className="h-10 w-auto" />
                  </Link>
                  <nav aria-label="Mobile navigation" className="flex flex-col gap-4 text-lg font-medium">
                    <Link href="/" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
                    <Link href="/shop" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Shop Parts</Link>
                    <Link href="/categories" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Categories</Link>
                    <Link href="/resources" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>PDF Resources</Link>
                    <Link href="/parts-identification" className="py-2 border-b text-red-600 font-bold flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                      <PackageSearch className="w-5 h-5" /> Free Parts ID
                    </Link>
                    <Link href="/about" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>About Us</Link>
                    <Link href="/contact" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Contact</Link>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Mobile Search - visible only below md */}
          <div className="md:hidden mt-3 relative">
            <form onSubmit={handleSearch} role="search" aria-label="Search parts" className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search parts by SKU, brand, or name"
                aria-autocomplete="list"
                aria-expanded={navSuggestionsOpen}
                placeholder="Search by SKU, brand..."
                className="w-full pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                value={searchQuery}
                onChange={(e) => handleNavSearchChange(e.target.value)}
                onFocus={() => { if (navSuggestions.length > 0) setNavSuggestionsOpen(true); }}
                onBlur={() => setTimeout(() => setNavSuggestionsOpen(false), 150)}
              />
            </form>
            {navSuggestionsOpen && navSuggestions.length > 0 && (
              <div role="listbox" aria-label="Search suggestions" className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 py-1 z-50 text-sm">
                {navSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2"
                    onMouseDown={() => {
                      setSearchQuery(s);
                      setNavSuggestionsOpen(false);
                      setLocation(`/shop?search=${encodeURIComponent(s)}`);
                    }}
                  >
                    <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer role="contentinfo" aria-label="Site footer" className="bg-slate-950 text-slate-300 py-16 mt-auto">
        <div className="container mx-auto px-4">

          {/* Footer SEO block */}
          <div className="border border-slate-700 rounded-xl px-6 py-8 mb-12 text-sm leading-relaxed text-slate-400">
            <p className="mb-3">
              <span className="font-bold text-slate-200">All Window Door Parts</span> is America's trusted source for window and door hardware,
              specializing in obsolete, discontinued, and hard-to-find replacement parts. With over 40 years of hands-on experience,
              we help homeowners, contractors, and property managers identify and replace the exact parts needed to restore smooth, secure operation.
              From{" "}
              <Link href="/shop?search=casement" className="text-slate-300 hover:text-white underline underline-offset-2">operators</Link>,{" "}
              <Link href="/shop?search=balance" className="text-slate-300 hover:text-white underline underline-offset-2">balances</Link>,{" "}
              <Link href="/shop?search=roller" className="text-slate-300 hover:text-white underline underline-offset-2">rollers</Link>,{" "}
              <Link href="/shop?search=lock" className="text-slate-300 hover:text-white underline underline-offset-2">locks</Link>,{" "}
              <Link href="/shop?search=latch" className="text-slate-300 hover:text-white underline underline-offset-2">tilt latches</Link>,{" "}
              <Link href="/shop?search=hinge" className="text-slate-300 hover:text-white underline underline-offset-2">hinges</Link>, and{" "}
              <Link href="/shop?category=Window+Glazing+and+Weatherstrip" className="text-slate-300 hover:text-white underline underline-offset-2">weatherstripping</Link>,
              we carry solutions for nearly every brand and window type. Can't find your part?{" "}
              <Link href="/parts-identification" className="text-accent hover:text-white font-semibold underline underline-offset-2">Use our Free Parts ID service</Link>{" "}
              and our experts will match it for you — at no charge.
            </p>
            <p className="text-xs text-slate-500">
              Veteran Owned & Operated &nbsp;&middot;&nbsp; 40+ Years Experience &nbsp;&middot;&nbsp; SSL Secured Checkout &nbsp;&middot;&nbsp; Expert Parts Matching &nbsp;&middot;&nbsp; Hard-to-Find & Obsolete Parts Specialists
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-4">
              <img src={logo} alt="All Window Door Parts" loading="lazy" width="160" height="64" className="h-16 w-auto bg-white/10 p-2 rounded-md object-contain" />
              <p className="text-sm leading-relaxed mt-4 text-slate-400">
                Your trusted source for replacement window and door hardware. Veteran owned and operated with over 40 years of industry experience.
              </p>
              <div className="flex items-center gap-2 text-white font-bold text-sm bg-accent/20 text-accent p-3 rounded-md w-fit mt-4">
                <CheckCircle2 className="w-4 h-4" /> Veteran Owned Business
              </div>
            </div>

            <div>
              <h4 className="text-white font-serif font-bold text-lg mb-6 tracking-wide">Quick Links</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/shop" className="hover:text-white transition-colors">Shop All Parts</Link></li>
                <li><Link href="/categories" className="hover:text-white transition-colors">Browse by Category</Link></li>
                <li><Link href="/resources" className="hover:text-white transition-colors">PDF Resources</Link></li>
                <li><Link href="/parts-identification" className="text-accent hover:text-white transition-colors font-medium">Free Parts Identification</Link></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-serif font-bold text-lg mb-6 tracking-wide">Customer Service</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/policies#shipping" className="hover:text-white transition-colors">Shipping Policy</Link></li>
                <li><Link href="/policies#returns" className="hover:text-white transition-colors">Return Policy</Link></li>
                <li><Link href="/policies#security" className="hover:text-white transition-colors">Security Notice</Link></li>
                <li><Link href="/policies#guarantee" className="hover:text-white transition-colors">Secure Shopping Guarantee</Link></li>
                <li><Link href="/policies#privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/policies" className="hover:text-white transition-colors">All Policies</Link></li>
              </ul>
              <div className="mt-6 bg-slate-700/40 border border-slate-600/40 rounded-md px-3 py-2.5 text-slate-300 text-xs leading-snug flex items-start gap-2">
                <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Shipping is determined at checkout. Some items may need to be sourced from our distributors before they can ship — we will contact you if additional lead time is needed.</span>
              </div>
              <div className="mt-3 bg-amber-500/20 border border-amber-500/40 rounded-md px-3 py-2.5 text-amber-300 text-xs leading-snug">
                Orders under $50 may require additional shipping. We'll contact you before processing.
              </div>
            </div>

            <div>
              <h4 className="text-white font-serif font-bold text-lg mb-6 tracking-wide">Contact Us</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <a href="tel:785-533-0244" className="text-white font-medium hover:text-accent transition-colors block">785-533-0244</a>
                    <span className="text-slate-500 text-xs">Mon-Fri 8am-5pm CST</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-accent">@</div>
                  <a href={SITE_CUSTOMER_MAILTO} className="hover:text-white transition-colors break-all">{SITE_CUSTOMER_EMAIL}</a>
                </li>
              </ul>
              
              <div className="mt-8">
                <img src={paypalImg} alt="Secure Payments by PayPal — Visa, Mastercard, Discover, American Express, No PayPal Account Needed" loading="lazy" width="220" height="80" className="w-full max-w-[220px] rounded-md" />
              </div>
            </div>
          </div>
          
          {/* Footer CTA */}
          <div className="border-t border-slate-700 mt-12 pt-10 pb-4 text-center">
            <h3 className="text-white font-serif text-2xl font-bold mb-3">Can't Find Your Part?</h3>
            <p className="text-slate-400 mb-6 max-w-xl mx-auto">Upload a photo and our experts will identify your exact replacement — completely free. Obsolete parts welcome.</p>
            <Link href="/parts-identification" className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-md transition-colors text-sm uppercase tracking-wide">
              Upload Photos &mdash; We Identify Free
            </Link>
          </div>

          <div className="border-t border-slate-800 mt-10 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} All Window Door Parts. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
