import { Link } from "wouter";
import { Shield, ChevronRight, PackageSearch, Star, CheckCircle2, Award, Clock, Quote, Wrench, Lock, Wind, Droplets, ArrowUp, Move, LayoutGrid, Key } from "lucide-react";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { useGetFeaturedProducts, getGetFeaturedProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import heroBg from "@assets/hero_hardware_bg.png";
import ctaBg from "@assets/cta_hardware_bg.png";

export default function Home() {
  const { data: featuredProducts, isLoading } = useGetFeaturedProducts({
    query: {
      queryKey: getGetFeaturedProductsQueryKey(),
    }
  });

  return (
    <div className="flex flex-col">
      <PageSeo
        path="/"
        description="All Window Door Parts — veteran-owned supplier with 40+ years experience. Shop 35,000+ window and door parts: operators, balances, locks, rollers, glazing seals, and more. Call 785-533-0244."
      />
      {/* Hero Section */}
      <section className="relative bg-[#0f172a] text-white overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: `url(${heroBg})` }}></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/90 to-transparent"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-sm font-bold text-blue-200 mb-6 uppercase tracking-wider">
              <Shield className="w-4 h-4" /> Veteran Owned & Operated
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold leading-tight mb-6 text-white shadow-sm">
              The Right Part.<br />
              <span className="text-blue-400">Right The First Time.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              With over 40 Years of industry experience, we are America's trusted source for replacement window and door hardware. If they made it, we can find it &ndash; if we can't you probably never will.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-14 px-8 text-lg font-bold bg-accent hover:bg-accent/90 text-white border-0" asChild>
                <Link href="/shop">
                  Shop Catalog <ChevronRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" className="h-14 px-8 text-lg font-bold bg-red-600 hover:bg-red-700 border-0 text-white" asChild>
                <Link href="/parts-identification">
                  <PackageSearch className="mr-2 w-5 h-5" /> Free Parts ID
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-white border-b py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 divide-x divide-slate-100">
            <div className="flex flex-col items-center text-center px-4">
              <Award className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-slate-900">40+ Years</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Industry Experience</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <Shield className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-slate-900">Veteran Owned</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Proudly American</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <PackageSearch className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-slate-900">Free Parts ID</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Expert Matching</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <Clock className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-slate-900">Fast Shipping</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Nationwide Delivery</p>
            </div>
          </div>
        </div>
      </section>

      {/* Parts ID CTA Section */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="bg-primary rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row">
            <div className="p-8 md:p-12 lg:p-16 flex-1 flex flex-col justify-center text-white">
              <div className="inline-flex items-center gap-2 bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-sm font-bold w-fit mb-6">
                <Star className="w-4 h-4 fill-current" /> Free Service
              </div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-white">Not Sure What Part You Need?</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl leading-relaxed">
                Send us pictures of your needed parts. Our team with decades of industry experience will identify it and send you a link to buy the exact replacement parts or upgrade &ndash; completely free.
              </p>
              <ul className="space-y-3 mb-8 text-blue-100 font-medium">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" /> Enjoy a risk-free preview.</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" /> Timely responses you can count on.</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" /> Expert identification of obsolete parts.</li>
              </ul>
              <Button size="lg" className="w-fit bg-red-600 hover:bg-red-700 text-white h-12 px-8 text-base shadow-lg border-0" asChild>
                <Link href="/parts-identification">Upload a Photo Now</Link>
              </Button>
            </div>
            <div className="md:w-2/5 bg-slate-800 relative hidden md:block">
              <div className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay" style={{ backgroundImage: `url(${ctaBg})` }}></div>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent w-32"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-2">Featured Hardware</h2>
              <p className="text-slate-500 font-medium">High-quality replacement parts trusted by industry professionals.</p>
            </div>
            <Button variant="outline" className="hidden sm:flex" asChild>
              <Link href="/shop">View All Parts <ChevronRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <Skeleton className="h-[250px] w-full rounded-lg" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              ))
            ) : featuredProducts?.length ? (
              featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                No featured products available at the moment.
              </div>
            )}
          </div>
          
          <div className="mt-10 text-center sm:hidden">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/shop">View All Parts <ChevronRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Shop by Problem */}
      <section className="py-16 md:py-24 bg-slate-900 text-white border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Shop by Problem</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">Don't know the part name? That's okay — tell us the problem and we'll point you to the fix.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ArrowUp,     label: "Window Won't Stay Up",       desc: "Broken sash balance or spring",        href: "/shop?search=sash+balance" },
              { icon: Wrench,      label: "Crank Operator Broken",       desc: "Casement or awning won't open/close",  href: "/shop?search=casement+operator" },
              { icon: Move,        label: "Patio Door Hard to Slide",    desc: "Worn rollers or track damage",          href: "/shop?search=patio+door+roller" },
              { icon: Wind,        label: "Weatherstripping Worn Out",   desc: "Drafts, leaks, or worn seals",          href: "/shop?search=weatherstripping" },
              { icon: Lock,        label: "Lock Won't Latch",            desc: "Broken or misaligned lock hardware",   href: "/shop?search=window+lock" },
              { icon: LayoutGrid,  label: "Screen Door Damaged",         desc: "Torn screen, bent frame, or hardware", href: "/shop?search=screen+door" },
              { icon: Key,         label: "Handle Broken or Loose",      desc: "Door or window handle replacement",    href: "/shop?search=handle" },
              { icon: Droplets,    label: "Window Leaks Air or Water",   desc: "Glazing, seals, or frame repair",      href: "/parts-identification" },
            ].map(({ icon: Icon, label, desc, href }) => (
              <Link key={label} href={href} className="group bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl p-6 transition-all flex flex-col gap-3">
                <div className="w-11 h-11 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Icon className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm leading-snug mb-1">{label}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                </div>
                <span className="text-blue-400 text-xs font-semibold group-hover:text-white transition-colors mt-auto">
                  Find the fix &rarr;
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-400 mb-5">Not sure what's wrong? Our experts will diagnose it for free.</p>
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8" asChild>
              <Link href="/parts-identification">
                <PackageSearch className="mr-2 w-5 h-5" /> Upload a Photo — Free Parts ID
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Popular Categories Grid */}
      <section className="py-16 md:py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">Browse by Category</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">Quality parts proven and preferred by industry specialists.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Casement Operators', icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
              { name: 'Patio Door Rollers', icon: 'M5 12h14M12 5l7 7-7 7' },
              { name: 'Sash Locks', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
              { name: 'Weatherstripping', icon: 'M3 12h18M3 6h18M3 18h18' },
              { name: 'Hinges', icon: 'M8 6h8M8 12h8M8 18h8M4 6h2M4 12h2M4 18h2' },
              { name: 'Handles', icon: 'M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17' },
            ].map((cat, i) => (
              <Link key={i} href={`/shop?category=${encodeURIComponent(cat.name)}`} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-primary transition-all text-center group">
                <div className="w-12 h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{cat.name}</h3>
              </Link>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button variant="ghost" className="font-bold" asChild>
              <Link href="/categories">View All Categories <ChevronRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-white border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-6 h-6 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">Trusted by Homeowners & Contractors</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">Don't just take our word for it. See what our customers have to say about our parts and expertise.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 p-8 rounded-2xl border shadow-sm relative">
              <Quote className="w-10 h-10 text-primary/20 absolute top-6 left-6" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-700 italic mb-6 leading-relaxed">
                  "I spent 3 weeks trying to find a replacement lock for my 1995 Biltbest windows. Local stores had no clue. I sent a photo to All Window Door Parts and they identified it in 2 hours. Part arrived in 3 days and fit perfectly."
                </p>
                <div>
                  <h4 className="font-bold text-slate-900">— Robert M.</h4>
                  <p className="text-sm text-slate-500">Homeowner, Texas</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border shadow-sm relative">
              <Quote className="w-10 h-10 text-primary/20 absolute top-6 left-6" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-700 italic mb-6 leading-relaxed">
                  "As a contractor, time is money. Their Free Parts ID service is a lifesaver when I encounter an obscure casement operator. They always know what it is and ship it fast. Won't buy hardware anywhere else."
                </p>
                <div>
                  <h4 className="font-bold text-slate-900">— David K.</h4>
                  <p className="text-sm text-slate-500">General Contractor, Ohio</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl border shadow-sm relative">
              <Quote className="w-10 h-10 text-primary/20 absolute top-6 left-6" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-700 italic mb-6 leading-relaxed">
                  "Called with a question about installation for a patio door roller. The gentleman on the phone walked me through the process step-by-step. Real expertise from folks who actually know their products."
                </p>
                <div>
                  <h4 className="font-bold text-slate-900">— Sarah T.</h4>
                  <p className="text-sm text-slate-500">DIY Enthusiast, Florida</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
