import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import { Helmet } from "react-helmet-async";

const BASE_URL = "https://www.allwindowdoorparts.com";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const allItems = [{ label: "Home", href: "/" }, ...items];

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${BASE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(ldJson)}</script>
      </Helmet>

      <nav aria-label="Breadcrumb" className="bg-white border-b py-3 text-sm">
        <ol className="container mx-auto px-4 flex items-center text-muted-foreground whitespace-nowrap overflow-x-auto hide-scrollbar gap-0">
          {allItems.map((item, i) => {
            const isLast = i === allItems.length - 1;
            return (
              <li key={i} className="flex items-center shrink-0">
                {i > 0 && (
                  <ChevronRight className="w-4 h-4 mx-2 opacity-40 shrink-0" aria-hidden="true" />
                )}
                {isLast ? (
                  <span className="text-foreground font-medium truncate max-w-[240px]" aria-current="page">
                    {item.label}
                  </span>
                ) : i === 0 ? (
                  <Link href={item.href!} className="hover:text-primary transition-colors flex items-center gap-1">
                    <Home className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Home</span>
                  </Link>
                ) : (
                  <Link href={item.href!} className="hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
