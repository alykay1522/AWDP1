import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Package, ShoppingBag, DollarSign, Clock, Wrench, MessageSquare,
  TrendingUp, PlusCircle, Settings, FolderTree, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCatalogStats, getGetCatalogStatsQueryKey } from "@workspace/api-client-react";

interface AdminOrdersResponse {
  orders: any[];
  stats: Array<{ status: string; count: number; total: string | null }>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export default function AdminDashboard() {
  const { data: catalogStats } = useGetCatalogStats({
    query: { queryKey: getGetCatalogStatsQueryKey() },
  });

  const { data: ordersData } = useQuery<AdminOrdersResponse>({
    queryKey: ["admin-orders-dash"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: partsData } = useQuery<{ requests: any[] }>({
    queryKey: ["admin-parts-id-dash"],
    queryFn: async () => {
      const res = await fetch("/api/admin/parts-id");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: contactsData } = useQuery<{ submissions: any[] }>({
    queryKey: ["admin-contacts-dash"],
    queryFn: async () => {
      const res = await fetch("/api/admin/contacts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const stats = ordersData?.stats ?? [];
  const totalOrders = stats.reduce((s, r) => s + Number(r.count), 0);
  const pendingOrders = Number(stats.find((s) => s.status === "pending")?.count ?? 0);
  const revenue = stats
    .filter((s) => ["paid", "processing", "shipped", "completed"].includes(s.status))
    .reduce((s, r) => s + Number(r.total ?? 0), 0);

  const recentOrders = (ordersData?.orders ?? []).slice(0, 5);
  const pendingParts = (partsData?.requests ?? []).filter((r) => r.status === "pending").length;
  const recentContacts = (contactsData?.submissions ?? []).slice(0, 4);

  const quickStats = [
    { label: "Total Products", value: catalogStats?.totalProducts ?? "—", icon: <Package className="w-5 h-5 text-blue-500" />, href: "/admin/products", color: "text-blue-700" },
    { label: "Total Orders", value: totalOrders, icon: <ShoppingBag className="w-5 h-5 text-indigo-500" />, href: "/admin/orders", color: "text-indigo-700" },
    { label: "Pending Orders", value: pendingOrders, icon: <Clock className="w-5 h-5 text-yellow-500" />, href: "/admin/orders", color: "text-yellow-700" },
    { label: "Revenue", value: `$${revenue.toFixed(2)}`, icon: <DollarSign className="w-5 h-5 text-green-500" />, href: "/admin/orders", color: "text-green-700" },
    { label: "Parts ID Pending", value: pendingParts, icon: <Wrench className="w-5 h-5 text-orange-500" />, href: "/admin/parts-id", color: "text-orange-700" },
    { label: "Contact Messages", value: contactsData?.submissions?.length ?? "—", icon: <MessageSquare className="w-5 h-5 text-purple-500" />, href: "/admin/contacts", color: "text-purple-700" },
  ];

  const quickActions = [
    { label: "Add New Product", icon: <PlusCircle className="w-4 h-4" />, href: "/admin/products/new", color: "bg-primary text-white hover:bg-primary/90" },
    { label: "Manage Products", icon: <Package className="w-4 h-4" />, href: "/admin/products", color: "bg-white border hover:bg-slate-50" },
    { label: "View Orders", icon: <ShoppingBag className="w-4 h-4" />, href: "/admin/orders", color: "bg-white border hover:bg-slate-50" },
    { label: "Manage Categories", icon: <FolderTree className="w-4 h-4" />, href: "/admin/categories", color: "bg-white border hover:bg-slate-50" },
    { label: "Site Settings", icon: <Settings className="w-4 h-4" />, href: "/admin/settings", color: "bg-white border hover:bg-slate-50" },
  ];

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back — here's your store at a glance</p>
      </div>

      <div className="p-6 md:p-8 space-y-8 max-w-6xl">

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {quickStats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</span>
                {s.icon}
              </div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${a.color}`}
              >
                {a.icon} {a.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent orders */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" /> Recent Orders
              </h2>
              <Link href="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No orders yet</p>
            ) : (
              <div className="divide-y">
                {recentOrders.map((o: any) => (
                  <div key={o.orderId} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-mono font-semibold">{o.orderId}</p>
                      <p className="text-xs text-muted-foreground">{o.customerName} · {fmtDate(o.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${Number(o.total).toFixed(2)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === "paid" ? "bg-blue-100 text-blue-700" :
                        o.status === "shipped" ? "bg-indigo-100 text-indigo-700" :
                        o.status === "completed" ? "bg-green-100 text-green-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent contact messages */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Recent Messages
              </h2>
              <Link href="/admin/contacts" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {recentContacts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No messages yet</p>
            ) : (
              <div className="divide-y">
                {recentContacts.map((c: any) => (
                  <div key={c.id} className="px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email} · {fmtDate(c.createdAt)}</p>
                      </div>
                      {c.subject && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0 ml-2">{c.subject}</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
