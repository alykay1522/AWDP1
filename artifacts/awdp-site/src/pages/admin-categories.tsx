import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Plus, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Category {
  id: number; name: string; slug: string;
  description: string | null; imageUrl: string | null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminCategories() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery<{ categories: Category[] }>({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Name is required");
      const slug = slugify(newName);
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), slug, description: newDesc.trim() }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setNewName(""); setNewDesc(""); setAdding(false);
      toast({ title: "Category created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, slug: editSlug, description: editDesc }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditingId(null);
      toast({ title: "Category updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!confirm("Delete this category?")) throw new Error("cancelled");
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); toast({ title: "Category deleted" }); },
    onError: (e: Error) => { if (e.message !== "cancelled") toast({ title: "Error", description: e.message, variant: "destructive" }); },
  });

  const startEdit = (c: Category) => {
    setEditingId(c.id); setEditName(c.name); setEditSlug(c.slug); setEditDesc(c.description ?? "");
  };

  const categories = data?.categories ?? [];

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Categories</h1>
          <p className="text-slate-400 text-sm">{categories.length} categories</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      <div className="p-6 max-w-3xl space-y-4">
        {/* Add new form */}
        {adding && (
          <div className="bg-white rounded-xl border-2 border-primary/30 shadow-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">New Category</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Name *</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Door Closers" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Slug (auto-generated)</label>
                <Input value={slugify(newName)} disabled className="text-muted-foreground" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description…" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-1">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </Button>
              <Button variant="outline" onClick={() => { setAdding(false); setNewName(""); setNewDesc(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Categories list */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="text-center py-16 text-muted-foreground">Loading…</p>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground">No categories yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className={`px-5 py-4 ${editingId === cat.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  {editingId === cat.id ? (
                    <div className="space-y-2">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                        <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="h-8 text-sm font-mono" />
                      </div>
                      <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="h-8 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: cat.id })} disabled={updateMutation.isPending} className="gap-1 h-7">
                          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-slate-900">{cat.name}</span>
                          <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{cat.slug}</span>
                        </div>
                        {cat.description && <p className="text-sm text-muted-foreground mt-0.5 ml-6 line-clamp-1">{cat.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(cat)} className="p-1.5 rounded hover:bg-blue-100 text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteMutation.mutate(cat.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
