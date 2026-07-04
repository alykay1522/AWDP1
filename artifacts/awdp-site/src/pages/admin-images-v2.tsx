import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  FileArchive,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AdminQueryError } from "@/components/admin/admin-error";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  buildZipImages,
  chooseImagesByFolder,
  formatBytes,
  linkProductImages,
  loadZipArchive,
  matchProducts,
  normalizeSku,
  parseCsv,
  pickRowValue,
  runWithConcurrency,
  uploadAdminImage,
  uploadZipImage,
  type ProductImageLink,
  type ProductMatch,
  type ZipImageEntry,
} from "@/lib/admin-upload-tools";

interface ProductImage {
  id: number;
  filename: string;
  objectName: string;
  url: string;
  uploadedAt: string;
}

interface StorageStatus {
  provider: "vercel-blob" | "legacy-gcs" | "unconfigured";
  directClientUploads: boolean;
  maximumImageBytes: number;
  maximumImageMegabytes: number;
  zipProcessing: string;
}

interface ZipAnalysis {
  archiveName: string;
  archiveBytes: number;
  imageFiles: number;
  folders: number;
  matched: number;
  unmatched: number;
  alreadyManaged: number;
  replaceableExternal: number;
  readyToUpload: number;
  sampleFolders: Array<{ folder: string; sku: string; filename: string; matched: boolean; existingImage: string | null }>;
}

