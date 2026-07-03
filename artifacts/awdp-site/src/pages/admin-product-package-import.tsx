import { useRef, useState } from "react";
import JSZip, { type JSZipObject } from "jszip";
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

type CsvRow = Record<string, string>;

type ImportTotals = {
  inserted: number;
  updated: number;
  errored: number;
  skipped: number;
  needsPricing: number;
};

type PackageResult = ImportTotals & {
  csvFile: string;
  productRows: number;
  imagesInZip: number;
  imagesMatched: number;
  imagesUploaded: number;
  imagesLinked: number;
  imagesFailed: number;
  productsWithoutMatchedImage: number;
  errors: string[];
};

type ImageEntry = {
  path: string;
  basename: string;
  parent: string;
  stem: string;
  zipObject: JSZipObject;
};

const PRODUCT_IMPORT_CHUNK = 40;
const IMAGE_UPLOAD_CONCURRENCY = 3;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const LOCAL_IMAGE_COLUMN_KEYS = new Set([
  "image",
  "imagefile",
  "imagepath",
  "imageurl",
  "imagelink",
  "photo",
  "photourl",
  "picture",
  "pictureurl",
  "thumbnail",
  "thumbnailurl",
  "img",
  "imgurl",
  "productimage",
  "productphoto",
  "productimageurl",
  "mainimage",
  "primaryimage",
]);

function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"' && normalized[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const result: CsvRow = {};
    headers.forEach((header, index) => {
      result[header] = values[index] ?? "";
    });
    return result;
  });
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[\s\-_.]+/g, "");
}

function archiveToken(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/^awdp[-_ ]*/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeArchivePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase();
}

function pickRowValue(row: CsvRow, aliases: string[]): string {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [compactKey(key), value]));
  for (const alias of aliases) {
    const value = lookup.get(compactKey(alias));
    if (value?.trim()) return value.trim();
  }
  return "";
}

function rawSkuFromRow(row: CsvRow): string {
  return pickRowValue(row, [
    "sku",
    "awdp sku",
    "part number",
    "part no",
    "part num",
    "item number",
    "item no",
    "catalog number",
    "catalog no",
    "code",
    "id",
    "number",
    "part",
    "item",
  ]);
}

function toAwDpSku(rawSku: string): string {
  const clean = rawSku.trim().toUpperCase();
  return clean.startsWith("AWDP-") ? clean : `AWDP-${clean}`;
}

function localImageReference(row: CsvRow): string {
  for (const [key, value] of Object.entries(row)) {
    if (!LOCAL_IMAGE_COLUMN_KEYS.has(compactKey(key))) continue;
    const trimmed = value.trim();
    if (!trimmed || /^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/api/")) continue;
    return trimmed;
  }
  return "";
}

function prepareRowForImport(row: CsvRow): CsvRow {
  const prepared = { ...row };
  const rawSku = rawSkuFromRow(row);
  if (rawSku) prepared.sku = toAwDpSku(rawSku);

  for (const key of Object.keys(prepared)) {
    if (!LOCAL_IMAGE_COLUMN_KEYS.has(compactKey(key))) continue;
    const value = prepared[key]?.trim() ?? "";
    if (value && !/^(https?:)?\/\//i.test(value) && !value.startsWith("/api/")) {
      prepared[key] = "";
    }
  }
  return prepared;
}

function contentTypeFor(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }[extension ?? ""] ?? "application/octet-stream";
}

function imageRank(entry: ImageEntry): number {
  const lower = entry.basename.toLowerCase();
  let score = 0;
  if (/thumb|thumbnail|small|_sm|-sm|icon/.test(lower)) score += 100;
  const extension = lower.split(".").pop();
  if (extension === "jpg" || extension === "jpeg") score += 0;
  else if (extension === "webp") score += 1;
  else if (extension === "png") score += 2;
  else score += 3;
  return score * 10_000 + lower.length;
}

function buildImageEntries(zip: JSZip): ImageEntry[] {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => {
      const path = entry.name.replace(/\\/g, "/");
      const segments = path.split("/");
      const basename = segments.pop() ?? path;
      const extension = basename.split(".").pop()?.toLowerCase() ?? "";
      if (!IMAGE_EXTENSIONS.has(extension)) return null;
      const parent = segments.pop() ?? "";
      return {
        path,
        basename,
        parent,
        stem: basename.replace(/\.[^.]+$/, ""),
        zipObject: entry,
      };
    })
    .filter((entry): entry is ImageEntry => entry !== null);
}

function findImageForRow(row: CsvRow, images: ImageEntry[]): ImageEntry | null {
  const rawSku = rawSkuFromRow(row);
  if (!rawSku) return null;
  const awdpSku = toAwDpSku(rawSku);
  const explicit = localImageReference(row);

  if (explicit) {
    const explicitPath = normalizeArchivePath(explicit);
    const exactPath = images.find((image) => normalizeArchivePath(image.path) === explicitPath);
    if (exactPath) return exactPath;

    const explicitBase = explicitPath.split("/").pop();
    const exactBase = images.find((image) => image.basename.toLowerCase() === explicitBase);
    if (exactBase) return exactBase;
  }

  const skuTokens = new Set([archiveToken(rawSku), archiveToken(awdpSku)].filter(Boolean));
  const candidates = images.filter((image) => {
    const parentToken = archiveToken(image.parent);
    const stemToken = archiveToken(image.stem);
    return skuTokens.has(parentToken) || skuTokens.has(stemToken);
  });

  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => imageRank(a) - imageRank(b))[0];
}

