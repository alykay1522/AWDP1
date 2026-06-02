import { useCart } from "@/lib/cart";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Checkout() {
  const { items, total, clearCart, removeItem } = useCart();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
        <p className="text-slate-600 mb-6">Looks like you haven't added any parts yet.</p>
        <Button onClick={() => navigate("/shop")}>Browse Parts</Button>
      </div>
    );
  }

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || "test";

  return (
    <PayPalScriptProvider options={{ "client-id": paypalClientId, currency: "USD" }}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Checkout</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item: any) => (
                <div key={item.sku} className="flex justify-between items-start border-b pb-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-slate-500">SKU: {item.sku}</div>
                    <div className="text-sm mt-1">Qty: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div>${(item.price * item.quantity).toFixed(2)}</div>
                    <button 
                      onClick={() => removeItem(item.sku)}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-4 flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <PayPalButtons
                  style={{ layout: "vertical" }}
                  createOrder={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      const res = await fetch("/api/checkout/create-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          items: items.map(i => ({ sku: i.sku, quantity: i.quantity, price: i.price })),
                          total 
                        }),
                      });
                      if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || "Failed to create order");
                      }
                      const order = await res.json();
                      return order.id;
                    } catch (err: any) {
                      const msg = err.message || "Could not start payment. Please try again.";
                      setError(msg);
                      toast.error(msg);
                      setLoading(false);
                      throw err;
                    }
                  }}
                  onApprove={async (data: any) => {
                    try {
                      const res = await fetch("/api/checkout/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderID: data.orderID }),
                      });
                      if (!res.ok) throw new Error("Payment capture failed");
                      
                      clearCart();
                      navigate("/checkout/success");
                    } catch (err: any) {
                      const msg = err.message || "Payment failed. Contact support if charged.";
                      setError(msg);
                      toast.error(msg);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => {
                    const msg = "Payment error. Try again or use another method.";
                    setError(msg);
                    toast.error(msg);
                    setLoading(false);
                  }}
                />
                <p className="text-xs text-center text-slate-500 mt-4">
                  Secure checkout powered by PayPal. We never store your card details.
                </p>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => navigate("/shop")}>
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PayPalScriptProvider>
  );
}
