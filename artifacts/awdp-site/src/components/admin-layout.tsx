import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Package, ShoppingBag, FolderTree,
  Settings, MessageSquare, Wrench, ImageIcon, DollarSign,
  ChevronRight, ExternalLink, LogOut,
  FileText, PenLine, RefreshCcw,
} from "lucide-react";
import { useAdminLogout } from "../lib/useAdminAuth.js";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  children?: { href: string; label: string }[];
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, exact: true },
  {
    href: "/admin/products",
    label: "Products",
    icon: <Package className="w-4 h-4" />,
    children: [
      { href: "/admin/products", label: "All Products" },
      { href: "/admin/products/new", label: "Add New" },
      { href: "/admin/products/import-package", label: "Products + Images" },
      { href: "/admin/products/bulk-editor", label: "Bulk Editor" },
      { href: "/admin/csv-import", label: "Description CSV" },
    ],
  },
  { href: "/admin/orders", label: "Orders", icon: <ShoppingBag className="w-4 h-4" /> },
  { href: "/admin/categories", label: "Categories", icon: <FolderTree className="w-4 h-4" /> },
  { href: "/admin/parts-id", label: "Parts ID Requests", icon: <Wrench className="w-4 h-4" /> },
  { href: "/admin/contacts", label: "Contact Messages", icon: <MessageSquare className="w-4 h-4" /> },
  { href: "/admin/images", label: "Product Images", icon: <ImageIcon className="w-4 h-4" /> },
  { href: "/admin/prices", label: "Price Monitor", icon: <DollarSign className="w-4 h-4" /> },
  { href: "/admin/price-sync", label: "Price Sync", icon: <RefreshCcw className="w-4 h-4" /> },
  { href: "/admin/content", label: "Site Content", icon: <PenLine className="w-4 h-4" /> },
  { href: "/admin/resources", label: "PDF Resources", icon: <FileText className="w-4 h-4" /> },
  { href: "/admin/settings", label: "Site Settings", icon: <Settings className="w-4 h-4" /> },
];

function isActive(path: string, href: string, exact?: boolean) {
  if (exact) return path === href;
  return path.startsWith(href);
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const logout = useAdminLogout();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col min-h-screen sticky top-0 h-screen overflow-y-auto z-10">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">Admin Panel</p>
          <p className="text-sm font-semibold text-white leading-tight">All Window Door Parts</p>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(location, item.href, item.exact);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
                {item.children && active && (
                  <div className="ml-7 mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                          location === child.href
                            ? "text-white font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <ChevronRight className="w-3 h-3" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700 space-y-1.5">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Live Site
          </Link>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2 text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1.5 rounded hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