async function readJsonOrThrow(response: Response, fallback: string): Promise<Record<string, any>> {
  const parsed = await parseApiResponseBody(response);
  if (!response.ok) throw new Error(readApiErrorMessage(response, parsed, fallback));
  if (!parsed.json) throw new Error(readApiErrorMessage(response, parsed, fallback));
  return parsed.json as Record<string, any>;
}

async function uploadImage(sku: string, image: ImageEntry): Promise<string> {
  const safeName = `${sku}-${image.basename}`.replace(/[^a-zA-Z0-9._-]/g, "-");
  const contentType = contentTypeFor(image.basename);
  const requestResponse = await fetch("/api/admin/images/request-upload", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: safeName, contentType }),
  });
  const requestData = await readJsonOrThrow(requestResponse, `Unable to prepare upload for ${sku}`);

  const blob = await image.zipObject.async("blob");
  const putResponse = await fetch(String(requestData.uploadURL), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putResponse.ok) throw new Error(`Storage upload failed for ${sku} (${putResponse.status})`);

  const saveResponse = await fetch("/api/admin/images", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: image.basename, objectName: requestData.objectName }),
  });
  const saveData = await readJsonOrThrow(saveResponse, `Unable to save image record for ${sku}`);
  const url = saveData.image?.url;
  if (!url) throw new Error(`Image record for ${sku} did not return a URL`);
  return String(url);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return results;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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

