import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Upload, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface UploadedImage {
  url: string; filename: string; uploadedAt: string; size?: number;
}

export default function AdminImages() {
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ images: UploadedImage[] }>({
    queryKey: ["admin-images"],
    queryFn: async () => {
      const res = await fetch("/api/admin/images");
      if (!res.ok) return { images: [] };
      return res.json();
    },
  });

  const images = data?.images ?? [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/admin/images/upload", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      }
      toast({ title: `${files.length} image(s) uploaded` });
      refetch();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Product Images</h1>
          <p className="text-slate-400 text-sm">Upload and manage product images</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Images
            </span>
          </label>
        </div>
      </div>

      <div className="p-6 max-w-6xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">No images uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Upload Images" to add product images</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.url} className="group bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-slate-100 overflow-hidden">
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-slate-700 truncate">{img.filename}</p>
                  <button onClick={() => copyUrl(img.url)}
                    className="mt-1.5 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 rounded hover:bg-slate-50">
                    {copiedUrl === img.url ? <><Check className="w-3 h-3 text-green-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy URL</>}
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
