import { useState, useCallback, useRef } from "react";
import { useGetProducts, useUpdateProductImage } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Upload, Search, Loader2, ImageIcon, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ProductImage } from "@/components/product-image";

interface PendingImage {
  file: File;
  preview: string;
  autoMatchedSku: string | null;
  manualSku: string;
  status: "pending" | "uploading" | "saving" | "done" | "error";
  errorMsg?: string;
  savedUrl?: string;
}

function extractSkuFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, "");
  const match = base.match(/AWDP-[A-Z0-9]+-[A-Z0-9]+/i);
  return match ? match[0].toUpperCase() : null;
}

function SkuSelector({
  value,
  onChange,
  products,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  products: { sku: string; name: string }[];
  disabled: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const filtered = query.length > 0
    ? products.filter(
        (p) =>
          p.sku.toLowerCase().includes(query.toLowerCase()) ||
          p.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="relative">
      <div className="flex gap-2 items-center">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          className="flex-1 text-sm border-0 outline-none bg-transparent placeholder:text-muted-foreground"
          placeholder="Type SKU or product name…"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.sku}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
              onMouseDown={() => {
                onChange(p.sku);
                setQuery(p.sku);
                setOpen(false);
              }}
            >
              <span className="font-mono text-xs text-muted-foreground mr-2">{p.sku}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminImages() {
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allProducts, isLoading: productsLoading } = useGetProducts(
    { limit: 500 },
    { query: { staleTime: 5 * 60 * 1000 } }
  );
  const products = allProducts?.products ?? [];

  const { uploadFile } = useUpload({
    basePath: "/api/storage",
  });

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const newItems: PendingImage[] = arr.map((file) => {
        const autoMatchedSku = extractSkuFromFilename(file.name);
        return {
          file,
          preview: URL.createObjectURL(file),
          autoMatchedSku,
          manualSku: autoMatchedSku ?? "",
          status: "pending",
        };
      });
      setPending((prev) => [...prev, ...newItems]);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const updatePending = (idx: number, patch: Partial<PendingImage>) => {
    setPending((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const removePending = (idx: number) => {
    setPending((prev) => {
      const item = prev[idx];
      URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const saveImage = async (idx: number) => {
    const item = pending[idx];
    const sku = item.manualSku.trim();
    if (!sku) return;

    updatePending(idx, { status: "uploading" });

    try {
      const uploadResult = await uploadFile(item.file);
      if (!uploadResult?.objectPath) throw new Error("Upload failed — no objectPath returned");

      updatePending(idx, { status: "saving" });

      const res = await fetch(`/api/products/${encodeURIComponent(sku)}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath: uploadResult.objectPath }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      updatePending(idx, { status: "done", savedUrl: data.imageUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updatePending(idx, { status: "error", errorMsg: msg });
    }
  };

  const saveAll = async () => {
    const ready = pending
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.status === "pending" && item.manualSku.trim());

    for (const { idx } of ready) {
      await saveImage(idx);
    }
  };

  const pendingItems = pending.filter((p) => p.status !== "done");
  const completedItems = pending.filter((p) => p.status === "done");
  const readyCount = pendingItems.filter(
    (p) => p.status === "pending" && p.manualSku.trim()
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Product Image Upload</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload photos — filenames with a SKU (e.g. AWDP-10-1001.jpg) are matched automatically.
          </p>
        </div>
        <a href="/shop" className="text-sm text-muted-foreground hover:underline">Back to shop</a>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
            isDragging ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white hover:border-slate-400"
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <p className="font-semibold text-slate-700">Drop product photos here</p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse — JPG, PNG, WebP supported
          </p>
          <p className="text-xs text-muted-foreground mt-3 font-mono">
            Name files like <span className="bg-slate-100 px-1 rounded">AWDP-10-1001.jpg</span> for automatic matching
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Save All Button */}
        {pendingItems.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pendingItems.length} image{pendingItems.length !== 1 ? "s" : ""} to process
              {readyCount > 0 && ` — ${readyCount} ready to save`}
            </p>
            <Button onClick={saveAll} disabled={readyCount === 0}>
              Save {readyCount > 0 ? `${readyCount} Image${readyCount !== 1 ? "s" : ""}` : "All"}
            </Button>
          </div>
        )}

        {/* Pending Queue */}
        {pendingItems.length > 0 && (
          <div className="space-y-3">
            {pendingItems.map((item, idx) => {
              const realIdx = pending.indexOf(item);
              const isProcessing = item.status === "uploading" || item.status === "saving";
              const autoMatched = item.autoMatchedSku !== null;
              const hasProduct = products.some((p) => p.sku === item.manualSku);

              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border p-4 flex gap-4 items-start"
                >
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-20 h-20 object-cover rounded-lg shrink-0 border"
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{item.file.name}</span>
                      {autoMatched && (
                        <Badge variant="secondary" className="text-xs shrink-0">Auto-matched</Badge>
                      )}
                      {item.status === "error" && (
                        <Badge variant="destructive" className="text-xs shrink-0">Error</Badge>
                      )}
                    </div>

                    {item.status === "error" && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {item.errorMsg}
                      </p>
                    )}

                    <div className="border rounded-lg px-3 py-2">
                      {productsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <SkuSelector
                          value={item.manualSku}
                          onChange={(v) => updatePending(realIdx, { manualSku: v })}
                          products={products.map((p) => ({ sku: p.sku, name: p.name }))}
                          disabled={isProcessing}
                        />
                      )}
                    </div>

                    {item.manualSku && !hasProduct && (
                      <p className="text-xs text-amber-600">SKU not found in catalog</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isProcessing ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {item.status === "uploading" ? "Uploading…" : "Saving…"}
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => saveImage(realIdx)}
                          disabled={!item.manualSku.trim() || !hasProduct}
                        >
                          Save
                        </Button>
                        <button
                          onClick={() => removePending(realIdx)}
                          className="text-xs text-muted-foreground hover:text-red-500"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed */}
        {completedItems.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-slate-50"
              onClick={() => setShowCompleted((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {completedItems.length} image{completedItems.length !== 1 ? "s" : ""} saved successfully
              </span>
              {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCompleted && (
              <div className="divide-y">
                {completedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-5 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-sm font-mono text-muted-foreground">{item.manualSku}</span>
                    <span className="text-sm truncate flex-1">{item.file.name}</span>
                    {item.savedUrl && (
                      <img src={item.savedUrl} alt="" className="w-10 h-10 object-cover rounded border" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {pending.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No images selected yet — drop some above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
