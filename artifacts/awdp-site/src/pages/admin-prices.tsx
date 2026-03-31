import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, DollarSign, RefreshCw, ExternalLink, Search, Filter, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface PriceAlert {
  id: number;
  product_sku: string;
  product_name: string;
  distributor: string;
  distributor_sku: string;
  distributor_url: string;
  cost_price: string | null;
  our_price: string;
  markup_ratio: string | null;
  target_markup: string;
  status: string;
  notes: string;
  checked_at: string;
  category: string;
}

interface Summary {
  total: number;
  ok: number;
  needsUpdate: number;
  costDown: number;
  noPrice: number;
  lastChecked: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  needs_update: { label: "Needs Update", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: AlertTriangle },
  cost_up:      { label: "Cost Increased", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: TrendingUp },
  cost_down:    { label: "Cost Dropped", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: TrendingDown },
  no_price:     { label: "No Public Price", color: "text-gray-600", bg: "bg-gray-50 border-gray-200", icon: Search },
  ok:           { label: "OK", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
  manual:       { label: "Manual Entry", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Edit2 },
};

function formatMoney(v: string | null | number) {
  if (!v) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function formatMarkup(ratio: string | null, target: string) {
  if (!ratio) return <span className="text-muted-foreground">—</span>;
  const r = Number(ratio);
  const t = Number(target);
  const isLow = r < t * 0.95;
  return (
    <span className={isLow ? "text-red-600 font-semibold" : "text-green-700 font-medium"}>
      {r.toFixed(2)}x {isLow ? `(target: ${t}x)` : ""}
    </span>
  );
}

function ManualPriceEntry({ sku, distributor, onSave }: { sku: string; distributor: string; onSave: () => void }) {
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!cost || isNaN(Number(cost))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/price-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSku: sku, distributor, costPrice: Number(cost) }),
      });
      if (res.ok) {
        toast({ title: "Price saved", description: `Cost $${cost} recorded for ${sku}` });
        onSave();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-muted-foreground">Enter cost:</span>
      <Input
        type="number"
        step="0.01"
        placeholder="0.00"
        value={cost}
        onChange={e => setCost(e.target.value)}
        className="h-7 w-24 text-sm"
      />
      <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving || !cost}>
        <Check className="w-3 h-3 mr-1" /> Save
      </Button>
    </div>
  );
}

function UpdatePriceAction({ sku, costPrice, targetMarkup, onSave }: { sku: string; costPrice: string; targetMarkup: string; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newPrice, setNewPrice] = useState("");

  const suggestedPrice = costPrice ? (Number(costPrice) * Number(targetMarkup)).toFixed(2) : "";

  const handleApply = async (price: string) => {
    const res = await fetch("/api/admin/price-update-our", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSku: sku, newPrice: Number(price) }),
    });
    if (res.ok) {
      toast({ title: "Price updated", description: `${sku} now priced at $${price}` });
      onSave();
      setEditing(false);
    }
  };

  if (!costPrice) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
        onClick={() => handleApply(suggestedPrice)}
      >
        Apply suggested ${suggestedPrice}
      </Button>
      {!editing ? (
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(true); setNewPrice(suggestedPrice); }}>
          <Edit2 className="w-3 h-3 mr-1" /> Custom
        </Button>
      ) : (
        <>
          <Input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="h-7 w-24 text-sm" />
          <Button size="sm" className="h-7 text-xs" onClick={() => handleApply(newPrice)}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}><X className="w-3 h-3" /></Button>
        </>
      )}
    </div>
  );
}

