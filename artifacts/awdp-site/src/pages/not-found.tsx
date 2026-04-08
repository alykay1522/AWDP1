import { Link } from "wouter";
import { PackageSearch, Home, ShoppingCart, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center bg-slate-50 py-16 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="text-8xl font-serif font-bold text-slate-200 mb-4 leading-none">404</div>
        <h1 className="text-2xl font-serif font-bold text-slate-900 mb-3">Page Not Found</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          We couldn't find the page you're looking for. The link may be broken or the page may have moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Button asChild>
            <Link href="/"><Home className="w-4 h-4 mr-2" /> Go Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop"><ShoppingCart className="w-4 h-4 mr-2" /> Browse Parts</Link>
          </Button>
          <Button asChild className="bg-red-600 hover:bg-red-700 text-white border-0">
            <Link href="/parts-identification"><PackageSearch className="w-4 h-4 mr-2" /> Free Parts ID</Link>
          </Button>
        </div>
        <div className="border-t pt-8 text-sm text-slate-500">
          <p>Need help finding a specific part?</p>
          <a href="tel:785-533-0244" className="inline-flex items-center gap-2 text-primary font-bold mt-2 hover:underline">
            <Phone className="w-4 h-4" /> 785-533-0244
          </a>
        </div>
      </div>
    </div>
  );
}