interface ZipImportResult extends ZipAnalysis {
  uploaded: number;
  linked: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function isManagedImage(url: string | null): boolean {
  return Boolean(url && (url.includes(".blob.vercel-storage.com/") || url.startsWith("/api/admin/images/serve/")));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readImageUrl(row: Record<string, string>): string {
  return pickRowValue(row, [
    "imageUrl", "image url", "image", "url", "photoUrl", "photo url", "pictureUrl", "picture url",
  ]);
}

function readSku(row: Record<string, string>): string {
  return normalizeSku(pickRowValue(row, ["sku", "awdp sku", "part number", "part no", "item number", "item no"]));
}

async function inspectZip(file: File): Promise<{
  analysis: ZipAnalysis;
  selected: Array<{ folder: string; sku: string; image: ZipImageEntry; product: ProductMatch }>;
}> {
  const zip = await loadZipArchive(file);
  const images = buildZipImages(zip);
  if (images.length === 0) throw new Error("The ZIP does not contain supported image files.");

  const selectedByFolder = chooseImagesByFolder(images);
  if (selectedByFolder.size === 0) throw new Error("No product folders were found in the ZIP.");

  const candidates = [...selectedByFolder.entries()].map(([folder, image]) => ({
    folder,
    sku: normalizeSku(folder),
    image,
  }));
  const productMatches = await matchProducts(candidates.map((candidate) => candidate.sku));
  const selected = candidates
    .map((candidate) => {
      const product = productMatches.get(candidate.sku);
      return product ? { ...candidate, product } : null;
    })
    .filter((candidate): candidate is { folder: string; sku: string; image: ZipImageEntry; product: ProductMatch } => candidate !== null);

  const alreadyManaged = selected.filter((item) => isManagedImage(item.product.imageUrl)).length;
  const replaceableExternal = selected.filter((item) => item.product.imageUrl && !isManagedImage(item.product.imageUrl)).length;
  const analysis: ZipAnalysis = {
    archiveName: file.name,
    archiveBytes: file.size,
    imageFiles: images.length,
    folders: selectedByFolder.size,
    matched: selected.length,
    unmatched: candidates.length - selected.length,
    alreadyManaged,
    replaceableExternal,
    readyToUpload: selected.length - alreadyManaged,
    sampleFolders: candidates.slice(0, 12).map((candidate) => ({
      folder: candidate.folder,
      sku: candidate.sku,
      filename: candidate.image.basename,
      matched: productMatches.has(candidate.sku),
      existingImage: productMatches.get(candidate.sku)?.imageUrl ?? null,
    })),
  };

  return { analysis, selected };
}

export default function AdminImagesV2() {
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const analyzeInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [manualBusy, setManualBusy] = useState(false);
  const [manualProgress, setManualProgress] = useState<string[]>([]);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipStage, setZipStage] = useState("");
  const [zipResult, setZipResult] = useState<ZipImportResult | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ZipAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<{ totalRows: number; updated: number; notFound: number; failed: number } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const imagesQuery = useQuery<{ images: ProductImage[] }>({
    queryKey: ["admin-images"],
    queryFn: async () => {
      const response = await fetch("/api/admin/images", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load images");
      return response.json();
    },
  });

  const storageQuery = useQuery<StorageStatus>({
    queryKey: ["admin-image-storage-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/images/storage-status", { credentials: "include" });
      if (!response.ok) throw new Error("Unable to read storage status");
      return response.json();
    },
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/images/${id}`, { credentials: "include", method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      setPendingDeleteId(null);
      toast({ title: "Image deleted" });
    },
    onError: (error: Error) => toast({ title: "Delete failed", description: error.message, variant: "destructive" }),
  });

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (files.length === 0) return;

    setManualBusy(true);
    setManualProgress(files.map((file) => `${file.name}: queued`));
    try {
      const results = await runWithConcurrency(files, 3, async (file, index) => {
        setManualProgress((current) => current.map((line, lineIndex) => lineIndex === index ? `${file.name}: uploading 0%` : line));
        const result = await uploadAdminImage(file, file.name, {
          onProgress: (percentage) => {
            setManualProgress((current) => current.map((line, lineIndex) => lineIndex === index ? `${file.name}: uploading ${percentage}%` : line));
          },
        });
        setManualProgress((current) => current.map((line, lineIndex) => lineIndex === index ? `${file.name}: complete` : line));
        return result;
      });
      const failed = results.filter((result) => result.status === "rejected");
      const succeeded = results.length - failed.length;
      await queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      toast({
        title: `${succeeded} image${succeeded === 1 ? "" : "s"} uploaded`,
        description: failed.length ? `${failed.length} failed. Open the progress list for details.` : undefined,
        variant: failed.length ? "destructive" : "default",
      });
      if (failed.length) {
        setManualProgress((current) => current.map((line, index) => {
          const result = results[index];
          return result.status === "rejected" ? `${files[index].name}: ${errorMessage(result.reason)}` : line;
        }));
      }
    } catch (error) {
      toast({ title: "Upload failed", description: errorMessage(error), variant: "destructive" });
    } finally {
      setManualBusy(false);
    }
  };

  const handleAnalyzeZip = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (analyzeInputRef.current) analyzeInputRef.current.value = "";
    if (!file) return;

    setAnalyzing(true);
    setAnalysis(null);
    try {
      const inspected = await inspectZip(file);
      setAnalysis(inspected.analysis);
    } catch (error) {
      toast({ title: "ZIP analysis failed", description: errorMessage(error), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (zipInputRef.current) zipInputRef.current.value = "";
    if (!file) return;

    setZipBusy(true);
    setZipResult(null);
    setZipError(null);
    setZipStage("Opening and validating ZIP in your browser…");
    try {
      const inspected = await inspectZip(file);
      setAnalysis(inspected.analysis);
      const queue = inspected.selected.filter((item) => forceOverwrite || !isManagedImage(item.product.imageUrl));
      const skipped = inspected.selected.length - queue.length;
      let completed = 0;
      setZipStage(`Uploading ${queue.length} matched images directly to storage…`);

      const uploadResults = await runWithConcurrency(queue, 3, async (item) => {
        const blob = await uploadZipImage(item.sku, item.image);
        completed++;
        setZipStage(`Uploaded ${completed} of ${queue.length} matched images…`);
        return { sku: item.sku, imageUrl: blob.url } satisfies ProductImageLink;
      });

      const links: ProductImageLink[] = [];
      const errors: string[] = [];
      uploadResults.forEach((result, index) => {
        if (result.status === "fulfilled") links.push(result.value);
        else errors.push(`${queue[index].sku}: ${errorMessage(result.reason)}`);
      });

      setZipStage(`Linking ${links.length} uploaded images to products…`);
      const linked = links.length ? await linkProductImages(links) : { updated: 0, notFound: 0, errors: [] as string[] };
      errors.push(...linked.errors);
      const finalResult: ZipImportResult = {
        ...inspected.analysis,
        readyToUpload: queue.length,
        uploaded: links.length,
        linked: linked.updated,
        skipped,
        failed: uploadResults.length - links.length + linked.errors.length,
        errors: errors.slice(0, 30),
      };
      setZipResult(finalResult);
      setZipStage("Import complete");
      await queryClient.invalidateQueries({ queryKey: ["admin-images"] });
      toast({
        title: "ZIP image import complete",
        description: `${finalResult.linked} product images linked; ${finalResult.failed} failed.`,
        variant: finalResult.failed ? "destructive" : "default",
      });
    } catch (error) {
      const message = errorMessage(error);
      setZipError(message);
      setZipStage("Import failed");
      toast({ title: "ZIP import failed", description: message, variant: "destructive" });
    } finally {
      setZipBusy(false);
    }
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (!file) return;

    setCsvBusy(true);
    setCsvResult(null);
    setCsvError(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("CSV files must be 5 MB or smaller.");
      const rows = parseCsv(await file.text());
      const links = rows
        .map((row) => ({ sku: readSku(row), imageUrl: readImageUrl(row).trim() }))
        .filter((link) => link.sku && /^https:\/\//i.test(link.imageUrl));
      if (links.length === 0) throw new Error("No valid SKU and HTTPS image URL rows were found.");
      const result = await linkProductImages(links);
      setCsvResult({ totalRows: rows.length, updated: result.updated, notFound: result.notFound, failed: result.errors.length });
      toast({ title: "Image URL CSV imported", description: `${result.updated} products updated.` });
    } catch (error) {
      const message = errorMessage(error);
      setCsvError(message);
      toast({ title: "CSV import failed", description: message, variant: "destructive" });
    } finally {
      setCsvBusy(false);
    }
  };

  const copyUrl = async (image: ProductImage) => {
    await navigator.clipboard.writeText(image.url);
    setCopiedId(image.id);
    window.setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Image URL copied" });
  };

  if (imagesQuery.isError) {
    return <div className="p-8"><AdminQueryError error={imagesQuery.error} onRetry={imagesQuery.refetch} /></div>;
  }

  const images = imagesQuery.data?.images ?? [];
  const storageReady = storageQuery.data?.directClientUploads ?? false;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-6 py-6 text-white">
        <div>
          <h1 className="text-xl font-bold">Product Images</h1>
          <p className="text-sm text-slate-400">{images.length} image{images.length === 1 ? "" : "s"} in the library</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" onClick={() => imagesQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <label className={manualBusy || !storageReady ? "pointer-events-none opacity-60" : "cursor-pointer"}>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="hidden" onChange={handleManualUpload} disabled={manualBusy || !storageReady} />
            <span className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90">
              {manualBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Images
            </span>
          </label>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        {!storageQuery.isLoading && !storageReady && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Direct image storage is not configured</p>
                <p className="mt-1 text-sm">Connect a Vercel Blob store to this project so <code>BLOB_READ_WRITE_TOKEN</code> is available, then redeploy.</p>
              </div>
            </div>
          </div>
        )}

        {storageReady && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Direct browser uploads are active. Each image may be up to {storageQuery.data?.maximumImageMegabytes ?? 50} MB; ZIP files are opened locally and never sent through the API request body.
          </div>
        )}

        {manualProgress.length > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Upload progress</h2>
            <div className="max-h-48 space-y-1 overflow-auto font-mono text-xs text-slate-600">
              {manualProgress.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-1 flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-slate-800">Bulk import images from ZIP</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Put product images in folders named by supplier part number or AWDP SKU. The ZIP is validated and opened in your browser, then matched images upload directly to Blob storage.
            </p>
            <label className="mb-4 flex cursor-pointer items-center gap-2 select-none">
              <input type="checkbox" checked={forceOverwrite} onChange={(event) => setForceOverwrite(event.target.checked)} className="h-4 w-4 accent-blue-600" />
              <span className="text-sm text-slate-700">Replace images already managed by this site</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={zipBusy || !storageReady ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handleZipUpload} disabled={zipBusy || !storageReady} />
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 py-2.5 text-sm font-medium text-blue-700 hover:border-blue-400 hover:bg-blue-50">
                  {zipBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {zipBusy ? "Importing ZIP…" : "Choose ZIP and Import"}
                </span>
              </label>
              <label className={analyzing ? "pointer-events-none opacity-60" : "cursor-pointer"}>
                <input ref={analyzeInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handleAnalyzeZip} disabled={analyzing} />
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Analyze ZIP Only
                </span>
              </label>
            </div>
            {zipStage && <p className="mt-3 text-sm text-slate-600">{zipStage}</p>}
            {zipError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{zipError}</div>}
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              <h2 className="font-bold text-slate-800">Import image URL CSV</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">CSV columns: <code>sku,imageUrl</code>. The file is parsed locally and sent as small JSON batches.</p>
            <label className={csvBusy ? "pointer-events-none opacity-60" : "cursor-pointer"}>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} disabled={csvBusy} />
              <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50">
                {csvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Choose CSV
              </span>
            </label>
            {csvResult && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {csvResult.updated} updated, {csvResult.notFound} not found, {csvResult.failed} failed.
              </div>
            )}
            {csvError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{csvError}</div>}
          </section>
        </div>

        {analysis && (
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold">ZIP analysis: {analysis.archiveName}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["ZIP size", formatBytes(analysis.archiveBytes)],
                ["Image files", analysis.imageFiles],
                ["Product folders", analysis.folders],
                ["DB matches", analysis.matched],
                ["Unmatched", analysis.unmatched],
                ["Ready", forceOverwrite ? analysis.matched : analysis.readyToUpload],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-2">Folder</th><th>SKU</th><th>Selected image</th><th>Status</th></tr></thead>
                <tbody>
                  {analysis.sampleFolders.map((row) => (
                    <tr key={`${row.folder}-${row.filename}`} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{row.folder}</td>
                      <td className="font-mono text-xs">{row.sku}</td>
                      <td>{row.filename}</td>
                      <td>{row.matched ? (isManagedImage(row.existingImage) ? "Already managed" : "Ready") : "No product match"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {zipResult && (
          <section className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-950">
            <div className="mb-3 flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" /> Import complete</div>
            <div className="grid gap-2 sm:grid-cols-4 text-sm">
              <div><span className="text-green-700">Uploaded:</span> <strong>{zipResult.uploaded}</strong></div>
              <div><span className="text-green-700">Linked:</span> <strong>{zipResult.linked}</strong></div>
              <div><span className="text-green-700">Skipped:</span> <strong>{zipResult.skipped}</strong></div>
              <div><span className="text-green-700">Failed:</span> <strong>{zipResult.failed}</strong></div>
            </div>
            {zipResult.errors.length > 0 && <div className="mt-3 max-h-40 overflow-auto rounded bg-white/70 p-3 font-mono text-xs">{zipResult.errors.map((error) => <div key={error}>{error}</div>)}</div>}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><ImageIcon className="h-5 w-5" /> Image library</h2>
            {imagesQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          {images.length === 0 && !imagesQuery.isLoading ? (
            <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">No uploaded product images yet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((image) => (
                <article key={image.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                  <div className="flex aspect-square items-center justify-center bg-slate-100 p-3">
                    <img src={image.url} alt={image.filename} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium" title={image.filename}>{image.filename}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={image.objectName}>{image.objectName}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => copyUrl(image)}>
                        {copiedId === image.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} URL
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPendingDeleteId(image.id)} aria-label={`Delete ${image.filename}`}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>This removes the image from storage and the image library. Product records that already reference its URL are not automatically changed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete image"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
