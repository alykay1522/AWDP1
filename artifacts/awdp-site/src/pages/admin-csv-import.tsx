import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, XCircle, ArrowRight, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface MatchResult {
  rowIndex: number;
  csvTitle: string;
  csvDescription: string;
  csvNotes: string;
  matchedSku: string | null;
  matchedName: string | null;
  matchScore: number;
  currentDescription: string | null;
  isGenericCurrent: boolean;
  willUpdateDescription: boolean;
  newDescription: string;
  orderingNotes: string;
}

interface PreviewResponse {
  mode: "preview";
  totalRows: number;
  matched: number;
  willUpdate: number;
  skipped: number;
  results: MatchResult[];
}

interface ApplyResponse {
  mode: "apply";
  totalRows: number;
  updated: number;
  skipped: number;
}

type Phase = "idle" | "previewing" | "preview-done" | "applying" | "applied" | "error";

export default function AdminCsvImport() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "will-update" | "no-match">("will-update");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const handleUpload = useCallback(async (file: File, mode: "preview" | "apply") => {
    setError(null);

    if (mode === "preview") setPhase("previewing");
    else setPhase("applying");

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`/api/admin/csv-import?mode=${mode}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      if (mode === "preview") {
        setPreview(data as PreviewResponse);
        setPhase("preview-done");
      } else {
        setApplyResult(data as ApplyResponse);
        setPhase("applied");
      }
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setPhase("error");
    }
  }, []);

  function pickFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".csv")) {
      setError("Please select a .csv file");
      return;
    }
    pendingFileRef.current = file;
    handleUpload(file, "preview");
  }

  function applyChanges() {
    if (!pendingFileRef.current) return;
    handleUpload(pendingFileRef.current, "apply");
  }

  function reset() {
    setPhase("idle");
    setPreview(null);
    setApplyResult(null);
    setError(null);
    pendingFileRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  }

  const filteredResults = preview?.results.filter((r) => {
    if (filterMode === "will-update") return r.willUpdateDescription;
    if (filterMode === "no-match") return !r.matchedSku;
    return true;
  }) ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">CSV Product Import</h1>
          <p className="text-slate-500 text-sm">
            Upload the scraped CSV to update product descriptions and ordering rules. All changes are previewed before applying.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "idle" && (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Start Over
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">← Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Expected CSV format info */}
      {phase === "idle" && (
        <div className="mb-6 bg-slate-50 border rounded-xl p-5">
          <p className="text-sm font-bold text-slate-700 mb-3">Expected CSV Columns</p>
          <div className="flex flex-wrap gap-2">
            {["product_title","source_site","product_url","description_clean","min_order_qty","sold_in_pairs","sold_in_packs","min_lineal_feet","unit_type","notes_raw_rules"].map((col) => (
              <code key={col} className="text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-600 font-mono">{col}</code>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Generate this file by running <code className="bg-white border px-1.5 py-0.5 rounded font-mono">python3 scrapers/scrape_products.py</code> from the workspace shell.
          </p>
        </div>
      )}

      {/* Drop zone */}
      {(phase === "idle" || phase === "error") && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors mb-8
            ${dragOver ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50 hover:border-primary hover:bg-primary/5"}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files);
          }}
        >
          <Upload className="w-10 h-10 text-slate-400 mb-4" />
          <p className="text-base font-bold text-slate-700 mb-1">Drop your CSV file here</p>
          <p className="text-sm text-slate-500">or click to browse — <strong>awdp_products_scraped.csv</strong></p>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 font-medium text-sm bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
              <XCircle className="w-4 h-4" /> {error}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => pickFile(e.target.files)}
          />
        </div>
      )}

      {/* Loading states */}
      {(phase === "previewing" || phase === "applying") && (
        <div className="border rounded-2xl p-12 flex flex-col items-center justify-center bg-white">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-bold text-slate-700">
            {phase === "previewing" ? "Analyzing CSV and matching to products…" : "Applying changes to database…"}
          </p>
          <p className="text-sm text-slate-400 mt-1">This may take a few seconds</p>
        </div>
      )}

      {/* Applied result */}
      {phase === "applied" && applyResult && (
        <div className="border rounded-2xl p-10 bg-white text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Import Complete</h2>
          <p className="text-slate-500 mb-8">Product descriptions and ordering rules have been updated in the database.</p>
          <div className="flex justify-center gap-6 mb-10">
            <div className="text-center">
              <p className="text-4xl font-bold text-emerald-600">{applyResult.updated}</p>
              <p className="text-sm text-slate-500">Products Updated</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-400">{applyResult.skipped}</p>
              <p className="text-sm text-slate-500">Rows Skipped</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-700">{applyResult.totalRows}</p>
              <p className="text-sm text-slate-500">Total Rows</p>
            </div>
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={reset}>Import Another CSV</Button>
            <Button asChild variant="outline">
              <Link href="/admin/products">View Products</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Preview results */}
      {phase === "preview-done" && preview && (
        <>
          {/* Summary bar */}
          <div className="border rounded-2xl bg-white p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-3xl font-bold text-slate-900">{preview.totalRows}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Total Rows</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-600">{preview.willUpdate}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Will Update</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-500">{preview.matched - preview.willUpdate}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Matched / No Change</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-400">{preview.skipped}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">No Match</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={reset}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Change File
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
                  disabled={preview.willUpdate === 0}
                  onClick={applyChanges}
                >
                  Apply {preview.willUpdate} Updates <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>

            {preview.willUpdate === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No rows found that would update a product with a generic description. Either all descriptions are already set, or no products matched.
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex gap-2 mt-2">
              {(["will-update", "all", "no-match"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterMode(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filterMode === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "will-update" ? `Will Update (${preview.willUpdate})` : f === "all" ? `All (${preview.totalRows})` : `No Match (${preview.skipped})`}
                </button>
              ))}
            </div>
          </div>

          {/* Results table */}
          <div className="border rounded-2xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-6">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">CSV Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Matched Product</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Match</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Action</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Ordering Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                        No rows match this filter
                      </td>
                    </tr>
                  )}
                  {filteredResults.map((r) => (
                    <tr key={r.rowIndex} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400 text-xs">{r.rowIndex + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 leading-tight">{r.csvTitle}</p>
                        {r.csvDescription && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{r.csvDescription.slice(0, 100)}…</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.matchedSku ? (
                          <div>
                            <p className="font-mono text-xs text-slate-500">{r.matchedSku}</p>
                            <p className="text-slate-700 text-xs leading-tight mt-0.5">{r.matchedName}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">No match</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.matchedSku ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            r.matchScore >= 60 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {r.matchScore}%
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!r.matchedSku ? (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <XCircle className="w-3.5 h-3.5" /> Skip
                          </span>
                        ) : r.willUpdateDescription ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Update desc
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <AlertCircle className="w-3.5 h-3.5" /> No change
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.orderingNotes ? (
                          <p className="text-xs text-slate-600">{r.orderingNotes}</p>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredResults.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t text-xs text-slate-400">
                Showing {filteredResults.length} of {preview.results.length} rows (preview capped at 200)
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
