import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, FileText, ExternalLink, Loader2,
  Eye, EyeOff, GripVertical, Check, X, AlertCircle,
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

  const { data, isLoading } = useQuery<{ resources: PdfResource[] }>({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources", { credentials: "include" });
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
      const res = await fetch("/api/admin/resources", { credentials: "include",
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
      const res = await fetch(`/api/admin/resources/${id}`, { credentials: "include",
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
      const res = await fetch(`/api/admin/resources/${id}`, { credentials: "include", method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => { invalidate(); setConfirmDelete(null); toast({ title: "Resource deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (r: PdfResource) =>
    updateMutation.mutate({ id: r.id, body: { isActive: !r.isActive } });

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
