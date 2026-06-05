import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, X, CheckSquare, Square, ChevronLeft, ChevronRight,
  DollarSign, Tag, Package, FileText, Trash2, AlertTriangle,
  Loader2, Check, Filter, SlidersHorizontal, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { parseApiResponseBody, readApiErrorMessage } from "@/lib/api-response";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminQueryError } from "@/components/admin/admin-error";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Window Balances",
  "Window Hardware",
  "Sash Hardware",
  "Door Hardware",
  "Window Glazing and Weatherstrip",
  "Screen Hardware and Accessories",
  "Other Hardware",
];

const ACTION_TABS = [
  { id: "price",        label: "Set Price",        icon: DollarSign },
  { id: "price-pct",    label: "Adjust Price %",   icon: DollarSign },
  { id: "category",     label: "Category",         icon: Tag },
  { id: "stock",        label: "Stock Status",     icon: Package },
  { id: "desc-append",  label: "Append Description", icon: FileText },
  { id: "desc-set",     label: "Set Description",  icon: FileText },
  { id: "variant-group", label: "Variant Group",   icon: Layers },
  { id: "variant-label", label: "Variant Label",   icon: Layers },
  { id: "sku-validate", label: "Validate SKUs",    icon: AlertTriangle },
  { id: "delete",        label: "Delete",          icon: Trash2 },
] as const;

const SKU_VALID_RE = /^[A-Za-z0-9._-]+$/;

function getSkuIssues(sku: string): string[] {
  const issues: string[] = [];
  if (/\s/.test(sku)) issues.push("Contains spaces");
  if (!SKU_VALID_RE.test(sku)) issues.push("Contains special characters");
  if (sku.length < 3) issues.push("Too short (< 3 chars)");
  if (sku.length > 64) issues.push("Too long (> 64 chars)");
  return issues;
}

type ActionId = typeof ACTION_TABS[number]["id"];