export default function AdminProductPackageImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PackageResult | null>(null);

  const handlePackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(0);
    setStage("Opening ZIP package…");

    const errors: string[] = [];
    const totals: ImportTotals = { inserted: 0, updated: 0, errored: 0, skipped: 0, needsPricing: 0 };

    try {
      const zip = await JSZip.loadAsync(file);
      const csvFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".csv"));
      if (csvFiles.length === 0) throw new Error("The ZIP must contain a CSV product file.");

      const csvFile =
        csvFiles.find((entry) => /(^|\/)(products?|catalog)\.csv$/i.test(entry.name)) ?? csvFiles[0];
      const rows = parseCsv(await csvFile.async("text"));
      if (rows.length === 0) throw new Error(`${csvFile.name} does not contain any product rows.`);

      const rowsWithSku = rows.filter((row) => rawSkuFromRow(row));
      if (rowsWithSku.length === 0) throw new Error("No SKU or part-number column was found in the CSV.");

      const images = buildImageEntries(zip);
      setStage(`Importing ${rowsWithSku.length} product rows…`);

      const preparedRows = rowsWithSku.map(prepareRowForImport);
      const totalChunks = Math.ceil(preparedRows.length / PRODUCT_IMPORT_CHUNK);
      for (let index = 0; index < totalChunks; index++) {
        const slice = preparedRows.slice(index * PRODUCT_IMPORT_CHUNK, (index + 1) * PRODUCT_IMPORT_CHUNK);
        const response = await fetch("/api/admin/products/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: slice }),
          signal: AbortSignal.timeout(600_000),
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

      const matchBySku = new Map<string, ImageEntry>();
      for (const row of rowsWithSku) {
        const rawSku = rawSkuFromRow(row);
        const sku = toAwDpSku(rawSku);
        const image = findImageForRow(row, images);
        if (image && !matchBySku.has(sku)) matchBySku.set(sku, image);
      }

      const matched = [...matchBySku.entries()].map(([sku, image]) => ({ sku, image }));
      let uploadedCount = 0;
      setStage(`Uploading ${matched.length} matched product images…`);

      const uploadResults = await runWithConcurrency(matched, IMAGE_UPLOAD_CONCURRENCY, async (item) => {
        const imageUrl = await uploadImage(item.sku, item.image);
        uploadedCount++;
        setProgress(35 + Math.round((uploadedCount / Math.max(1, matched.length)) * 55));
        return { sku: item.sku, imageUrl };
      });

      const successfulLinks: { sku: string; imageUrl: string }[] = [];
      uploadResults.forEach((uploadResult, index) => {
        if (uploadResult.status === "fulfilled") {
          successfulLinks.push(uploadResult.value);
        } else {
          const message = uploadResult.reason instanceof Error ? uploadResult.reason.message : String(uploadResult.reason);
          errors.push(`${matched[index].sku}: ${message}`);
        }
      });

      let imagesLinked = 0;
      if (successfulLinks.length > 0) {
        setStage("Linking uploaded images to products…");
        const linkCsv = [
          "sku,imageUrl",
          ...successfulLinks.map((item) => `${csvEscape(item.sku)},${csvEscape(item.imageUrl)}`),
        ].join("\r\n");
        const form = new FormData();
        form.append("file", new Blob([linkCsv], { type: "text/csv" }), "product-image-links.csv");
        const response = await fetch("/api/admin/products/import-image-urls", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const data = await readJsonOrThrow(response, "Uploaded images could not be linked to products");
        imagesLinked = Number(data.updated ?? 0);
        if (Number(data.notFound ?? 0) > 0) errors.push(`${data.notFound} uploaded image link(s) did not match a product SKU.`);
      }

      const packageResult: PackageResult = {
        ...totals,
        csvFile: csvFile.name,
        productRows: rowsWithSku.length,
        imagesInZip: images.length,
        imagesMatched: matched.length,
        imagesUploaded: successfulLinks.length,
        imagesLinked,
        imagesFailed: matched.length - successfulLinks.length,
        productsWithoutMatchedImage: Math.max(0, rowsWithSku.length - matched.length),
        errors: errors.slice(0, 25),
      };
      setResult(packageResult);
      setProgress(100);
      setStage("Import complete");
      toast({
        title: "Product package imported",
        description: `${totals.inserted} added, ${totals.updated} updated, ${imagesLinked} images linked.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStage("Import failed");
      toast({ title: "Package import failed", description: message, variant: "destructive" });
      setResult({
        ...totals,
        csvFile: "",
        productRows: 0,
        imagesInZip: 0,
        imagesMatched: 0,
        imagesUploaded: 0,
        imagesLinked: 0,
        imagesFailed: 0,
        productsWithoutMatchedImage: 0,
        errors: [message, ...errors].slice(0, 25),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="bg-slate-900 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">Import Products + Images</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-300">
          Upload one ZIP containing a product CSV and the matching product images. Products are upserted by AWDP SKU, then images are uploaded directly to storage and linked automatically.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <FileSpreadsheet className="mb-3 h-7 w-7 text-emerald-600" />
            <h2 className="font-semibold">1. Add the CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Name it <code>products.csv</code> or <code>catalog.csv</code>. Existing SKUs update instead of creating duplicates.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <ImageIcon className="mb-3 h-7 w-7 text-blue-600" />
            <h2 className="font-semibold">2. Add product images</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use an <code>imageFile</code> column, or place each image in a folder named with its supplier part number or AWDP SKU.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <FileArchive className="mb-3 h-7 w-7 text-violet-600" />
            <h2 className="font-semibold">3. Zip and upload</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the ZIP once. The browser handles product batches and direct image uploads automatically.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Product package</h2>
              <p className="text-sm text-muted-foreground">Accepted file type: ZIP</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate} disabled={importing}>
                <Download className="mr-2 h-4 w-4" /> Download CSV Template
              </Button>
              <Button type="button" onClick={() => inputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {importing ? "Importing…" : "Choose Product ZIP"}
              </Button>
              <input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={handlePackage} />
            </div>
          </div>

          <div className="mt-5 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-700">{stage}</span>
              <span className="font-mono text-slate-500">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">Recommended ZIP structure</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-200">{`product-import.zip
├── products.csv
└── images/
    ├── 10-452SS/
    │   └── main.jpg
    ├── AWDP-35-1234/
    │   └── product.webp
    └── 16-123.png`}</pre>
          <p className="mt-3 text-sm text-muted-foreground">
            The importer also accepts a direct path in the CSV, such as <code>images/10-452SS/main.jpg</code> in the <code>imageFile</code> column.
          </p>
        </div>

        {result && (
          <div className={`rounded-xl border bg-white p-6 shadow-sm ${result.errors.length ? "border-amber-300" : "border-emerald-300"}`}>
            <div className="flex items-center gap-2">
              {result.errors.length ? <AlertCircle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              <h2 className="text-lg font-bold">Import results</h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ResultCard label="Products added" value={result.inserted} />
              <ResultCard label="Products updated" value={result.updated} />
              <ResultCard label="Need pricing" value={result.needsPricing} />
              <ResultCard label="Product errors" value={result.errored} />
              <ResultCard label="Images in ZIP" value={result.imagesInZip} />
              <ResultCard label="Images matched" value={result.imagesMatched} />
              <ResultCard label="Images linked" value={result.imagesLinked} />
              <ResultCard label="Image failures" value={result.imagesFailed} />
            </div>

            {result.productsWithoutMatchedImage > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {result.productsWithoutMatchedImage} product row(s) did not have a matching image in the ZIP. The products were still imported.
              </div>
            )}

            {result.errors.length > 0 && (
              <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-amber-900">View import warnings and errors</summary>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {result.errors.map((error, index) => <li key={`${error}-${index}`}>• {error}</li>)}
                </ul>
              </details>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { window.location.href = "/admin/products"; }}>
                <PackageCheck className="mr-2 h-4 w-4" /> View Products
              </Button>
              <Button type="button" variant="outline" onClick={() => { window.location.href = "/admin/images"; }}>
                <ImageIcon className="mr-2 h-4 w-4" /> View Images
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
