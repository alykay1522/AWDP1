import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, PlusCircle, Edit2, Trash2, Check, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Filter, Package, ExternalLink, RefreshCw, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: number; sku: string; name: string; description: string;
  price: string; originalPrice: string | null; category: string;
  supplier: string; inStock: boolean; imageUrl: string | null;
  tags: string[]; createdAt: string;
}

const PAGE_SIZE = 25;

const CATEGORIES = [
  "Window Operators & Cranks","Window Locks & Latches","Window Balances",
  "Window Screens & Frames","Door Hardware","Door Locks & Multipoint",
  "Weatherstripping & Seals","Hinges & Pivots","Rollers & Guides",
  "Sash & Frame Parts","Glazing & Seals","Deer Blind Windows","Skylights",
  "Rollers & Screens","Window & Door Hardware","Locks & Handles","Tracks & Channels",
];

export default function AdminProductsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSupplier, setEditSupplier] = useState("");

  const { data, isLoading, refetch } = useQuery<{ products: Product[] }>({
    queryKey: ["admin-products-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sku, updates }: { sku: string; updates: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/products/${sku}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Update failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products-list"] }); setEditingId(null); toast({ title: "Product updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sku: string) => {
      if (!confirm(`Delete ${sku}? This cannot be undone.`)) throw new Error("cancelled");
      const res = await fetch(`/api/admin/products/${sku}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Delete failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products-list"] }); toast({ title: "Product deleted" }); },
    onError: (e: Error) => { if (e.message !== "cancelled") toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const all = data?.products ?? [];

  const filtered = all.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
      p.supplier?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchStock = stockFilter === "all" || (stockFilter === "in" ? p.inStock : !p.inStock);
    return matchSearch && matchCat && matchStock;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, catFilter, stockFilter]);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditPrice(p.price);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    setEditSupplier(p.supplier ?? "");
  };

  const saveEdit = (sku: string) => {
    updateMutation.mutate({ sku, updates: {
      price: Number(editPrice),
      name: editName,
      description: editDesc,
      supplier: editSupplier,
    }});
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Products</h1>
          <p className="text-slate-400 text-sm">{all.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-1" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Link href="/admin/products/new">
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90"><PlusCircle className="w-4 h-4" /> Add Product</Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, name, category, supplier…" className="pl-9" />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-48">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All Stock</option>
            <option value="in">In Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="text-center py-16 text-muted-foreground">Loading products…</p>
          ) : paged.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">No products match your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">SKU</th>
                      <th className="text-left px-4 py-3">Name</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Category</th>
                      <th className="text-left px-4 py-3 hidden lg:table-cell">Supplier</th>
                      <th className="text-right px-4 py-3">Price</th>
                      <th className="text-center px-4 py-3">Stock</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paged.map((p) => (
                      <tr key={p.id} className={`hover:bg-slate-50 ${editingId === p.id ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{p.sku}</td>
                        <td className="px-4 py-3">
                          {editingId === p.id ? (
                            <div className="space-y-1">
                              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs py-0" />
                              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="h-7 text-xs py-0" />
                              <Input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} placeholder="Supplier" className="h-7 text-xs py-0" />
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium leading-tight line-clamp-1">{p.name}</p>
                              {p.supplier && <p className="text-xs text-muted-foreground">{p.supplier}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{p.category}</td>
                        <td className="px-4 py-3 text-xs hidden lg:table-cell">{p.supplier ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {editingId === p.id ? (
                            <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                              type="number" step="0.01" className="h-7 w-24 text-xs py-0 ml-auto" />
                          ) : (
                            <span className="font-bold">${Number(p.price).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => updateMutation.mutate({ sku: p.sku, updates: { inStock: !p.inStock } })}
                            className={`text-xs px-2 py-1 rounded-full font-medium border transition-colors ${
                              p.inStock ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                            }`}
                          >
                            {p.inStock ? "In Stock" : "Out"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {editingId === p.id ? (
                              <>
                                <button onClick={() => saveEdit(p.sku)} className="p-1 rounded hover:bg-green-100 text-green-700"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-red-100 text-red-500"><X className="w-4 h-4" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-blue-100 text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                <a href={`/product/${p.sku}`} className="p-1 rounded hover:bg-slate-100 text-slate-500" target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                                <button onClick={() => deleteMutation.mutate(p.sku)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRightIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
