import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon, Upload, Loader2, RefreshCw, Copy, Check, Trash2,
  FileArchive, FileText, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ProductImage {
  id: number; filename: string; objectName: string; url: string; uploadedAt: string;
}

interface ZipResult {
  foldersInZip: number;
  foldersWithNoImage: number;
  candidateSkus: number;
  dbMatched: number;
  alreadyHadImage: number;
  uploaded: number;
  failed: number;
  skipped: number;
  errors: string[];
  sampleEntries: string[];
  sampleFolders: string[];
  sampleFolderFiles: Record<string, string[]>;
}

interface CsvResult {
  totalRows: number;
  updated: number;
  notFound: number;
}

export default function AdminImages() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [zipUploading, setZipUploading] = useState(false);
  const [zipResult, setZipResult] = useState<ZipResult | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [forceOverwrite, setForceOverwrite] = useState(false);

  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ images: ProductImage[] }>({
    queryKey: ["admin-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/images");
      if (!res.ok) throw new Error("Failed to load images");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!confirm("Delete this image? This cannot be undone.")) throw new Error("cancelled");
      const res = await fetch(`/api/admin/images/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-images"] }); toast({ title: "Image deleted" }); },
    onError: (e: Error) => { if (e.message !== "cancelled") toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress([]);
    const msgs: string[] = [];
    try {
      for (const file of Array.from(files)) {
        msgs.push(`Uploading ${file.name}…`);
        setUploadProgress([...msgs]);
        const urlRes = await fetch("/api/admin/images/request-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "Failed to get upload URL");
        const { uploadURL, objectName } = await urlRes.json();
        const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!putRes.ok) throw new Error(`GCS upload failed for ${file.name}`);
        const saveRes = await fetch("/api/admin/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, objectName }),
        });
        if (!saveRes.ok) throw new Error((await saveRes.json().catch(() => ({}))).error ?? "Failed to save image record");
        msgs[msgs.length - 1] = `${file.name} — done`;
        setUploadProgress([...msgs]);
      }
      toast({ title: `${files.length} image(s) uploaded successfully` });
      qc.invalidateQueries({ queryKey: ["admin-images"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipUploading(true);
    setZipResult(null);
    setZipError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const url = `/api/admin/products/upload-images-zip${forceOverwrite ? "?forceOverwrite=true" : ""}`;
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setZipResult(data);
      toast({ title: `ZIP imported: ${data.uploaded} images updated` });
    } catch (err: any) {
      setZipError(err.message);
      toast({ title: "ZIP import failed", description: err.message, variant: "destructive" });
    } finally {
      setZipUploading(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    setCsvResult(null);
    setCsvError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/products/import-image-urls", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setCsvResult(data);
      toast({ title: `CSV imported: ${data.updated} products updated` });
    } catch (err: any) {
      setCsvError(err.message);
      toast({ title: "CSV import failed", description: err.message, variant: "destructive" });
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const copyUrl = (img: ProductImage) => {
    navigator.clipboard.writeText(img.url).then(() => {
      setCopiedId(img.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "URL copied" });
    });
  };

  const images = data?.images ?? [];

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Product Images</h1>
          <p className="text-slate-400 text-sm">
            {images.length} image{images.length !== 1 ? "s" : ""} in library
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <label className="cursor-pointer">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors select-none ${uploading ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Images
            </span>
          </label>
        </div>
      </div>

      {/* Bulk Import Tools */}
      <div className="px-6 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">

        {/* ZIP Upload */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileArchive className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-800">Bulk Import from ZIP</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Upload a ZIP where each <strong>subfolder is named by part number</strong> (e.g. <code>10-452SS</code>). Images are matched to products automatically and uploaded to the catalog.
          </p>
          <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
            <input type="checkbox" checked={forceOverwrite} onChange={(e) => setForceOverwrite(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-slate-700">Force overwrite existing images</span>
          </label>
          <label className="cursor-pointer block">
            <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} disabled={zipUploading} />
            <span className={`inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium border-2 border-dashed transition-colors select-none ${zipUploading ? "opacity-60 cursor-not-allowed border-slate-200 text-slate-400" : "cursor-pointer border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"}`}>
              {zipUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing ZIP…</> : <><FileArchive className="w-4 h-4" /> Choose ZIP File</>}
            </span>
          </label>

          {zipResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-green-800 mb-2">
                <CheckCircle2 className="w-4 h-4" /> Import Complete
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-700">
                <span>Folders in ZIP:</span><span className="font-mono font-bold">{zipResult.foldersInZip}</span>
                <span>Matched to products:</span><span className="font-mono font-bold">{zipResult.dbMatched}</span>
                <span>Already had image:</span><span className="font-mono font-bold">{zipResult.alreadyHadImage}</span>
                <span>Images uploaded:</span><span className="font-mono font-bold text-green-800">{zipResult.uploaded}</span>
                {zipResult.failed > 0 && <><span className="text-red-600">Failed:</span><span className="font-mono font-bold text-red-600">{zipResult.failed}</span></>}
              </div>
              {zipResult.sampleFolders?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-xs font-semibold text-green-700 mb-1">Sample folder names detected:</p>
                  <div className="text-xs text-green-600 font-mono space-y-0.5">
                    {zipResult.sampleFolders.map((f, i) => <div key={i}>{f}</div>)}
                  </div>
                </div>
              )}
              {zipResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 space-y-0.5">
                  {zipResult.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
          {zipError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {zipError}
            </div>
          )}
        </div>

        {/* CSV URL Import */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-slate-800">Import Image URLs (CSV)</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            Upload a CSV with <strong>sku</strong> and <strong>imageUrl</strong> columns to bulk-set image URLs on products.
          </p>
          <p className="text-xs text-muted-foreground mb-4 font-mono bg-slate-50 border rounded px-2 py-1">
            sku,imageUrl<br />
            AWDP-XX-YY,https://example.com/img.jpg
          </p>
          <label className="cursor-pointer block">
            <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} disabled={csvUploading} />
            <span className={`inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium border-2 border-dashed transition-colors select-none ${csvUploading ? "opacity-60 cursor-not-allowed border-slate-200 text-slate-400" : "cursor-pointer border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"}`}>
              {csvUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><FileText className="w-4 h-4" /> Choose CSV File</>}
            </span>
          </label>

          {csvResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-green-800 mb-2">
                <CheckCircle2 className="w-4 h-4" /> Import Complete
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-green-700">
                <span>Rows in CSV:</span><span className="font-mono font-bold">{csvResult.totalRows}</span>
                <span>Products updated:</span><span className="font-mono font-bold text-green-800">{csvResult.updated}</span>
                {csvResult.notFound > 0 && <><span className="text-amber-600">SKUs not found:</span><span className="font-mono font-bold text-amber-600">{csvResult.notFound}</span></>}
              </div>
            </div>
          )}
          {csvError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {csvError}
            </div>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress.length > 0 && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-4xl">
          <p className="text-sm font-semibold text-blue-800 mb-2">Uploading…</p>
          {uploadProgress.map((msg, i) => <p key={i} className="text-sm text-blue-700">{msg}</p>)}
        </div>
      )}

      {/* Image Gallery */}
      <div className="p-6 max-w-6xl">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Image Library</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-slate-700">No images yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Use the tools above to import product images</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-slate-100 overflow-hidden relative">
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button onClick={() => deleteMutation.mutate(img.id)} className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-slate-700 truncate" title={img.filename}>{img.filename}</p>
                  <button onClick={() => copyUrl(img)} className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1 rounded hover:bg-primary/5">
                    {copiedId === img.id ? <><Check className="w-3 h-3 text-green-600" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy URL</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
