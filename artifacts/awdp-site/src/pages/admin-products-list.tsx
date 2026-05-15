import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, PlusCircle, Edit2, Trash2, Check, X,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  Package, ExternalLink, RefreshCw, Download, Upload, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { parseApiResponseBody, readApiErrorMessage } from "@/lib/api-response";

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuote = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ',') { fields.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }
  const headers = splitLine(lines[0]);
  return lines.slice(1).filter((l) => l.trim()).map((l) => {
    const vals = splitLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

interface Product {
  id: number; sku: string; name: string; description: string;
  price: string; originalPrice: string | null; category: string;
  supplier: string; inStock: boolean; imageUrl: string | null;
  tags: string[]; createdAt: string;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Category { id: number; name: string; productCount?: number; }

const PAGE_SIZE = 50;
/**
 * Rows per POST to `/api/admin/products/import`.
 * Keep modest: Vercel rejects request bodies over ~4.5MB and each row can include long descriptions.
 */
const PRODUCT_IMPORT_CHUNK = 40;

function useDebounced<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

export default function AdminProductsList() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState("");
  const [catFilter, setCatFilter]   = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage]             = useState(1);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editPrice, setEditPrice]   = useState("");
  const [editName, setEditName]     = useState("");
  const [editDesc, setEditDesc]     = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [importing, setImporting]     = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [renaming, setRenaming]       = useState(false);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const renameInputRef    = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounced(search, 350);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, catFilter, stockFilter]);

  // ── Fetch products (server-side) ──────────────────────────────────────────
  const params = new URLSearchParams({
    page:  String(page),
    limit: String(PAGE_SIZE),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(catFilter       ? { category: catFilter }     : {}),
    ...(stockFilter     ? { inStock:  stockFilter }   : {}),
  });

  const queryKey = ["admin-products", page, debouncedSearch, catFilter, stockFilter];

  const { data, isLoading, isFetching, refetch } = useQuery<ProductsResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/products?${params}`);
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  // ── Fetch categories for filter dropdown ──────────────────────────────────
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setEditingId(null);
      toast({ title: "Product updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sku: string) => {
      if (!confirm(`Delete ${sku}? This cannot be undone.`)) throw new Error("cancelled");
      const res = await fetch(`/api/admin/products/${sku}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Delete failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["/api/catalog/stats"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: Error) => { if (e.message !== "cancelled") toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/products/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "awdp-products.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "awdp-products.csv downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast({ title: "Empty file", description: "No rows found in the CSV", variant: "destructive" }); return; }

      const acc = { inserted: 0, updated: 0, errored: 0, skipped: 0, needsPricing: 0 };
      const errSamples: string[] = [];
      const totalChunks = Math.ceil(rows.length / PRODUCT_IMPORT_CHUNK);
      const longWait = 600_000;

      for (let c = 0; c < totalChunks; c++) {
        const slice = rows.slice(c * PRODUCT_IMPORT_CHUNK, (c + 1) * PRODUCT_IMPORT_CHUNK);
        const res = await fetch("/api/admin/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(longWait),
        });
        const parsed = await parseApiResponseBody(res);
        if (!res.ok) {
          throw new Error(
            readApiErrorMessage(res, parsed, `Import failed (batch ${c + 1}/${totalChunks})`),
          );
        }
        const result = parsed.json ?? {};
        if (!parsed.json && parsed.text.trim()) {
          throw new Error(
            readApiErrorMessage(res, parsed, `Import returned a non-JSON response (batch ${c + 1}/${totalChunks})`),
          );
        }
        acc.inserted += result.inserted ?? 0;
        acc.updated += result.updated ?? 0;
        acc.errored += result.errored ?? 0;
        acc.skipped += result.skipped ?? 0;
        acc.needsPricing += result.needsPricing ?? 0;
        if (Array.isArray(result.errors)) {
          for (const line of result.errors as string[]) {
            if (errSamples.length < 12) errSamples.push(line);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-categories-list"] });
      qc.invalidateQueries({ queryKey: ["/api/catalog/stats"] });
      const parts = [
        acc.inserted && `${acc.inserted} added`,
        acc.updated && `${acc.updated} updated`,
        acc.needsPricing && `${acc.needsPricing} need pricing`,
        acc.skipped && `${acc.skipped} blank rows skipped`,
        acc.errored && `${acc.errored} errors`,
      ].filter(Boolean).join(" · ");
      const descBits = [parts || "No changes"];
      if (totalChunks > 1) descBits.push(`${totalChunks} batches`);
      if (errSamples.length) descBits.push(errSamples.join("; "));
      toast({
        title: acc.errored > 0 ? "Import finished with errors" : "Import complete",
        description: descBits.join(" — "),
        variant: acc.errored > 0 && !acc.inserted && !acc.updated ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ── Rename map upload ─────────────────────────────────────────────────────
  const handleRenameFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (renameInputRef.current) renameInputRef.current.value = "";
    if (!file) return;

    setRenaming(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No rows found in the CSV", variant: "destructive" });
        return;
      }

      const res = await fetch("/api/admin/products/bulk-rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows }),
      });
      const parsed = await parseApiResponseBody(res);
      if (!res.ok) throw new Error(readApiErrorMessage(res, parsed, "Rename failed"));
      const result = parsed.json ?? {};

      qc.invalidateQueries({ queryKey: ["admin-products"] });

      const parts = [
        result.productsUpdated && `${result.productsUpdated} products renamed`,
        result.notFound        && `${result.notFound} names not found in catalog`,
        result.skipped         && `${result.skipped} rows skipped`,
      ].filter(Boolean).join(" · ");

      toast({
        title: result.notFound > 0 ? "Rename complete (some misses)" : "Rename complete",
        description: parts || "No changes",
      });

      if (result.misses?.length > 0) {
        console.warn("Names not found in catalog:", result.misses);
      }
    } catch (e: any) {
      toast({ title: "Rename failed", description: e.message, variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditPrice(p.price);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    setEditSupplier(p.supplier ?? "");
  };
  const saveEdit = (sku: string) =>
    updateMutation.mutate({ sku, updates: {
      price: Number(editPrice), name: editName,
      description: editDesc, supplier: editSupplier,
    }});

  const products    = data?.products    ?? [];
  const total       = data?.total       ?? 0;
  const totalPages  = data?.totalPages  ?? 1;
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo   = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="bg-slate-50 min-h-screen pb-20">

      {/* Header */}
      <div className="bg-slate-900 text-white py-5 px-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">All Products</h1>
          <p className="text-slate-400 text-sm">
            {total.toLocaleString()} total
            {(debouncedSearch || catFilter || stockFilter) && " matching filters"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800"
            onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-1.5"
            onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export All CSV
          </Button>
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-1.5"
            onClick={() => fileInputRef.current?.click()} disabled={importing}
            title={`Imports in chunks of ${PRODUCT_IMPORT_CHUNK} rows. Columns match Export (category, sku, price, stock, etc.). Blank category is inferred from AWDP SKU + name; existing categories are kept on update.`}>
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import CSV
          </Button>
          <Button size="sm" variant="outline"
            className="border-yellow-500 text-yellow-300 hover:bg-yellow-900/30 gap-1.5"
            onClick={() => renameInputRef.current?.click()} disabled={renaming}
            title="Upload a CSV with 'Original Title' and 'AWDP Title' columns to rename products in bulk">
            {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Name Map
          </Button>
          <input ref={fileInputRef}    type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <input ref={renameInputRef}  type="file" accept=".csv,text/csv" className="hidden" onChange={handleRenameFile} />
          <Link href="/admin/products/new">
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <PlusCircle className="w-4 h-4" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">

        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, name, category, supplier…"
              className="pl-9"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-52"
          >
            <option value="">All Categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Stock Status</option>
            <option value="true">In Stock</option>
            <option value="false">Out of Stock</option>
          </select>
          {(search || catFilter || stockFilter) && (
            <Button variant="ghost" size="sm" className="text-slate-500 whitespace-nowrap"
              onClick={() => { setSearch(""); setCatFilter(""); setStockFilter(""); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading products…
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">No products match your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3 w-10">#</th>
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
                    {products.map((p, i) => (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${editingId === p.id ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {showingFrom + i}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {p.sku}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs">
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
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">{p.category}</td>
                        <td className="px-4 py-2.5 text-xs hidden lg:table-cell">{p.supplier ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          {editingId === p.id ? (
                            <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                              type="number" step="0.01" className="h-7 w-24 text-xs py-0 ml-auto" />
                          ) : (
                            <span className="font-bold">${Number(p.price).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => updateMutation.mutate({ sku: p.sku, updates: { inStock: !p.inStock } })}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                              p.inStock
                                ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                            }`}
                          >
                            {p.inStock ? "In Stock" : "Out"}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right">
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
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm bg-slate-50">
                <span className="text-muted-foreground">
                  {total === 0 ? "No products" : `${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${total.toLocaleString()} products`}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-medium text-slate-600">
                    Page {page} of {totalPages.toLocaleString()}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>Last</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
