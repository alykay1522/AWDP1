import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useCustomer, type CustomerAddress } from "@/hooks/useCustomer";

interface OrderSummary {
  orderId: string;
  lineItems: Array<{ sku: string; name: string; price: number; quantity: number }>;
  subtotal: string;
  shippingCost: string;
  total: string;
  status: string;
  createdAt: string | null;
}

const EMPTY_ADDRESS: CustomerAddress = {
  line1: "", line2: "", city: "", state: "", postal_code: "", country: "US",
};

export default function Account() {
  const [, navigate] = useLocation();
  const { customer, loading, logout, setCustomer } = useCustomer();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<CustomerAddress>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    if (!loading && !customer) navigate("/login");
  }, [loading, customer, navigate]);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name ?? "");
    setPhone(customer.phone ?? "");
    setAddress(customer.shippingAddress ?? EMPTY_ADDRESS);
    fetch("/api/account/orders", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => setOrders([]));
  }, [customer?.id]);

  if (loading || !customer) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-slate-500">Loading your account…</div>;
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const hasAddress = address.line1.trim() !== "";
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          phone,
          shippingAddress: hasAddress ? { ...address, line2: address.line2 || undefined } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save changes");
        return;
      }
      setCustomer(data.customer);
      toast.success("Account updated");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const input = "w-full border rounded-lg px-3 py-2 text-sm";
  const label = "block text-sm font-medium mb-1";

  return (
    <div className="max-w-4xl mx-auto p-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
          <p className="text-slate-500 text-sm mt-1">{customer.email}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>Sign Out</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle>Contact & Shipping Info</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label htmlFor="pf-name" className={label}>Name</label>
                <input id="pf-name" type="text" autoComplete="name" className={input} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="pf-phone" className={label}>Phone</label>
                <input id="pf-phone" type="tel" autoComplete="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <fieldset className="space-y-3 border-t pt-4">
                <legend className="text-sm font-semibold pt-4">Shipping Address</legend>
                <div>
                  <label htmlFor="pf-line1" className={label}>Street Address</label>
                  <input id="pf-line1" type="text" autoComplete="address-line1" className={input} value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="pf-line2" className={label}>Apt / Suite (optional)</label>
                  <input id="pf-line2" type="text" autoComplete="address-line2" className={input} value={address.line2 ?? ""} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pf-city" className={label}>City</label>
                    <input id="pf-city" type="text" autoComplete="address-level2" className={input} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="pf-state" className={label}>State</label>
                    <input id="pf-state" type="text" autoComplete="address-level1" className={input} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pf-zip" className={label}>ZIP Code</label>
                    <input id="pf-zip" type="text" autoComplete="postal-code" className={input} value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="pf-country" className={label}>Country</label>
                    <input id="pf-country" type="text" maxLength={2} className={input} value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              </fieldset>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Order History</CardTitle></CardHeader>
          <CardContent>
            {orders === null && <p className="text-sm text-slate-500">Loading orders…</p>}
            {orders !== null && orders.length === 0 && (
              <p className="text-sm text-slate-500">
                No orders yet. Orders placed with <span className="font-medium">{customer.email}</span> will appear here.
              </p>
            )}
            <div className="space-y-4">
              {orders?.map((order) => (
                <div key={order.orderId} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-sm">{order.orderId}</div>
                      <div className="text-xs text-slate-500">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(order.total).toFixed(2)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-0.5">
                    {order.lineItems.map((item, i) => (
                      <li key={i}>{item.quantity}× {item.name}</li>
                    ))}
                  </ul>
                  <a
                    href={`/api/orders/${encodeURIComponent(order.orderId)}/invoice`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-semibold text-primary hover:underline"
                  >
                    View invoice →
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