const PAGE_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: number; sku: string; name: string;
  price: string; category: string; inStock: boolean; imageUrl: string | null;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  totalPages: number;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounced<T>(val: T, ms: number): T {
  const [deb, setDeb] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDeb(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return deb;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchProducts(params: {
  search?: string; category?: string; zeroPrice?: boolean;
  inStock?: string; page: number;
}): Promise<ProductsResponse> {
  const q = new URLSearchParams({ page: String(params.page), limit: String(PAGE_SIZE) });
  if (params.search)   q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  if (params.inStock)  q.set("inStock", params.inStock);
  if (params.zeroPrice) q.set("zeroPrice", "true");
  const res = await fetch(`/api/admin/products?${q}`, { credentials: "include" });
  const parsed = await parseApiResponseBody(res);
  if (!res.ok) throw new Error(readApiErrorMessage(res, parsed, "Failed to load products"));
  if (!parsed.json) throw new Error(readApiErrorMessage(res, parsed, "Invalid product list response"));
  return parsed.json as unknown as ProductsResponse;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminBulkEditor() {
  const qc = useQueryClient();

  // Filters
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("");
  const [priceFilter, setPriceFilter] = useState(""); // "zero" | ""
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage]           = useState(1);

  const debSearch = useDebounced(search, 350);

  // Reset page when filters change
  useEffect(() => { setPage(1); setSelectedSkus(new Set()); setSelectAllMatching(false); },
    [debSearch, category, priceFilter, stockFilter]);

  // Selection state
  const [selectedSkus, setSelectedSkus]           = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  // Action state
  const [activeAction, setActiveAction] = useState<ActionId>("price");
  const [priceValue, setPriceValue]     = useState("");
  const [pctValue, setPctValue]         = useState("");
  const [catValue, setCatValue]         = useState("");
  const [stockValue, setStockValue]     = useState<"true" | "false">("true");
  const [descValue, setDescValue]             = useState("");
  const [variantGroupValue, setVariantGroupValue] = useState("");
  const [variantLabelValue, setVariantLabelValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Query
  const { 
    data, 
    isLoading, 
    isError, 
    error: queryError,
    refetch 
  } = useQuery({
    queryKey: ["admin-bulk", debSearch, category, priceFilter, stockFilter, page],
    queryFn: () => fetchProducts({
      search: debSearch || undefined,
      category: category || undefined,
      zeroPrice: priceFilter === "zero" || undefined,
      inStock: stockFilter || undefined,
      page,
    }),
    placeholderData: (prev) => prev,
  });

  const products = data?.products ?? [];
  const total    = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // ── Selection helpers ────────────────────────────────────────────────────────

  const pageSkus = products.map((p) => p.sku);
  const allOnPageSelected = pageSkus.length > 0 && pageSkus.every((s) => selectedSkus.has(s));
  const someOnPageSelected = pageSkus.some((s) => selectedSkus.has(s));

  const togglePageAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedSkus((prev) => { const n = new Set(prev); pageSkus.forEach((s) => n.delete(s)); return n; });
      setSelectAllMatching(false);
    } else {
      setSelectedSkus((prev) => { const n = new Set(prev); pageSkus.forEach((s) => n.add(s)); return n; });
    }
  }, [allOnPageSelected, pageSkus]);

  const toggleSku = useCallback((sku: string) => {
    setSelectAllMatching(false);
    setSelectedSkus((prev) => {
      const n = new Set(prev);
      if (n.has(sku)) n.delete(sku); else n.add(sku);
      return n;
    });
  }, []);

  const clearSelection = () => { setSelectedSkus(new Set()); setSelectAllMatching(false); };

  const selectionCount = selectAllMatching ? total : selectedSkus.size;

  // ── Bulk update mutation ─────────────────────────────────────────────────────

  const applyMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/admin/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const parsed = await parseApiResponseBody(res);
      if (!res.ok) throw new Error(readApiErrorMessage(res, parsed, "Update failed"));
      return parsed.json ?? {};
    },
    onSuccess: (data) => {
      toast({ title: "Done", description: data.message });
      qc.invalidateQueries({ queryKey: ["admin-bulk"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      clearSelection();
      setConfirmDelete(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (skus: string[]) => {
      const results = await Promise.all(
        skus.map((sku) =>
          fetch(`/api/admin/products/${encodeURIComponent(sku)}`, { method: "DELETE" })
        )
      );
      return results.length;
    },
    onSuccess: (count) => {
      toast({ title: "Deleted", description: `${count} product${count !== 1 ? "s" : ""} deleted` });
      qc.invalidateQueries({ queryKey: ["admin-bulk"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["/api/catalog/stats"] });
      clearSelection();
      setConfirmDelete(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const buildPayload = () => {
    const target = selectAllMatching
      ? { filter: { search: debSearch || undefined, category: category || undefined, zeroPrice: priceFilter === "zero" || undefined, inStock: stockFilter || undefined } }
      : { skus: [...selectedSkus] };

    switch (activeAction) {
      case "price":
        return { ...target, updates: { price: parseFloat(priceValue) } };
      case "price-pct":
        return { ...target, updates: { priceAdjustPercent: parseFloat(pctValue) } };
      case "category":
        return { ...target, updates: { category: catValue } };
      case "stock":
        return { ...target, updates: { inStock: stockValue === "true" } };
      case "desc-append":
        return { ...target, updates: { descriptionAppend: descValue } };
      case "desc-set":
        return { ...target, updates: { descriptionSet: descValue } };
      case "variant-group":
        return { ...target, updates: { variantGroupId: variantGroupValue || null } };
      case "variant-label":
        return { ...target, updates: { variantLabel: variantLabelValue || null } };
      default:
        return null;
    }
  };

  const handleApply = () => {
    if (activeAction === "delete") {
      if (!confirmDelete) { setConfirmDelete(true); return; }
      if (selectAllMatching) {
        toast({ title: "Safety limit", description: "Select specific products to delete — deleting all matching a filter is not allowed.", variant: "destructive" });
        return;
      }
      deleteMutation.mutate([...selectedSkus]);
      return;
    }
    setConfirmDelete(false);
    const payload = buildPayload();
    if (!payload) return;
    applyMutation.mutate(payload);
  };

  const isApplying = applyMutation.isPending || deleteMutation.isPending;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const hasFilters = !!(debSearch || category || priceFilter || stockFilter);

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Editor</h1>
        <p className="text-slate-500 text-sm mt-1">
          Filter products, select rows, then apply changes to all selected at once.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input
            placeholder="Search SKU or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search products"
          />
        </div>

        <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
          <SelectTrigger className="w-52" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={priceFilter || "all"} onValueChange={(v) => setPriceFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40" aria-label="Filter by price">
            <SelectValue placeholder="All prices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All prices</SelectItem>
            <SelectItem value="zero">$0.00 only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stockFilter || "all"} onValueChange={(v) => setStockFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36" aria-label="Filter by stock">
            <SelectValue placeholder="All stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="true">In stock</SelectItem>
            <SelectItem value="false">Out of stock</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(""); setPriceFilter(""); setStockFilter(""); }}
            className="text-slate-500 hover:text-red-600">
            <X className="w-4 h-4 mr-1" /> Clear filters
          </Button>
        )}

        <div className="ml-auto text-sm text-slate-500 self-center font-medium">
          {isLoading ? "Loading…" : `${total.toLocaleString()} products`}
        </div>
      </div>

      {/* Bulk Action Panel — shown when items selected */}
      {selectionCount > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          {/* Selection info */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm font-bold text-primary">
              {selectionCount.toLocaleString()} product{selectionCount !== 1 ? "s" : ""} selected
            </span>
            {allOnPageSelected && !selectAllMatching && total > products.length && (
              <Button variant="outline" size="sm" className="text-xs h-7 border-primary text-primary hover:bg-primary hover:text-white"
                onClick={() => setSelectAllMatching(true)}>
              <Button variant="outline" size="sm" className="text-xs h-7 border-primary text-primary hover:bg-primary hover:text-white"
                onClick={() => setSelectAllMatching(true)}>
                Select all {total.toLocaleString()} matching this filter
              </Button>
            )}
            {selectAllMatching && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> All {total.toLocaleString()} matching products will be updated
              </span>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-7 text-slate-500" onClick={clearSelection}>
              <X className="w-3 h-3 mr-1" /> Clear selection
            </Button>
          </div>

          {/* Action tabs */}
          <div className="flex gap-1 flex-wrap mb-4">
            {ACTION_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setActiveAction(id); setConfirmDelete(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeAction === id
                    ? id === "delete" ? "bg-red-600 text-white" : "bg-primary text-white"
                    : id === "delete" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-white border text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Action input */}
          <div className="flex items-end gap-3 flex-wrap">
            {activeAction === "price" && (
              <div className="flex-1 min-w-[180px] max-w-xs">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">New price ($)</label>
                <Input type="number" min="0" step="0.01" placeholder="e.g. 49.99"
                  value={priceValue} onChange={(e) => setPriceValue(e.target.value)} className="bg-white" />
              </div>
            )}
            {activeAction === "price-pct" && (
              <div className="flex-1 min-w-[180px] max-w-xs">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Adjust by % (positive = markup, negative = discount)
                </label>
                <Input type="number" step="0.1" placeholder="e.g. 20 or -10"
                  value={pctValue} onChange={(e) => setPctValue(e.target.value)} className="bg-white" />
              </div>
            )}
            {activeAction === "category" && (
              <div className="flex-1 min-w-[220px] max-w-xs">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">New category</label>
                <Select value={catValue || "__none"} onValueChange={(v) => setCatValue(v === "__none" ? "" : v)}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Pick category…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeAction === "stock" && (
              <div className="flex-1 min-w-[180px] max-w-xs">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Stock status</label>
                <Select value={stockValue} onValueChange={(v) => setStockValue(v as "true" | "false")}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">In Stock</SelectItem>
                    <SelectItem value="false">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(activeAction === "desc-append" || activeAction === "desc-set") && (
              <div className="flex-1 min-w-[280px]">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  {activeAction === "desc-set" ? "Replace all descriptions with:" : "Append to all descriptions:"}
                </label>
                <textarea
                  rows={3}
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  placeholder={activeAction === "desc-set"
                    ? "New description text…"
                    : "Text to append (e.g. contact CTA)…"
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            {activeAction === "variant-group" && (
              <div className="flex-1 min-w-[260px] max-w-sm">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Variant Group ID <span className="font-normal text-slate-400">(leave blank to clear)</span>
                </label>
                <Input
                  value={variantGroupValue}
                  onChange={(e) => setVariantGroupValue(e.target.value)}
                  placeholder="e.g. truth-casement-operator"
                  className="bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">Same ID links products as color/hand variants. Leave blank to remove from any group.</p>
              </div>
            )}
            {activeAction === "variant-label" && (
              <div className="flex-1 min-w-[220px] max-w-xs">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Variant Label <span className="font-normal text-slate-400">(e.g. "Left Hand", "White")</span>
                </label>
                <Input
                  value={variantLabelValue}
                  onChange={(e) => setVariantLabelValue(e.target.value)}
                  placeholder="e.g. Left Hand, White, 36""
                  className="bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">Shown on the product page variant picker. Leave blank to clear.</p>
              </div>
            )}
            {activeAction === "sku-validate" && (() => {
              const skusToCheck = selectAllMatching ? products : products.filter(p => selectedSkus.has(p.sku));
              const issues = skusToCheck.map(p => ({ ...p, skuIssues: getSkuIssues(p.sku) })).filter(p => p.skuIssues.length > 0);
              return (
                <div className="flex-1">
                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <p className="text-sm font-bold text-slate-800">
                        Validated {skusToCheck.length} selected SKU{skusToCheck.length !== 1 ? "s" : ""} — {issues.length === 0 ? "no issues found" : `${issues.length} issue${issues.length !== 1 ? "s" : ""} found`}
                      </p>
                    </div>
                    {issues.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {issues.map(p => (
                          <div key={p.sku} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-md px-3 py-2 text-xs">
                            <span className="font-mono text-slate-700 shrink-0 font-bold">{p.sku}</span>
                            <span className="text-slate-500 truncate">{p.name}</span>
                            <div className="ml-auto flex gap-1 flex-wrap shrink-0">
                              {p.skuIssues.map(issue => (
                                <span key={issue} className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold whitespace-nowrap">{issue}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                    ) : (
                      <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> All selected SKUs pass format validation.
                      </p>
                    )}
                    {skusToCheck.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">Select products above to validate their SKU format.</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {activeAction === "delete" && (
              <div className="flex-1">
                {confirmDelete ? (
                  <p className="text-red-600 font-bold text-sm">
                    Are you sure? This will permanently delete {selectionCount} product{selectionCount !== 1 ? "s" : ""}. Click Delete again to confirm.
                ) : (
                  <p className="text-slate-600 text-sm">
                    Permanently delete {selectionCount} selected product{selectionCount !== 1 ? "s" : ""} from the catalog.
                  </p>
                )}
              </div>
            )}

            {/* Apply button — hidden for sku-validate */}
            {activeAction !== "sku-validate" && (
            <Button
              onClick={handleApply}
              disabled={isApplying || (
                (activeAction === "price" && !priceValue) ||
                (activeAction === "price-pct" && !pctValue) ||
                (activeAction === "category" && !catValue) ||
                ((activeAction === "desc-append" || activeAction === "desc-set") && !descValue)
              )}
              className={activeAction === "delete" && confirmDelete
                ? "bg-red-600 hover:bg-red-700 text-white border-0"
                : ""}
              variant={activeAction === "delete" ? (confirmDelete ? "destructive" : "outline") : "default"}
            >
              {isApplying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying…</>
              ) : activeAction === "delete" && confirmDelete ? (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete {selectionCount} products</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Apply to {selectionCount.toLocaleString()} product{selectionCount !== 1 ? "s" : ""}</>
              )}
            </Button>
            )}
            {confirmDelete && (
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="text-slate-500">
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Product table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[40px_48px_160px_1fr_90px_180px_90px] gap-2 px-4 py-3 bg-slate-50 border-b text-xs font-bold uppercase tracking-wide text-slate-500">
          <div className="flex items-center justify-center">
            <button
              onClick={togglePageAll}
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
              aria-label={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
            >
              {allOnPageSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : someOnPageSelected ? (
                <div className="w-4 h-4 border-2 border-primary rounded-sm flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-primary" />
                </div>
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          </div>
          <div></div>
          <div>SKU</div>
          <div>Name</div>
          <div className="text-right">Price</div>
          <div>Category</div>
          <div>Stock</div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading products…
          </div>
        ) : isError ? (
          <div className="p-8">
            <AdminQueryError error={queryError} onRetry={refetch} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No products match your filters.
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const isSelected = selectAllMatching || selectedSkus.has(product.sku);
              const price = parseFloat(product.price);
              const isZero = price === 0;

              return (
                <div
                  key={product.sku}
                  onClick={() => toggleSku(product.sku)}
                  className={`grid grid-cols-[40px_48px_160px_1fr_90px_180px_90px] gap-2 px-4 py-3 cursor-pointer transition-colors items-center ${
                    isSelected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-slate-50"
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-primary border-primary" : "border-slate-300"
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>

                  {/* Thumbnail */}
                  <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden shrink-0">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-4 h-4" />
                    </div>
                    )}
                  </div>

                  {/* SKU */}
                  <div className="font-mono text-xs text-slate-600 truncate" title={product.sku}>
                    {product.sku}
                  </div>

                  {/* Name */}
                  <div className="text-sm text-slate-800 truncate font-medium" title={product.name}>
                    {product.name}
                  </div>

                  {/* Price */}
                  <div className={`text-sm font-bold text-right tabular-nums ${isZero ? "text-red-500" : "text-slate-900"}`}>
                    {isZero ? "$0.00" : `$${price.toFixed(2)}`}
                  </div>

                  {/* Category */}
                  <div className="text-xs text-slate-500 truncate" title={product.category}>
                    {product.category}
                  </div>

                  {/* Stock */}
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      product.inStock
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}>
                      {product.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} — {total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let n = page;
              if (page <= 3)                         n = i + 1;
              else if (page >= totalPages - 2)       n = totalPages - 4 + i;
              else                                   n = page - 2 + i;
              if (n < 1 || n > totalPages) return null;
              return (
                <Button key={n} size="sm"
                  variant={page === n ? "default" : "ghost"}
                  className="w-9 p-0"
                  onClick={() => setPage(n)}
                >{n}</Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
