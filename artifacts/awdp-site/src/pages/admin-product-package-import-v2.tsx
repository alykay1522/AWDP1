import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  PackageCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { parseApiResponseBody, readApiErrorMessage } from "@/lib/api-response";
import {
  buildZipImages,
  findImageForRow,
  formatBytes,
  linkProductImages,
  loadZipArchive,
  matchProducts,
  normalizeSku,
  parseCsv,
  prepareProductRow,
  rawSkuFromRow,
  runWithConcurrency,
  uploadZipImage,
  type CsvRow,
  type ProductImageLink,
  type ZipImageEntry,
} from "@/lib/admin-upload-tools";

const PRODUCT_IMPORT_CHUNK = 40;
const IMAGE_UPLOAD_CONCURRENCY = 3;

interface ImportTotals {
  inserted: number;
  updated: number;
  errored: number;
  skipped: number;
  needsPricing: number;
}

interface PackageResult extends ImportTotals {
  archiveName: string;
  archiveBytes: number;
  csvFile: string;
  productRows: number;
  imagesInZip: number;
  imagesMatched: number;
  imagesUploaded: number;
  imagesLinked: number;
  imagesSkippedExisting: number;
  imagesFailed: number;
  productsWithoutMatchedImage: number;
  errors: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isManagedImage(url: string | null): boolean {
  if (!url) return false;
  if (url.startsWith("/api/admin/images/serve/")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function readJsonOrThrow(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const parsed = await parseApiResponseBody(response);
  if (!response.ok || !parsed.json) throw new Error(readApiErrorMessage(response, parsed, fallback));
  return parsed.json as Record<string, unknown>;
}

async function assertImageStorageReady(): Promise<void> {
  const response = await fetch("/api/admin/images/storage-status", { credentials: "include" });
  const status = await readJsonOrThrow(response, "Unable to check image storage configuration");
  if (!status.directClientUploads) {
    throw new Error("Image storage is not configured. Connect a Vercel Blob store so BLOB_READ_WRITE_TOKEN is available, redeploy, and retry the package import.");
  }
}

function downloadTemplate() {
  const csv = [
    "sku,name,description,price,originalPrice,category,supplier,inStock,imageFile,tags,compatibleBrands,specifications",
    '10-452SS,"Sample Patio Door Roller","Replace with product details",24.95,29.95,"Patio Door Parts",Strybuc,true,images/10-452SS/main.jpg,"roller;patio door","Andersen;Pella","{\"wheelDiameter\":\"1-1/4 in\"}"',
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "products-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function matchRowsToImages(rows: CsvRow[], images: ZipImageEntry[]) {
  const matches = new Map<string, ZipImageEntry>();
  for (const row of rows) {
    const sku = normalizeSku(rawSkuFromRow(row));
    if (!sku || matches.has(sku)) continue;
    const image = findImageForRow(row, images);
    if (image) matches.set(sku, image);
  }
  return [...matches.entries()].map(([sku, image]) => ({ sku, image }));
}

export default function AdminProductPackageImportV2() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [result, setResult] = useState<PackageResult | null>(null);

  const handlePackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);
    setStage("Opening and validating ZIP in your browser…");

    const errors: string[] = [];
    const totals: ImportTotals = { inserted: 0, updated: 0, errored: 0, skipped: 0, needsPricing: 0 };
    let csvName = "";
    let rowCount = 0;
    let imageCount = 0;

    try {
      const zip = await loadZipArchive(file);
      const csvFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv"));
      if (csvFiles.length === 0) throw new Error("The ZIP must contain a CSV product file.");

      const csvFile = csvFiles.find((entry) => /(^|\/)(products?|catalog)\.csv$/i.test(entry.name)) ?? csvFiles[0];
      csvName = csvFile.name;
      const rows = parseCsv(await csvFile.async("text"));
      if (rows.length === 0) throw new Error(`${csvFile.name} does not contain product rows.`);

      const rowsWithSku = rows.filter((row) => rawSkuFromRow(row));
      rowCount = rowsWithSku.length;
      if (rowsWithSku.length === 0) throw new Error("No SKU or part-number column was found in the CSV.");

      const images = buildZipImages(zip);
      imageCount = images.length;
      const imageMatches = matchRowsToImages(rowsWithSku, images);
      if (imageMatches.length > 0) {
        setStage("Checking image storage configuration before changing products…");
        await assertImageStorageReady();
      }

      const preparedRows = rowsWithSku.map(prepareProductRow);
      const totalChunks = Math.ceil(preparedRows.length / PRODUCT_IMPORT_CHUNK);

      setStage(`Importing ${preparedRows.length} product rows in ${totalChunks} small batches…`);
      for (let index = 0; index < totalChunks; index++) {
        const slice = preparedRows.slice(index * PRODUCT_IMPORT_CHUNK, (index + 1) * PRODUCT_IMPORT_CHUNK);
        const response = await fetch("/api/admin/products/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(120_000),
        });
        const data = await readJsonOrThrow(response, `Product import failed in batch ${index + 1}`);
        totals.inserted += Number(data.inserted ?? 0);
        totals.updated += Number(data.updated ?? 0);
        totals.errored += Number(data.errored ?? 0);
        totals.skipped += Number(data.skipped ?? 0);
        totals.needsPricing += Number(data.needsPricing ?? 0);
        if (Array.isArray(data.errors)) errors.push(...data.errors.map(String));
        setProgress(Math.round(((index + 1) / totalChunks) * 35));
      }

      const existing = await matchProducts(imageMatches.map((match) => match.sku));
      const queue = imageMatches.filter((match) => forceOverwrite || !isManagedImage(existing.get(match.sku)?.imageUrl ?? null));
      const imagesSkippedExisting = imageMatches.length - queue.length;
      let completed = 0;
      setStage(`Uploading ${queue.length} matched images directly to Vercel Blob…`);

      const uploadResults = await runWithConcurrency(queue, IMAGE_UPLOAD_CONCURRENCY, async (item) => {
        const blob = await uploadZipImage(item.sku, item.image);
        completed++;
        setProgress(35 + Math.round((completed / Math.max(1, queue.length)) * 55));
        setStage(`Uploaded ${completed} of ${queue.length} matched images…`);
        return { sku: item.sku, imageUrl: blob.url } satisfies ProductImageLink;
      });

      const links: ProductImageLink[] = [];
      uploadResults.forEach((uploadResult, index) => {
        if (uploadResult.status === "fulfilled") links.push(uploadResult.value);
        else errors.push(`${queue[index].sku}: ${errorMessage(uploadResult.reason)}`);
      });

      setStage(`Linking ${links.length} images to imported products…`);
      const linked = links.length ? await linkProductImages(links) : { updated: 0, notFound: 0, errors: [] as string[] };
      if (linked.notFound) errors.push(`${linked.notFound} uploaded image link(s) did not match a product SKU.`);
      errors.push(...linked.errors);

      const packageResult: PackageResult = {
        ...totals,
        archiveName: file.name,
        archiveBytes: file.size,
        csvFile: csvName,
        productRows: rowsWithSku.length,
        imagesInZip: images.length,
        imagesMatched: imageMatches.length,
        imagesUploaded: links.length,
        imagesLinked: linked.updated,
        imagesSkippedExisting,
        imagesFailed: uploadResults.length - links.length + linked.errors.length,
        productsWithoutMatchedImage: Math.max(0, rowsWithSku.length - imageMatches.length),
        errors: errors.slice(0, 40),
      };
      setResult(packageResult);
      setProgress(100);
      setStage("Import complete");
      toast({
        title: "Product package imported",
        description: `${totals.inserted} added, ${totals.updated} updated, ${linked.updated} images linked.`,
        variant: packageResult.imagesFailed || totals.errored ? "destructive" : "default",
      });
    } catch (error) {
      const message = errorMessage(error);
      setStage("Import failed");
      setResult({
        ...totals,
        archiveName: file.name,
        archiveBytes: file.size,
        csvFile: csvName,
        productRows: rowCount,
        imagesInZip: imageCount,
        imagesMatched: 0,
        imagesUploaded: 0,
        imagesLinked: 0,
        imagesSkippedExisting: 0,
        imagesFailed: 0,
        productsWithoutMatchedImage: rowCount,
        errors: [message, ...errors].slice(0, 40),
      });
      toast({ title: "Package import failed", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-slate-900 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">Import Products + Images</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-300">
          Import a CSV and matching product images from one ZIP. The archive is opened locally, products are sent in small JSON batches, and image bytes upload directly to Blob storage.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <div className="flex items-start gap-3">
            <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Designed to avoid Request Entity Too Large errors</p>
              <p className="mt-1">The ZIP itself is never posted to the Express/Vercel API. Only small product and image-link batches use API requests.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <FileSpreadsheet className="mb-3 h-7 w-7 text-emerald-600" />
            <h2 className="font-semibold">1. Add the product CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">Name it <code>products.csv</code> or <code>catalog.csv</code>. Existing AWDP SKUs update instead of duplicating.</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <ImageIcon className="mb-3 h-7 w-7 text-blue-600" />
            <h2 className="font-semibold">2. Add product images</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use an <code>imageFile</code> CSV column, or put each image in a folder named by supplier part number.</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <FileArchive className="mb-3 h-7 w-7 text-violet-600" />
            <h2 className="font-semibold">3. ZIP the package</h2>
            <p className="mt-1 text-sm text-muted-foreground">Avoid password-protected archives. Large or highly compressed archives are validated before extraction.</p>
          </div>
        </div>

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Choose product package</h2>
              <p className="mt-1 text-sm text-muted-foreground">Supported images: JPEG, PNG, WebP, GIF, and AVIF. Maximum 50 MB per image.</p>
            </div>
            <Button variant="outline" onClick={downloadTemplate} disabled={importing}>
              <Download className="mr-2 h-4 w-4" /> Download CSV template
            </Button>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-2 select-none">
            <input type="checkbox" checked={forceOverwrite} onChange={(event) => setForceOverwrite(event.target.checked)} disabled={importing} className="h-4 w-4 accent-blue-600" />
            <span className="text-sm text-slate-700">Replace product images already managed by this site</span>
          </label>

          <label className={importing ? "mt-5 block pointer-events-none opacity-60" : "mt-5 block cursor-pointer"}>
            <input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handlePackage} disabled={importing} />
            <span className="flex min-h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-blue-400 hover:bg-blue-50">
              {importing ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-600" /> : <Upload className="mb-2 h-8 w-8 text-blue-600" />}
              <span className="font-semibold">{importing ? stage : "Choose a ZIP package"}</span>
              <span className="mt-1 text-xs text-slate-500">The archive stays in this browser while its contents are processed.</span>
            </span>
          </label>

          {(importing || progress > 0) && (
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm"><span>{stage}</span><span className="font-mono">{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </section>

        {result && (
          <section className={`rounded-xl border p-5 shadow-sm ${result.errors.length ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
            <div className="mb-4 flex items-start gap-3">
              {result.errors.length ? <AlertCircle className="mt-0.5 h-6 w-6 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-6 w-6 text-green-700" />}
              <div>
                <h2 className="font-bold">{stage === "Import complete" ? "Package processing complete" : "Package processing stopped"}</h2>
                <p className="mt-1 text-sm text-slate-700">{result.archiveName} ({formatBytes(result.archiveBytes)}) · CSV: {result.csvFile || "not read"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Product rows", result.productRows],
                ["Added", result.inserted],
                ["Updated", result.updated],
                ["Images found", result.imagesInZip],
                ["Images matched", result.imagesMatched],
                ["Images uploaded", result.imagesUploaded],
                ["Images linked", result.imagesLinked],
                ["Existing skipped", result.imagesSkippedExisting],
                ["No image match", result.productsWithoutMatchedImage],
                ["Failures", result.imagesFailed + result.errored],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-white/80 p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4 max-h-60 overflow-auto rounded-lg border border-amber-200 bg-white/80 p-3">
                <p className="mb-2 text-sm font-semibold text-amber-900">Details</p>
                <div className="space-y-1 font-mono text-xs text-amber-950">
                  {result.errors.map((error, index) => <div key={`${error}-${index}`}>{error}</div>)}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
