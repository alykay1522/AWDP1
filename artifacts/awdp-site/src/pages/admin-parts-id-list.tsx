import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, RefreshCw, ChevronDown, ChevronUp, Mail, Phone, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface PartsIdRequest {
  id: number; ticketId: string; name: string; email: string;
  phone?: string; description: string; windowDoorBrand?: string;
  windowDoorAge?: string; imageFileName?: string;
  status: string; createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  "in-progress": { label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-200" },
  resolved:    { label: "Resolved",    color: "bg-green-100 text-green-800 border-green-200" },
  closed:      { label: "Closed",      color: "bg-gray-100 text-gray-600 border-gray-200" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function isSingleEmail(value: string): boolean {
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value.trim());
}

function safeMailtoHref(email: string, params: Record<string, string> = {}): string | undefined {
  if (!isSingleEmail(email)) return undefined;
  // Encode the entire address then restore @ so mailto: clients parse it correctly
  const encodedEmail = encodeURIComponent(email).replace(/%40/gi, "@");
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `mailto:${encodedEmail}${qs ? `?${qs}` : ""}`;
}

export default function AdminPartsIdList() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data, isLoading, refetch } = useQuery<{ requests: PartsIdRequest[] }>({
    queryKey: ["admin-parts-id"],
    queryFn: async () => {
      const res = await fetch("/api/admin/parts-id", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/parts-id/${id}/status`, { credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-parts-id"] }); toast({ title: "Status updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const requests = data?.requests ?? [];
  const filtered = requests.filter((r) => filterStatus === "all" || r.status === filterStatus);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Parts ID Requests</h1>
          <p className="text-slate-400 text-sm">{requests.length} total · {pendingCount} pending</p>
        </div>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-1" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-6 max-w-4xl space-y-4">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "in-progress", "resolved", "closed"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterStatus === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              }`}>
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
              {s !== "all" && <span className="ml-1 opacity-60">{requests.filter((r) => r.status === s).length}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center py-16 text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">No requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const isExp = expandedId === req.id;
              const cfg = STATUS_CONFIG[req.status] ?? { label: req.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
              return (
                <div key={req.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <button className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExp ? null : req.id)}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">{req.ticketId}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="font-semibold text-slate-900 mt-0.5">{req.name} — <span className="font-normal text-muted-foreground">{req.email}</span></p>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">{req.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">{fmtDate(req.createdAt)}</span>
                        {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t bg-slate-50 p-5 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Customer</h4>
                          <p className="font-medium">{req.name}</p>
                          <a href={safeMailtoHref(req.email)} className="flex items-center gap-1.5 text-blue-600 hover:underline text-sm"><Mail className="w-3.5 h-3.5" />{req.email}</a>
                          {req.phone && <a href={`tel:${req.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline text-sm"><Phone className="w-3.5 h-3.5" />{req.phone}</a>}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Window / Door Info</h4>
                          {req.windowDoorBrand && <p><span className="text-muted-foreground">Brand:</span> {req.windowDoorBrand}</p>}
                          {req.windowDoorAge && <p><span className="text-muted-foreground">Age:</span> {req.windowDoorAge}</p>}
                          {req.imageFileName && <p><span className="text-muted-foreground">Image:</span> {req.imageFileName}</p>}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
                        <p className="text-sm text-slate-700 bg-white rounded-lg border p-3">{req.description}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 border-t">
                        <span className="text-sm font-medium text-slate-700 self-center">Update status:</span>
                        {["pending", "in-progress", "resolved", "closed"].map((s) => (
                          <button key={s} disabled={req.status === s || statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: req.id, status: s })}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              req.status === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-500"
                            }`}>
                            {STATUS_CONFIG[s]?.label ?? s}
                          </button>
                        ))}
                        <a href={safeMailtoHref(req.email, { subject: `Re: Your Parts ID Request ${req.ticketId}` })}
                          className="ml-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors">
                          Reply via Email
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
