import { Shield, Award, CheckCircle2, Factory, Wrench, Users, Download } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetCatalogStats, getGetCatalogStatsQueryKey } from "@workspace/api-client-react";

export default function About() {
  const { data: stats } = useGetCatalogStats({
    query: {
      queryKey: getGetCatalogStatsQueryKey(),
    }
  });

  return (
    <div className="flex flex-col">
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
                  All Window Door Parts didn't start in a boardroom. It started in the field. Founded by veterans with deep roots in the construction and fenestration industry, we've spent over four decades dealing with broken balances, stripped locks, and obsolete hinges.
                </p>
                <p>
                  We realized that homeowners and contractors were wasting countless hours trying to find replacement parts for older windows and doors. Manufacturers go out of business, designs change, and what used to be a simple trip to the hardware store turns into a wild goose chase.
                </p>
                <p>
                  We built this company to be the ultimate solution. If a part exists, we have it or can get it. If it doesn't exist anymore, we know the exact modern equivalent that will work.
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
                Our team has over 40 years of hands-on experience. We know Biltbest, Truth Hardware, Oldach, and Strybuc inside and out.
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

      {/* Catalog Stats Section */}
      {stats && (
        <section className="py-16 bg-white border-b">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-slate-900 rounded-xl p-8 shadow-inner text-white border border-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-700 pb-6">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-white mb-2">Catalog Database Statistics</h3>
                  <p className="text-slate-400">Live summary of our current hardware inventory.</p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center gap-2 bg-blue-500/10 text-blue-300 px-4 py-2 rounded-lg text-sm font-medium border border-blue-500/20">
                  <Download className="w-4 h-4" /> Export to WordPress/WooCommerce Ready
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400 mb-1">{stats.totalProducts}</div>
                  <div className="text-sm text-slate-400 uppercase tracking-wide">Total Products</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400 mb-1">{stats.totalCategories}</div>
                  <div className="text-sm text-slate-400 uppercase tracking-wide">Categories</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400 mb-1">{stats.supplierBreakdown.length}</div>
                  <div className="text-sm text-slate-400 uppercase tracking-wide">Suppliers</div>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400 mb-1">{stats.topCategories.length > 0 ? stats.topCategories[0].count : 0}</div>
                  <div className="text-sm text-slate-400 uppercase tracking-wide">Top Category</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-2" asChild>
              <Link href="/parts-identification">Free Parts ID Service</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
