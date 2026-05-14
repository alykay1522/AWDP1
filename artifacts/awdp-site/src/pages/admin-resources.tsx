import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, FileText, ExternalLink, Loader2,
  Eye, EyeOff, GripVertical, Check, X, AlertCircle, Upload, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PdfResource {
  id: number;
  title: string;
  brand: string;
  category: string;
  type: string;
  url: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

type FormData = Omit<PdfResource, "id" | "createdAt">;

const EMPTY_FORM: FormData = {
  title: "", brand: "", category: "", type: "Product Catalog",
  url: "", description: "", sortOrder: 0, isActive: true,
};

const CATEGORIES = [
  "Casement Windows", "Double Hung Windows", "Patio Doors",
  "Hardware & Accessories", "Support Guides & Balances",
];

const TYPES = ["Measurement Guide", "Product Catalog", "How-To Guide", "Reference"];

const TYPE_COLORS: Record<string, string> = {
  "Measurement Guide": "bg-sky-100 text-sky-700",
  "Product Catalog":   "bg-indigo-100 text-indigo-700",
  "How-To Guide":      "bg-teal-100 text-teal-700",
  "Reference":         "bg-slate-100 text-slate-600",
};

/** Rows per POST to `/api/admin/resources/import` (server enforces MAX_RESOURCE_IMPORT_ROWS, default 500). */
const RESOURCE_IMPORT_CHUNK = 200;

// ── CSV (client parse — same pattern as admin-products-list) ─────────────────

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
        else if (ch === ",") { fields.push(cur); cur = ""; }
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

/** Keep in sync with `normalizeResourceRow` in `artifacts/api-server/src/routes/adminResources.ts`. */
function normalizeResourceImportRow(raw: Record<string, string>): Record<string, string> {
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().replace(/[\s\-_.]+/g, "");
    lc[key] = typeof v === "string" ? v.trim() : "";
  }
  function pick(...aliases: string[]): string {
    for (const a of aliases) {
      const v = lc[a];
      if (v !== undefined && v !== "") return v;
    }
    return "";
  }
  return {
    id: pick("id", "pk", "resourceid"),
    title: pick("title", "name", "label"),
    brand: pick("brand", "manufacturer", "make"),
    category: pick("category", "group", "section"),
    type: pick("type", "doctype", "documenttype", "resourcetype"),
    url: pick("url", "pdfurl", "link", "href", "path"),
    description: pick("description", "desc", "notes", "summary"),
    sortOrder: pick("sortorder", "sort_order", "order", "position", "seq"),
    isActive: pick("isactive", "active", "visible", "published", "enabled"),
  };
}

function resourceRowIsBlank(norm: Record<string, string>): boolean {
  return !norm.title && !norm.url && !norm.category && !norm.type && !norm.id;
}

function previewResourceRow(norm: Record<string, string>, line: number): string | null {
  if (resourceRowIsBlank(norm)) return null;
  const title = norm.title.trim();
  const category = norm.category.trim();
  const type = norm.type.trim();
  const url = norm.url.trim();
  if (title && category && type && url) return null;
  const miss: string[] = [];
  if (!title) miss.push("title");
  if (!category) miss.push("category");
  if (!type) miss.push("type");
  if (!url) miss.push("url");
  return `Line ${line}: missing ${miss.join(", ")}`;
}

// ── Form Dialog ───────────────────────────────────────────────────────────────

function ResourceForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: FormData;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const valid = form.title.trim() && form.category.trim() && form.type.trim() && form.url.trim();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800">{initial.title ? "Edit PDF Resource" : "Add PDF Resource"}</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <Input value={form.title} onChange={set("title")} placeholder="How To Measure — Casement Sash Frame" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
              <Input value={form.brand} onChange={set("brand")} placeholder="BiltBest" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select
                value={form.category}
                onChange={set("category")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={set("type")}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PDF URL *</label>
            <Input value={form.url} onChange={set("url")} placeholder="https://... or /api/storage/..." />
            <p className="text-xs text-muted-foreground mt-1">Can be an external URL or a path to a file hosted on this site</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <Textarea rows={3} value={form.description} onChange={set("description")} placeholder="Brief description of what this document contains…" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-slate-600">{form.isActive ? "Visible to visitors" : "Hidden from public"}</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!valid || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Resource
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminResourcesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PdfResource | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[] | null>(null);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkBlankCount, setBulkBlankCount] = useState(0);
  const [bulkRowWarnings, setBulkRowWarnings] = useState<string[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkLastResult, setBulkLastResult] = useState<{
    inserted: number; updated: number; errored: number; skipped: number;
    errors?: string[];
  } | null>(null);

  const { data, isLoading } = useQuery<{ resources: PdfResource[] }>({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-resources"] });
    qc.invalidateQueries({ queryKey: ["public-resources"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: FormData) => {
      const res = await fetch("/api/admin/resources", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setShowForm(false); toast({ title: "Resource added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<FormData> }) => {
      const res = await fetch(`/api/admin/resources/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditing(null); toast({ title: "Resource updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/resources/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setConfirmDelete(null); toast({ title: "Resource deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (r: PdfResource) =>
    updateMutation.mutate({ id: r.id, body: { isActive: !r.isActive } });

  const handleBulkExport = async () => {
    setBulkExporting(true);
    try {
      const res = await fetch("/api/admin/resources/export");
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "awdp-pdf-resources.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "awdp-pdf-resources.csv" });
    } catch (e: unknown) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBulkExporting(false);
    }
  };

  const handleBulkPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bulkFileRef.current) bulkFileRef.current.value = "";
    if (!file) return;

    setBulkLastResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No data rows found in the CSV", variant: "destructive" });
        setBulkRows(null);
        setBulkFileName("");
        setBulkBlankCount(0);
        setBulkRowWarnings([]);
        return;
      }
      let blank = 0;
      const warns: string[] = [];
      rows.forEach((raw, i) => {
        const norm = normalizeResourceImportRow(raw);
        const line = i + 2;
        if (resourceRowIsBlank(norm)) {
          blank++;
          return;
        }
        const w = previewResourceRow(norm, line);
        if (w && warns.length < 80) warns.push(w);
      });
      setBulkRows(rows);
      setBulkFileName(file.name);
      setBulkBlankCount(blank);
      setBulkRowWarnings(warns);
      toast({ title: "CSV loaded", description: `${rows.length} row(s) — review and click Apply import` });
    } catch (err: unknown) {
      toast({ title: "Could not read file", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleBulkApply = async () => {
    if (!bulkRows?.length) return;
    setBulkImporting(true);
    setBulkLastResult(null);
    try {
      const acc = { inserted: 0, updated: 0, errored: 0, skipped: 0 };
      const errAgg: string[] = [];
      const totalChunks = Math.ceil(bulkRows.length / RESOURCE_IMPORT_CHUNK);
      const longWait = 600_000;

      for (let c = 0; c < totalChunks; c++) {
        const slice = bulkRows.slice(c * RESOURCE_IMPORT_CHUNK, (c + 1) * RESOURCE_IMPORT_CHUNK);
        const res = await fetch("/api/admin/resources/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(longWait),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(result.error ?? `Import failed (batch ${c + 1}/${totalChunks})`);
        }
        acc.inserted += result.inserted ?? 0;
        acc.updated += result.updated ?? 0;
        acc.errored += result.errored ?? 0;
        acc.skipped += result.skipped ?? 0;
        if (Array.isArray(result.errors)) {
          for (const line of result.errors as string[]) {
            if (errAgg.length < 100) errAgg.push(line);
          }
        }
      }

      invalidate();
      setBulkLastResult({ ...acc, errors: errAgg.length ? errAgg : undefined });
      const parts = [
        acc.inserted && `${acc.inserted} added`,
        acc.updated && `${acc.updated} updated`,
        acc.skipped && `${acc.skipped} blank skipped`,
        acc.errored && `${acc.errored} errors`,
      ].filter(Boolean).join(" · ");
      toast({
        title: acc.errored > 0 ? "Import finished with errors" : "Import complete",
        description: [parts || "No changes", totalChunks > 1 ? `${totalChunks} batches` : ""].filter(Boolean).join(" — "),
        variant: acc.errored > 0 && !acc.inserted && !acc.updated ? "destructive" : "default",
      });
    } catch (e: unknown) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setBulkImporting(false);
    }
  };

  const clearBulkImport = () => {
    setBulkRows(null);
    setBulkFileName("");
    setBulkBlankCount(0);
    setBulkRowWarnings([]);
    setBulkLastResult(null);
  };

  const resources = data?.resources ?? [];
  const active = resources.filter((r) => r.isActive);
  const hidden = resources.filter((r) => !r.isActive);

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">PDF Resources</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {active.length} visible · {hidden.length} hidden · {resources.length} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/resources"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Page
          </a>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Resource
          </Button>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-5xl">
        {/* Bulk CSV import / export */}
        <div className="bg-white border rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Bulk CSV import
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Export matches import columns. Rows with an existing <code className="text-xs bg-slate-100 px-1 rounded">id</code> are updated; rows without a matching id are inserted.
              </p>
              <p className="text-xs text-muted-foreground font-mono bg-slate-50 border rounded px-2 py-1.5 mt-2 inline-block">
                id,title,brand,category,type,url,description,sortOrder,isActive
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleBulkExport}
                disabled={bulkExporting}
              >
                {bulkExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => bulkFileRef.current?.click()}
                disabled={bulkImporting}
              >
                <Upload className="w-3.5 h-3.5" />
                Choose CSV
              </Button>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleBulkPickFile}
              />
            </div>
          </div>

          {bulkRows && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-700">{bulkFileName}</span>
                <span className="text-muted-foreground">·</span>
                <span>{bulkRows.length} row(s) parsed</span>
                {bulkBlankCount > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-amber-700">{bulkBlankCount} blank (will skip)</span>
                  </>
                )}
                {bulkRowWarnings.length > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-red-600">{bulkRowWarnings.length} row issue(s) in preview</span>
                  </>
                )}
              </div>
              {bulkRowWarnings.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50/80 p-3 text-xs text-red-800 space-y-1">
                  {bulkRowWarnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                  {bulkRowWarnings.length >= 80 && (
                    <div className="text-red-600 font-medium pt-1">Showing first 80 preview issues…</div>
                  )}
                </div>
              )}
              {bulkLastResult && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-medium mb-1">Last import</p>
                  <p>
                    {bulkLastResult.inserted} added · {bulkLastResult.updated} updated ·{" "}
                    {bulkLastResult.skipped} skipped · {bulkLastResult.errored} errors
                  </p>
                  {bulkLastResult.errors && bulkLastResult.errors.length > 0 && (
                    <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-700 list-disc pl-4 space-y-0.5">
                      {bulkLastResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkApply}
                  disabled={bulkImporting}
                  title={`Sends up to ${RESOURCE_IMPORT_CHUNK} rows per request; server default max 500 rows per batch (override with MAX_RESOURCE_IMPORT_ROWS).`}
                >
                  {bulkImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                  Apply import
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={clearBulkImport} disabled={bulkImporting}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium mb-4">No PDF resources yet</p>
            <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add First Resource</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <div
                key={r.id}
                className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-opacity ${!r.isActive ? "opacity-60" : ""}`}
              >
                <GripVertical className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm leading-snug flex-1">{r.title}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[r.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full">{r.category}</span>
                    {r.brand && <span>{r.brand}</span>}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline truncate max-w-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {r.url.length > 50 ? r.url.slice(0, 50) + "…" : r.url}
                    </a>
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(r)}
                    className={`p-1.5 rounded-lg transition-colors ${r.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
                    title={r.isActive ? "Hide from public" : "Show to public"}
                  >
                    {r.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditing(r); setShowForm(true); }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(r.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <ResourceForm
          initial={editing ? { title: editing.title, brand: editing.brand, category: editing.category, type: editing.type, url: editing.url, description: editing.description, sortOrder: editing.sortOrder, isActive: editing.isActive } : EMPTY_FORM}
          onSave={(body) => {
            if (editing) updateMutation.mutate({ id: editing.id, body });
            else createMutation.mutate(body);
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Delete this resource?</p>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteMutation.isPending}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
