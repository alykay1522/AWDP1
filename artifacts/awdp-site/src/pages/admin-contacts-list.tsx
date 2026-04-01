import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, ChevronDown, ChevronUp, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ContactSubmission {
  id: number; name: string; email: string; phone?: string;
  subject?: string; message: string; createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export default function AdminContactsList() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<{ submissions: ContactSubmission[] }>({
    queryKey: ["admin-contacts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/contacts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const all = data?.submissions ?? [];
  const filtered = all.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.message.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q);
  });

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Contact Messages</h1>
          <p className="text-slate-400 text-sm">{all.length} total messages</p>
        </div>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-1" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-6 max-w-4xl space-y-4">
        <div className="relative max-w-sm">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, message…" className="pl-9" />
        </div>

        {isLoading ? (
          <p className="text-center py-16 text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">{all.length === 0 ? "No messages yet" : "No matches"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => {
              const isExp = expandedId === sub.id;
              return (
                <div key={sub.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <button className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExp ? null : sub.id)}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{sub.name}</span>
                          <span className="text-sm text-muted-foreground">{sub.email}</span>
                          {sub.subject && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sub.subject}</span>}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">{sub.message}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">{fmtDate(sub.createdAt)}</span>
                        {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t bg-slate-50 p-5 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Contact</h4>
                          <p className="font-medium">{sub.name}</p>
                          <a href={`mailto:${sub.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline"><Mail className="w-3.5 h-3.5" />{sub.email}</a>
                          {sub.phone && <a href={`tel:${sub.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline"><Phone className="w-3.5 h-3.5" />{sub.phone}</a>}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Details</h4>
                          {sub.subject && <p><span className="text-muted-foreground">Subject:</span> {sub.subject}</p>}
                          <p><span className="text-muted-foreground">Received:</span> {fmtDate(sub.createdAt)}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Message</h4>
                        <p className="text-sm text-slate-700 bg-white rounded-lg border p-4 whitespace-pre-wrap">{sub.message}</p>
                      </div>
                      <div className="flex gap-2 pt-1 border-t">
                        <a href={`mailto:${sub.email}?subject=Re: ${sub.subject ?? "Your inquiry"}`}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors">
                          Reply via Email
                        </a>
                        {sub.phone && (
                          <a href={`tel:${sub.phone}`}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                        )}
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