export default function AdminPrices() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "alerts" | "ok">("alerts");
  const [search, setSearch] = useState("");
  const [distFilter, setDistFilter] = useState<string>("all");
  const [showManual, setShowManual] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["price-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/price-alerts");
      return res.json() as Promise<{ summary: Summary; alerts: PriceAlert[] }>;
    },
  });

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["price-alerts"] }); };

  const summary = data?.summary;
  const allAlerts = data?.alerts ?? [];

  const filtered = allAlerts.filter(a => {
    if (filter === "alerts" && (a.status === "ok")) return false;
    if (filter === "ok" && a.status !== "ok") return false;
    if (distFilter !== "all" && a.distributor !== distFilter) return false;
    if (search && !a.product_name?.toLowerCase().includes(search.toLowerCase()) && !a.product_sku?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Distributor Price Monitor</h1>
          <p className="text-muted-foreground text-sm">
            Track cost prices from Alcosupply &amp; Strybuc — get notified when markup needs updating.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <a href="https://alcosupply.com/shop/" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="w-3 h-3" /> Alcosupply
            </Button>
          </a>
          <a href="https://shop.strybuc.com/" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="w-3 h-3" /> Strybuc
            </Button>
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Tracked", value: summary.total, color: "text-foreground", bg: "bg-muted/40" },
            { label: "OK", value: summary.ok, color: "text-green-700", bg: "bg-green-50" },
            { label: "Needs Update", value: summary.needsUpdate, color: "text-red-700", bg: "bg-red-50" },
            { label: "Cost Down", value: summary.costDown, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "No Price", value: summary.noPrice, color: "text-gray-600", bg: "bg-gray-50" },
          ].map(c => (
            <div key={c.label} className={`rounded-lg border p-3 ${c.bg}`}>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {summary?.needsUpdate > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">{summary.needsUpdate} product{summary.needsUpdate > 1 ? "s" : ""} need price updates</p>
            <p className="text-sm text-red-700">Distributor cost has increased — your markup has dropped below the target. Review and update selling prices.</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1">
          {["all", "alerts", "ok"].map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="capitalize h-9" onClick={() => setFilter(f as any)}>
              {f === "alerts" ? "Needs Attention" : f}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all", "Alcosupply", "Strybuc"].map(d => (
            <Button key={d} size="sm" variant={distFilter === d ? "secondary" : "ghost"} className="h-9 text-xs" onClick={() => setDistFilter(d)}>
              {d}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading price data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
          {filter === "alerts" ? "No price alerts — everything looks good!" : "No results"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const cfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.ok;
            const Icon = cfg.icon;
            const isManualNeeded = alert.status === "no_price" && alert.distributor === "Strybuc";
            const needsAction = ["needs_update", "cost_up"].includes(alert.status);

            return (
              <div key={alert.id} className={`border rounded-lg p-4 ${needsAction ? cfg.bg : "bg-card border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                      <span className="font-medium text-sm">{alert.product_name || "Unknown Product"}</span>
                      <Badge variant="outline" className="font-mono text-xs">{alert.product_sku}</Badge>
                      <Badge variant="secondary" className="text-xs">{alert.distributor}</Badge>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Distributor cost</span>
                        <div className="font-semibold">{formatMoney(alert.cost_price)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Our price</span>
                        <div className="font-semibold">{formatMoney(alert.our_price)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Current markup</span>
                        <div>{formatMarkup(alert.markup_ratio, alert.target_markup)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Target markup</span>
                        <div className="text-muted-foreground">{Number(alert.target_markup).toFixed(2)}x</div>
                      </div>
                    </div>
                    {alert.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic">{alert.notes}</p>
                    )}

                    {/* Actions */}
                    {needsAction && alert.cost_price && (
                      <UpdatePriceAction sku={alert.product_sku} costPrice={alert.cost_price} targetMarkup={alert.target_markup} onSave={refresh} />
                    )}
                    {(isManualNeeded || showManual === alert.product_sku) && (
                      <ManualPriceEntry sku={alert.product_sku} distributor={alert.distributor} onSave={() => { refresh(); setShowManual(null); }} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alert.distributor_url && (
                      <a href={alert.distributor_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                          <ExternalLink className="w-3 h-3" /> Check site
                        </Button>
                      </a>
                    )}
                    {!isManualNeeded && alert.status === "no_price" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowManual(showManual === alert.product_sku ? null : alert.product_sku)}>
                        <Edit2 className="w-3 h-3 mr-1" /> Enter price
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {alert.checked_at ? new Date(alert.checked_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How to use */}
      {!isLoading && allAlerts.length === 0 && (
        <div className="border rounded-lg p-6 bg-muted/20 text-center space-y-3">
          <DollarSign className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">No price checks recorded yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Run the price checker script to pull current costs from Alcosupply and Strybuc, then come back here to see alerts.
          </p>
          <code className="block text-xs bg-muted rounded p-3 text-left max-w-md mx-auto">
            pnpm --filter @workspace/scripts check-prices
          </code>
        </div>
      )}
    </div>
  );
}
