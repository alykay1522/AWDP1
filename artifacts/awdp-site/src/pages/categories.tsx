import { Link } from "wouter";
import { useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageSearch, FolderTree, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Categories() {
  const { data: categories, isLoading } = useGetCategories({
    query: {
      queryKey: getGetCategoriesQueryKey(),
    }
  });

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20">
      <PageSeo
        title="Product Categories"
        path="/categories"
        description="Browse window and door parts by category: operators, balances, locks, rollers, glazing seals, screens, hardware, and more. All Window Door Parts — veteran owned."
      />
      <div className="container mx-auto px-4">
        
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderTree className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-6">Browse Hardware Categories</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            With thousands of replacement parts in stock, browsing by category is the easiest way to find exactly what you need for your window or door repair project.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border shadow-sm flex flex-col items-center">
                <Skeleton className="w-20 h-20 rounded-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : categories && categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link 
                key={category.id} 
                href={`/shop?category=${encodeURIComponent(category.name)}`}
                className="group bg-white rounded-xl p-6 md:p-8 border border-slate-200 shadow-sm hover:shadow-md hover:border-primary transition-all flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-primary/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                
                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto bg-slate-100 group-hover:bg-white rounded-full flex items-center justify-center mb-6 shadow-sm transition-colors border">
                    {/* Fallback icons since we don't have real images in the scaffold data */}
                    <span className="text-2xl font-bold text-slate-400 group-hover:text-primary">{category.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  
                  <div className="inline-flex items-center justify-center bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full group-hover:bg-primary group-hover:text-white transition-colors mt-2">
                    {category.productCount} Parts Available
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-xl border border-dashed">
            <p className="text-lg text-slate-500">No categories found.</p>
          </div>
        )}

        {/* Free Parts ID Promo Banner */}
        <div className="mt-20 bg-primary rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-12 md:px-12 md:py-16 text-center max-w-4xl mx-auto">
            <PackageSearch className="w-16 h-16 text-accent mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">Still can't find what you're looking for?</h2>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              Don't waste time guessing which window or door part you need. Many look alike but have tiny, critical differences. Our seasoned experts (40+ years in the field) will do the hard work and find your exact match or upgrade&mdash;for free.
            </p>
            <Button size="lg" className="h-14 px-8 text-lg font-bold bg-accent hover:bg-accent/90 text-white shadow-lg" asChild>
              <Link href="/parts-identification">
                Use Free Parts Identification Service <ChevronRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
