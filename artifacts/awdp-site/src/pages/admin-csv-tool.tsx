import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Upload, FileSpreadsheet, ArrowRight, Download, Loader2, CheckCircle2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  parseCsv,
  scoreImportFlows,
  suggestCatalogMapping,
  suggestDescriptionMapping,
  suggestResourceMapping,
  buildMappedRows,
  buildDescriptionRowsForApi,
  rowsToCsv,
  CATALOG_EXPORT_KEYS,
  DESCRIPTION_CANONICAL,
  RESOURCE_EXPORT_KEYS,
  catalogTemplateCsv,
  descriptionTemplateCsv,
  resourceTemplateCsv,
  triggerDownload,
  PRODUCT_IMPORT_CHUNK,
  RESOURCE_IMPORT_CHUNK,
  type CatalogExportKey,
  type DescriptionKey,
  type ResourceExportKey,
  type FlowId,
} from "@/lib/admin-csv-tool";

const PREVIEW_ROWS = 12;

const FLOW_META: Record<
  FlowId,
  { label: string; blurb: string; href: string; hrefLabel: string }
> = {
  catalog: {
    label: "Catalog (products)",
    blurb: "Upsert SKUs, prices, stock via POST /api/admin/products/import — same as Products → Import CSV.",
    href: "/admin/products",
    hrefLabel: "Products list",
  },
  description: {
    label: "Description matcher",
    blurb: "Match scraped titles to catalog SKUs and refresh descriptions — POST /api/admin/csv-import.",
    href: "/admin/csv-import",
    hrefLabel: "Dedicated description page",
  },
  resources: {
    label: "PDF resources",
    blurb: "Bulk upsert resource rows — POST /api/admin/resources/import (same as Resources admin).",
    href: "/admin/resources",
    hrefLabel: "Resources admin",
  },
};

function flowLabel(id: FlowId): string {
  return FLOW_META[id].label;
}

