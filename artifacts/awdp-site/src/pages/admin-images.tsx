import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon, Upload, Loader2, RefreshCw, Copy, Check, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ProductImage {
  id: number; filename: string; objectName: string; url: string; uploadedAt: string;
}

export default function AdminImages() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

        // Step 1: request a presigned upload URL
        const urlRes = await fetch("/api/admin/images/request-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to get upload URL");
        }
        const { uploadURL, objectName } = await urlRes.json();

        // Step 2: upload directly to GCS via the presigned URL
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error(`GCS upload failed for ${file.name}`);

        // Step 3: save image metadata to our DB
        const saveRes = await fetch("/api/admin/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, objectName }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to save image record");
        }

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

  const copyUrl = (img: ProductImage) => {
    navigator.clipboard.writeText(img.url).then(() => {
      setCopiedId(img.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "URL copied", description: `${img.filename} URL copied to clipboard` });
    });
  };

  const images = data?.images ?? [];

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Product Images</h1>
          <p className="text-slate-400 text-sm">
            {images.length} image{images.length !== 1 ? "s" : ""} · Upload then copy the URL into any product
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors select-none ${uploading ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Images
            </span>
          </label>
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress.length > 0 && (
        <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">Uploading…</p>
          {uploadProgress.map((msg, i) => (
            <p key={i} className="text-sm text-blue-700">{msg}</p>
          ))}
        </div>
      )}

      <div className="p-6 max-w-6xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-slate-700">No images yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Upload product images to use in your listings</p>
            <label className="cursor-pointer">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
                <Upload className="w-4 h-4" /> Upload Your First Image
              </span>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-slate-100 overflow-hidden relative">
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    onClick={() => deleteMutation.mutate(img.id)}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-slate-700 truncate" title={img.filename}>{img.filename}</p>
                  <button
                    onClick={() => copyUrl(img)}
                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1 rounded hover:bg-primary/5"
                  >
                    {copiedId === img.id
                      ? <><Check className="w-3 h-3 text-green-600" /> Copied!</>
                      : <><Copy className="w-3 h-3" /> Copy URL</>
                    }
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
