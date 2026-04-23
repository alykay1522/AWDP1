import { Shield, Award, Factory, Wrench } from "lucide-react";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <div className="flex flex-col">
      <PageSeo
        title="About Us — 40+ Years of Window & Door Expertise"
        path="/about"
        description="All Window Door Parts is a veteran-owned business with over 40 years of experience supplying window and door replacement parts to homeowners, contractors, and businesses across the USA."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "All Window Door Parts",
          "alternateName": "AllWindowDoorParts GROUP USA",
          "description": "Veteran-owned supplier of replacement window and door hardware parts with over 40 years of industry experience. We specialize in hard-to-find, obsolete, and brand-specific parts.",
          "url": "https://www.allwindowdoorparts.com",
          "telephone": "+17855330244",
          "email": "Info@allwindowdoorparts.com",
          "image": "https://www.allwindowdoorparts.com/opengraph.jpg",
          "foundingDate": "1984",
          "areaServed": "USA",
          "currenciesAccepted": "USD",
          "paymentAccepted": "Credit Card, PayPal, Visa, MasterCard, Discover, American Express",
          "openingHoursSpecification": [
            { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "08:00", "closes": "17:00" }
          ],
          "sameAs": ["https://www.allwindowdoorparts.com"]
        }}
      />
      <Breadcrumb items={[{ label: "About Us" }]} />
      {/* Hero Section */}
      <section className="bg-slate-900 text-white py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-accent/90 backdrop-blur text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg mb-8 uppercase tracking-wider">
              <Shield className="w-4 h-4" /> Veteran Owned & Operated
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">40+ Years of Hardware Expertise</h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              We are America's trusted source for replacement window and door parts. We don't just sell hardware; we solve problems.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6">Our Story</h2>
              <div className="space-y-4 text-lg text-slate-600 leading-relaxed">
                <p>
                  Our AllWindowDoorParts GROUP USA was built by industry veterans&mdash;not executives in a boardroom. With over 40 years of hands-on experience in construction, remodeling and fenestration, we've dealt with every kind of window and door hardware challenge.
                </p>
                <p>
                  We have helped D.I.Y. homeowners, contractors big and small wasting precious time searching for parts that were discontinued, redesigned, or impossible to find in hardware stores and big box stores. So, we created a company dedicated to solving that problem.
                </p>
                <p>
                  If a part exists, we can get it. If it doesn't, we know the right modern replacement&mdash;or can confirm and save you time wasted when something is truly no longer available.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative z-10">
                <img src="https://images.unsplash.com/photo-1541888081622-44670c57c433?q=80&w=2070&auto=format&fit=crop" alt="Workshop tools" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-slate-100 rounded-full border-8 border-white z-0 hidden md:block"></div>
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/5 rounded-full z-0 hidden md:block"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Values/Stats Section */}
      <section className="py-20 bg-slate-50 border-y">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Unmatched Expertise</h3>
              <p className="text-slate-600">
                Our team has over 40 years of hands-on experience. We know Casement, Awning, Single/Double Hung and slider windows inside and out.
              </p>
            </div>
            
            <div className="bg-primary p-8 rounded-2xl shadow-md border text-center text-white transform md:-translate-y-4">
              <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-3">Veteran Owned</h3>
              <p className="text-blue-100">
                Operated with the same integrity, precision, and dedication to service that we learned in the military.
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Factory className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Massive Inventory</h3>
              <p className="text-slate-600">
                We stock thousands of parts from hundreds of manufacturers, including rare and hard-to-find components.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* CTA */}
      <section className="py-24 bg-white text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <Wrench className="w-16 h-16 mx-auto text-slate-300 mb-6" />
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6">Ready to fix that window or door?</h2>
          <p className="text-xl text-slate-600 mb-10">
            Browse our catalog or let our experts find the exact part you need for free.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg font-bold" asChild>
              <Link href="/shop">Shop All Parts</Link>
            </Button>
            <Button size="lg" className="h-14 px-8 text-lg font-bold bg-red-600 hover:bg-red-700 text-white border-0" asChild>
              <Link href="/parts-identification">Free Parts ID Service</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