export default function AdminCsvTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [activeFlow, setActiveFlow] = useState<FlowId>("catalog");
  const [catalogMap, setCatalogMap] = useState<Record<CatalogExportKey, string>>(
    () => suggestCatalogMapping([]),
  );
  const [descMap, setDescMap] = useState<Record<DescriptionKey, string>>(
    () => suggestDescriptionMapping([]),
  );
  const [resMap, setResMap] = useState<Record<ResourceExportKey, string>>(
    () => suggestResourceMapping([]),
  );
  const [busy, setBusy] = useState<"catalog" | "resources" | "desc-preview" | "desc-apply" | null>(null);

  const headers = useMemo(() => {
    if (rawRows.length === 0) return [] as string[];
    return Object.keys(rawRows[0]);
  }, [rawRows]);

  const flowScores = useMemo(() => scoreImportFlows(headers), [headers]);

  const ingestText = useCallback((text: string, name: string) => {
    const rows = parseCsv(text);
    setFileName(name);
    setRawRows(rows);
    if (rows.length === 0) {
      toast({ title: "No data", description: "Could not parse rows from this file.", variant: "destructive" });
      setCatalogMap(suggestCatalogMapping([]));
      setDescMap(suggestDescriptionMapping([]));
      setResMap(suggestResourceMapping([]));
      return;
    }
    const hdrs = Object.keys(rows[0]);
    setCatalogMap(suggestCatalogMapping(hdrs));
    setDescMap(suggestDescriptionMapping(hdrs));
    setResMap(suggestResourceMapping(hdrs));
    const ranked = scoreImportFlows(hdrs);
    if (ranked[0].score >= 0.2) setActiveFlow(ranked[0].flow);
    else setActiveFlow("catalog");
  }, []);

  const pickFile = useCallback(
    (list: FileList | null) => {
      const f = list?.[0];
      if (!f) return;
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast({ title: "Not a CSV", description: "Please choose a .csv file.", variant: "destructive" });
        return;
      }
      void f.text().then((t) => ingestText(t, f.name));
    },
    [ingestText],
  );

  const reset = useCallback(() => {
    setFileName(null);
    setRawRows([]);
    setCatalogMap(suggestCatalogMapping([]));
    setDescMap(suggestDescriptionMapping([]));
    setResMap(suggestResourceMapping([]));
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const previewSlice = useMemo(() => rawRows.slice(0, PREVIEW_ROWS), [rawRows]);

  const runCatalogImport = useCallback(async () => {
    if (rawRows.length === 0) return;
    const mapped = buildMappedRows(rawRows, catalogMap, CATALOG_EXPORT_KEYS);
    const hasSku = mapped.some((r) => r.sku.trim() !== "");
    if (!hasSku) {
      toast({ title: "Map SKU", description: "Map at least one column to sku before importing.", variant: "destructive" });
      return;
    }
    setBusy("catalog");
    const acc = { inserted: 0, updated: 0, errored: 0, skipped: 0, needsPricing: 0 };
    const errSamples: string[] = [];
    const totalChunks = Math.ceil(mapped.length / PRODUCT_IMPORT_CHUNK);
    const longWait = 600_000;
    try {
      for (let c = 0; c < totalChunks; c++) {
        const slice = mapped.slice(c * PRODUCT_IMPORT_CHUNK, (c + 1) * PRODUCT_IMPORT_CHUNK);
        const res = await fetch("/api/admin/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(longWait),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error ?? `Import failed (batch ${c + 1}/${totalChunks})`);
        acc.inserted += result.inserted ?? 0;
        acc.updated += result.updated ?? 0;
        acc.errored += result.errored ?? 0;
        acc.skipped += result.skipped ?? 0;
        acc.needsPricing += result.needsPricing ?? 0;
        if (Array.isArray(result.errors)) {
          for (const line of result.errors as string[]) {
            if (errSamples.length < 8) errSamples.push(line);
          }
        }
      }
      const parts = [
        acc.inserted && `${acc.inserted} added`,
        acc.updated && `${acc.updated} updated`,
        acc.needsPricing && `${acc.needsPricing} need pricing`,
        acc.skipped && `${acc.skipped} skipped`,
        acc.errored && `${acc.errored} errors`,
      ].filter(Boolean).join(" · ");
      toast({
        title: acc.errored > 0 ? "Import finished with errors" : "Catalog import complete",
        description: [parts || "No changes", totalChunks > 1 ? `${totalChunks} batches` : "", errSamples.join("; ")].filter(Boolean).join(" — "),
        variant: acc.errored > 0 && !acc.inserted && !acc.updated ? "destructive" : "default",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [rawRows, catalogMap]);

  const runResourcesImport = useCallback(async () => {
    if (rawRows.length === 0) return;
    const mapped = buildMappedRows(rawRows, resMap, RESOURCE_EXPORT_KEYS);
    setBusy("resources");
    const longWait = 120_000;
    try {
      const totalChunks = Math.ceil(mapped.length / RESOURCE_IMPORT_CHUNK);
      for (let c = 0; c < totalChunks; c++) {
        const slice = mapped.slice(c * RESOURCE_IMPORT_CHUNK, (c + 1) * RESOURCE_IMPORT_CHUNK);
        const res = await fetch("/api/admin/resources/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(longWait),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error ?? `Resources import failed (batch ${c + 1}/${totalChunks})`);
      }
      toast({
        title: "Resources import sent",
        description: `${mapped.length} row(s) in ${totalChunks} batch(es). Check Resources admin for any server messages.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast({ title: "Resources import failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }, [rawRows, resMap]);

  const postDescription = useCallback(
    async (mode: "preview" | "apply") => {
      if (rawRows.length === 0) return;
      const mapped = buildDescriptionRowsForApi(rawRows, descMap);
      if (!mapped.some((r) => (r.product_title ?? "").trim())) {
        toast({
          title: "Map product title",
          description: "Map a column to product_title (required for description matching).",
          variant: "destructive",
        });
        return;
      }
      setBusy(mode === "preview" ? "desc-preview" : "desc-apply");
      const csv = rowsToCsv(DESCRIPTION_CANONICAL, mapped);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const fd = new FormData();
      const mappedName = `${(fileName ?? "upload").replace(/\.csv$/i, "")}-mapped.csv`;
      fd.append("file", blob, mappedName);
      try {
        const res = await fetch(`/api/admin/csv-import?mode=${mode}`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        if (mode === "preview") {
          toast({
            title: "Preview ready",
            description: `Rows ${data.totalRows ?? "?"}, matched ${data.matched ?? "?"}, will update ${data.willUpdate ?? "?"}. Open the dedicated page for the full table, or apply below.`,
          });
        } else {
          toast({
            title: "Description updates applied",
            description: `Updated ${data.updated ?? 0} product(s).`,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed";
        toast({ title: mode === "preview" ? "Preview failed" : "Apply failed", description: msg, variant: "destructive" });
      } finally {
        setBusy(null);
      }
    },
    [rawRows, descMap, fileName],
  );

  const mapSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="— none —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— none —</SelectItem>
          {headers.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">CSV tool</h1>
          <p className="text-slate-500 text-sm max-w-2xl">
            Upload any <code className="text-xs bg-slate-100 px-1 rounded">.csv</code> — preview headers and rows,
            auto-detect which import flow fits best, map columns when needed, then run the same APIs as the rest of admin.
            Existing import pages are unchanged; use the links below if you prefer the original workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fileName && (
            <Button variant="outline" size="sm" onClick={reset}>
              Clear file
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">← Dashboard</Link>
          </Button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors mb-8
          ${dragOver ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files);
        }}
      >
        <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-3" />
        <p className="text-base font-bold text-slate-700 mb-1">Upload any CSV — preview below</p>
        <p className="text-sm text-slate-500">Drop a file here or click to browse</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => pickFile(e.target.files)}
        />
      </div>

      {fileName && rawRows.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-800">{fileName}</span>
            <span className="text-slate-400">·</span>
            <span>{rawRows.length.toLocaleString()} data rows</span>
            <span className="text-slate-400">·</span>
            <span>{headers.length} columns</span>
          </div>

          <div className="mb-8 rounded-xl border bg-white p-5">
            <p className="text-sm font-bold text-slate-800 mb-3">Suggested flow (header match)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {flowScores.map((s) => (
                <button
                  key={s.flow}
                  type="button"
                  onClick={() => setActiveFlow(s.flow)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    activeFlow === s.flow ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-semibold text-slate-900">{flowLabel(s.flow)}</p>
                  <p className="text-xs text-slate-500 mt-1 mb-2">{s.detail}</p>
                  <p className="text-xs font-medium text-primary">
                    Score {Math.round(s.score * 100)}%
                    <ArrowRight className="inline w-3 h-3 ml-0.5" />
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Scores are heuristics only. Pick the flow that matches your file, then adjust column mappings.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap gap-2">
            {(Object.keys(FLOW_META) as FlowId[]).map((id) => (
              <Button
                key={id}
                size="sm"
                variant={activeFlow === id ? "default" : "outline"}
                onClick={() => setActiveFlow(id)}
              >
                {FLOW_META[id].label}
              </Button>
            ))}
          </div>

          <div className="mb-8 rounded-xl border overflow-hidden bg-white">
            <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">Preview (first {PREVIEW_ROWS} rows)</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {headers.map((h) => (
                  <code key={h} className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                    {h}
                  </code>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="text-left font-semibold text-slate-700 px-3 py-2 border-b whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewSlice.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80">
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={row[h]}>
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {activeFlow === "catalog" && (
            <section className="mb-10 rounded-xl border bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Catalog import</h2>
                  <p className="text-sm text-slate-500 mt-1">{FLOW_META.catalog.blurb}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => triggerDownload("awdp-catalog-template.csv", catalogTemplateCsv())}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Blank template
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href="/api/admin/products/export" download>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Live export
                    </a>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href={FLOW_META.catalog.href}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      {FLOW_META.catalog.hrefLabel}
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Map your CSV columns to catalog fields. Rows are sent as{" "}
                <code className="bg-slate-100 px-1 rounded">sku, name, price, …</code> to match export keys (server also accepts many raw aliases if you skip mapping).
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {CATALOG_EXPORT_KEYS.map((key) =>
                  mapSelect(key, catalogMap[key], (v) => setCatalogMap((m) => ({ ...m, [key]: v }))),
                )}
              </div>
              <Button onClick={() => void runCatalogImport()} disabled={busy === "catalog"}>
                {busy === "catalog" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import catalog ({rawRows.length.toLocaleString()} rows, chunked)
              </Button>
            </section>
          )}

          {activeFlow === "description" && (
            <section className="mb-10 rounded-xl border bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Description matcher</h2>
                  <p className="text-sm text-slate-500 mt-1">{FLOW_META.description.blurb}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => triggerDownload("awdp-description-template.csv", descriptionTemplateCsv())}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Blank template
                  </Button>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href={FLOW_META.description.href}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      {FLOW_META.description.hrefLabel}
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                After mapping, this tool builds a CSV with canonical headers and calls the same preview/apply API.{" "}
                <code className="bg-slate-100 px-1 rounded">product_title</code> is required for matching.
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {DESCRIPTION_CANONICAL.map((key) =>
                  mapSelect(key.replace(/_/g, " "), descMap[key], (v) => setDescMap((m) => ({ ...m, [key]: v }))),
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void postDescription("preview")} disabled={!!busy}>
                  {busy === "desc-preview" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Preview (API)
                </Button>
                <Button onClick={() => void postDescription("apply")} disabled={!!busy}>
                  {busy === "desc-apply" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Apply updates
                </Button>
              </div>
            </section>
          )}

          {activeFlow === "resources" && (
            <section className="mb-10 rounded-xl border bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">PDF resources import</h2>
                  <p className="text-sm text-slate-500 mt-1">{FLOW_META.resources.blurb}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => triggerDownload("awdp-resources-template.csv", resourceTemplateCsv())}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Blank template
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href="/api/admin/resources/export" download>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Live export
                    </a>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link href={FLOW_META.resources.href}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      {FLOW_META.resources.hrefLabel}
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Required for new rows: title, category, type, url. Rows with <code className="bg-slate-100 px-1 rounded">id</code> update existing resources.
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {RESOURCE_EXPORT_KEYS.map((key) =>
                  mapSelect(key, resMap[key], (v) => setResMap((m) => ({ ...m, [key]: v }))),
                )}
              </div>
              <Button onClick={() => void runResourcesImport()} disabled={busy === "resources"}>
                {busy === "resources" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import resources ({rawRows.length.toLocaleString()} rows, chunked)
              </Button>
            </section>
          )}
        </>
      )}

      {rawRows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800 mb-2">Existing CSV entry points (unchanged)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Catalog</strong> — <code className="text-xs bg-white border rounded px-1">POST /api/admin/products/import</code> with JSON{" "}
              <code className="text-xs bg-white border rounded px-1">{"{ rows }"}</code>; flexible column aliases on the server. Export columns: sku, name,
              description, price, originalPrice, category, supplier, inStock, imageUrl, tags, compatibleBrands, specifications (plus cost in imports).
            </li>
            <li>
              <strong>Descriptions</strong> — <code className="text-xs bg-white border rounded px-1">POST /api/admin/csv-import</code> multipart file; typical
              headers: product_title, description_clean, min_order_qty, sold_in_pairs, sold_in_packs, min_lineal_feet, unit_type, notes_raw_rules, source_site,
              product_url.
            </li>
            <li>
              <strong>Resources</strong> — <code className="text-xs bg-white border rounded px-1">POST /api/admin/resources/import</code> with{" "}
              <code className="text-xs bg-white border rounded px-1">{"{ rows }"}</code>; columns id, title, brand, category, type, url, description, sortOrder,
              isActive (aliases supported server-side).
            </li>
            <li>
              <strong>Bulk editor</strong> — no CSV upload; grid actions on selected products only.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
