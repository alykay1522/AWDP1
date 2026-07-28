import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, DollarSign, Clock, CheckCircle2, Truck, XCircle,
  ChevronDown, ChevronUp, Search, RefreshCw, Phone, Mail,
  MapPin, ShoppingBag, ExternalLink, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PageSeo } from "@/components/page-seo";
import { AdminQueryError } from "@/components/admin/admin-error";

interface LineItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface Order {
  id: number;
  orderId: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: ShippingAddress;
  lineItems: LineItem[];
  subtotal: string;
  shippingCost: string;
  total: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface StatRow {
  status: string;
  count: number;
  total: string | null;
}

interface AdminOrdersResponse {
  orders: Order[];
  stats: StatRow[];
}

async function readApiError(res: Response, fallback: string) {
  const text = await res.text().catch(() => "");
  if (!text) return `${fallback} (${res.status})`;
  try {
    const parsed = JSON.parse(text) as { error?: string; detail?: string };
    return parsed.detail || parsed.error || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status}): ${text.slice(0, 160)}`;
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: "Pending",    color: "bg-yellow-100 text-yellow-800 border-yellow-200",  icon: <Clock className="w-3 h-3" /> },
  paid:       { label: "Paid",       color: "bg-blue-100 text-blue-800 border-blue-200",         icon: <DollarSign className="w-3 h-3" /> },
  processing: { label: "Processing", color: "bg-purple-100 text-purple-800 border-purple-200",   icon: <Package className="w-3 h-3" /> },
  shipped:    { label: "Shipped",    color: "bg-indigo-100 text-indigo-800 border-indigo-200",   icon: <Truck className="w-3 h-3" /> },
  completed:  { label: "Completed",  color: "bg-green-100 text-green-800 border-green-200",      icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-800 border-red-200",            icon: <XCircle className="w-3 h-3" /> },
  refunded:   { label: "Refunded",   color: "bg-gray-100 text-gray-700 border-gray-200",         icon: <AlertCircle className="w-3 h-3" /> },
};

const STATUS_ORDER = ["pending", "paid", "processing", "shipped", "completed", "cancelled", "refunded"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function fmt(val: string | null | undefined) {
  return val ? `$${Number(val).toFixed(2)}` : "$0.00";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default function AdminOrders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [checkoutPayPalOnly, setCheckoutPayPalOnly] = useState(false);

  useEffect(() => {
    fetch("/api/checkout/options", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { checkoutPayPalOnly?: boolean }) => setCheckoutPayPalOnly(Boolean(d.checkoutPayPalOnly)))
      .catch(() => setCheckoutPayPalOnly(false));
  }, []);

  const { data, isLoading, isError, error: queryError, refetch } = useQuery<AdminOrdersResponse>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders", { credentials: "include" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load orders"));
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, { credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Order updated", description: "Status saved successfully." });
      setUpdatingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setUpdatingId(null);
    },
  });

  const orders = data?.orders ?? [];
  const stats = data?.stats ?? [];

  const totalRevenue = stats
    .filter((s) => ["paid", "processing", "shipped", "completed"].includes(s.status))
    .reduce((sum, s) => sum + Number(s.total ?? 0), 0);

  const totalOrders = stats.reduce((sum, s) => sum + Number(s.count), 0);
  const pendingCount = stats.find((s) => s.status === "pending")?.count ?? 0;
  const paidCount = stats.filter((s) => ["paid", "processing", "shipped", "completed"].includes(s.status))
    .reduce((sum, s) => sum + Number(s.count), 0);

  const filtered = orders.filter((o) => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.orderId.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      o.lineItems.some((li) => li.sku.toLowerCase().includes(q) || li.name.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo title="Admin — Orders" path="/admin/orders" noIndex />

      {/* Header */}
      <div className="bg-slate-900 text-white py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Order Management</h1>
              <p className="text-slate-400 text-sm mt-1">All Window Door Parts — Admin</p>
            </div>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-2 self-start sm:self-auto"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: totalOrders, icon: <ShoppingBag className="w-5 h-5 text-slate-500" />, color: "text-slate-900" },
            { label: "Pending Payment", value: pendingCount, icon: <Clock className="w-5 h-5 text-yellow-500" />, color: "text-yellow-700" },
            { label: "Paid / Fulfilled", value: paidCount, icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, color: "text-green-700" },
            { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-blue-500" />, color: "text-blue-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
                {s.icon}
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID, customer, SKU…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", ...STATUS_ORDER].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterStatus === s
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s]?.label ?? s}
                {s !== "all" && (
                  <span className="ml-1 opacity-60">
                    {stats.find((r) => r.status === s)?.count ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading orders…</div>
        ) : isError ? (
          <div className="p-8">
            <AdminQueryError error={queryError} onRetry={refetch} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No orders found</p>
            <p className="text-sm mt-1">Orders placed through checkout will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const isExpanded = expandedId === order.orderId;
              return (
                <div key={order.orderId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  {/* Order row header */}
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : order.orderId)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono font-bold text-sm text-slate-900">{order.orderId}</span>
                          <StatusBadge status={order.status} />
                          {order.stripePaymentIntentId && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {checkoutPayPalOnly ? "Stripe (legacy): " : "Stripe: "}
                              {order.stripePaymentIntentId.slice(-8)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span>{order.customerName}</span>
                          <span>{order.customerEmail}</span>
                          <span>{fmtDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-slate-900">{fmt(order.total)}</p>
                          <p className="text-xs text-muted-foreground">{order.lineItems.length} item{order.lineItems.length !== 1 ? "s" : ""}</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t bg-slate-50 px-5 py-5 space-y-6">
                      <div className="grid md:grid-cols-3 gap-6">

                        {/* Customer */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Customer</h3>
                          <div className="space-y-1.5 text-sm">
                            <p className="font-semibold">{order.customerName}</p>
                            <a href={`mailto:${order.customerEmail}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                              <Mail className="w-3.5 h-3.5" />{order.customerEmail}
                            </a>
                            {order.customerPhone && (
                              <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                                <Phone className="w-3.5 h-3.5" />{order.customerPhone}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Shipping */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ship To</h3>
                          {order.shippingAddress ? (
                            <div className="text-sm space-y-0.5">
                              <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                <span>
                                  {order.shippingAddress.line1}
                                  {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}<br />
                                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postal_code}<br />
                                  {order.shippingAddress.country}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {order.status === "pending" ? "Collected at payment" : "Not provided"}
                            </p>
                          )}
                        </div>

                        {/* Payment */}
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Payment</h3>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(order.subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{Number(order.shippingCost) === 0 ? "TBD" : fmt(order.shippingCost)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span>{fmt(order.total)}</span></div>
                          </div>
                          {order.stripeSessionId && (
                            <a
                              href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId ?? ""}`}
                              target="_blank" rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> View in Stripe
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Line items */}
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Items Ordered</h3>
                        <div className="rounded-lg border overflow-hidden bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-xs text-muted-foreground uppercase tracking-wide">
                              <tr>
                                <th className="text-left px-4 py-2">SKU</th>
                                <th className="text-left px-4 py-2">Product</th>
                                <th className="text-right px-4 py-2">Price</th>
                                <th className="text-right px-4 py-2">Qty</th>
                                <th className="text-right px-4 py-2">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {order.lineItems.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.sku}</td>
                                  <td className="px-4 py-2.5 font-medium">{item.name}</td>
                                  <td className="px-4 py-2.5 text-right">${Number(item.price).toFixed(2)}</td>
                                  <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold">${(Number(item.price) * item.quantity).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Status update */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t">
                        <span className="text-sm font-medium text-slate-700">Update status:</span>
                        <div className="flex gap-2 flex-wrap">
                          {STATUS_ORDER.map((s) => (
                            <button
                              key={s}
                              disabled={order.status === s || statusMutation.isPending}
                              onClick={() => {
                                setUpdatingId(order.orderId);
                                statusMutation.mutate({ orderId: order.orderId, status: s });
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                order.status === s
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              {updatingId === order.orderId && statusMutation.isPending && order.status !== s
                                ? "…"
                                : STATUS_CONFIG[s]?.label ?? s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {order.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
                          <span className="font-semibold">Notes: </span>{order.notes}
                        </div>
                      )}
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
