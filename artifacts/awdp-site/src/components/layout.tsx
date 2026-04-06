import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";
import { useCart } from "@/lib/cart";
import { ShoppingCart, Menu, Phone, Search, ChevronRight, CheckCircle2, Wrench, PackageSearch, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import logo from "@assets/Copilot_20260402_114745_1775148479858.png";
import paypalImg from "@assets/paypal_1775073666311.png";
import { ProductImage } from "@/components/product-image";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { PayPalCheckoutButton } from "@/components/PayPalCheckoutButton";

export function Layout({ children }: { children: ReactNode }) {
  const { totalItems, isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const ORDER_MINIMUM = 50;
  const belowMinimum = totalPrice < ORDER_MINIMUM && items.length > 0;
  const remaining = Math.max(0, ORDER_MINIMUM - totalPrice);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (belowMinimum) {
      toast({
        title: "Minimum Order Not Met",
        description: `Add $${remaining.toFixed(2)} more to reach the $${ORDER_MINIMUM} order minimum.`,
        variant: "destructive",
      });
      return;
    }
    setCheckoutLoading(true);
    try {
      const payload = {
        items: items.map((item) => ({
          sku: item.sku,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          imageUrl: item.imageUrl ?? undefined,
        })),
      };
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed. Please try again.");
      }
      const data = await res.json();
      if (data.url) {
        setIsCartOpen(false);
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({
        title: "Checkout Error",
        description: err.message || "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/shop?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Full-Width Logo Banner */}
      <Link href="/" className="block w-full">
        <img
          src={logo}
          alt="All Window Door Parts"
          style={{ width: "100%", height: "160px", objectFit: "cover", objectPosition: "center 40%", display: "block" }}
        />
      </Link>
      {/* Site-wide Order Minimum Banner */}
      <div className="bg-amber-500 text-amber-950 text-center text-xs font-semibold py-2 px-4 leading-tight">
        $50 minimum on all orders &mdash; Anything below $50 will be cancelled
      </div>

      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 bg-primary shadow-md border-b border-primary/20">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 md:gap-8">

            {/* Desktop Nav & Search */}
            <div className="hidden md:flex flex-1 items-center gap-6">
              <nav className="flex items-center gap-5 font-semibold text-primary-foreground">
                <Link href="/" className="hover:text-accent transition-colors">Home</Link>
                <Link href="/shop" className="hover:text-accent transition-colors">Shop Parts</Link>
                <Link href="/categories" className="hover:text-accent transition-colors">Categories</Link>
                <Link href="/parts-identification" className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 font-bold uppercase tracking-wide text-sm transition-colors">
                  <PackageSearch className="w-4 h-4" /> Free Parts ID
                </Link>
                <Link href="/about" className="hover:text-accent transition-colors">About</Link>
                <Link href="/contact" className="hover:text-accent transition-colors">Contact</Link>
              </nav>

              <form onSubmit={handleSearch} className="flex-1 max-w-sm relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/60 group-focus-within:text-accent transition-colors" />
                <Input
                  type="search"
                  placeholder="Search by SKU, brand, or part..."
                  className="w-full pl-9 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:bg-white/20 focus-visible:ring-accent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>

            {/* Phone - desktop */}
            <a href="tel:785-533-0244" className="hidden md:flex items-center gap-2 text-primary-foreground hover:text-accent transition-colors font-bold text-sm shrink-0">
              <Phone className="w-4 h-4" /> 785-533-0244
            </a>

            {/* Mobile: site name + icons */}
            <div className="md:hidden flex items-center gap-2 text-primary-foreground font-bold text-sm">
              <Phone className="w-4 h-4" />
              <a href="tel:785-533-0244">785-533-0244</a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="relative border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                    <ShoppingCart className="w-5 h-5" />
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
                        <p className="text-xs text-muted-foreground">Shipping calculated at checkout</p>
                      )}
                      <Button
                        className="w-full text-base h-12 gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                        onClick={handleCheckout}
                        disabled={checkoutLoading || belowMinimum}
                      >
                        {checkoutLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                        ) : (
                          <><Lock className="w-4 h-4" /> Pay with Card — ${totalPrice.toFixed(2)}</>
                        )}
                      </Button>
                      <div className="relative flex items-center gap-2">
                        <div className="flex-1 border-t" />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex-1 border-t" />
                      </div>
                      <PayPalCheckoutButton
                        items={items}
                        totalPrice={totalPrice}
                        disabled={checkoutLoading || belowMinimum}
                        onSuccess={(orderId) => {
                          clearCart();
                          setIsCartOpen(false);
                          setLocation(`/checkout/success?order_id=${orderId}`);
                        }}
                      />
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" /> SSL encrypted · Visa · MC · Amex · PayPal
                      </p>
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/20 hover:text-white">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px]">
                  <Link href="/" className="mb-8 block" onClick={() => setIsMobileMenuOpen(false)}>
                    <img src={logo} alt="All Window Door Parts" className="h-10 w-auto" />
                  </Link>
                  <nav className="flex flex-col gap-4 text-lg font-medium">
                    <Link href="/" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
                    <Link href="/shop" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Shop Parts</Link>
                    <Link href="/categories" className="py-2 border-b" onClick={() => setIsMobileMenuOpen(false)}>Categories</Link>
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
          <div className="md:hidden mt-3">
            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
              <Input
                type="search"
                placeholder="Search by SKU, brand..."
                className="w-full pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-300 py-16 mt-auto">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="space-y-4">
              <img src={logo} alt="All Window Door Parts" className="h-16 w-auto bg-white/10 p-2 rounded-md object-contain" />
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
                <li><Link href="/policies" className="hover:text-white transition-colors">All Policies</Link></li>
              </ul>
              <div className="mt-6 bg-amber-500/20 border border-amber-500/40 rounded-md px-3 py-2.5 text-amber-300 text-xs font-semibold leading-snug">
                $50 minimum on all orders.<br />Anything below $50 will be cancelled.
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
                  <a href="mailto:Info@allwindowdoorparts.com" className="hover:text-white transition-colors break-all">Info@allwindowdoorparts.com</a>
                </li>
              </ul>
              
              <div className="mt-8">
                <img src={paypalImg} alt="Secure Payments by PayPal — Visa, Mastercard, Discover, American Express, No PayPal Account Needed" className="w-full max-w-[220px] rounded-md" />
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} All Window Door Parts. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
