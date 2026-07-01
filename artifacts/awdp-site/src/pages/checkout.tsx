import { useCart } from "@/lib/cart";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Checkout() {
  const { items, totalPrice, clearCart, removeFromCart } = useCart();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [shippingInfo, setShippingInfo] = useState<{ cost: number; label: string } | null>(null);

  // useRef avoids the stale-closure bug: PayPal SDK captures onApprove at render time,
  // so reading orderData from state may return the pre-setOrderData null. A ref is
  // always current regardless of when PayPal calls the callback.
  const orderDataRef = useRef<{ paypalOrderId: string; orderId: string } | null>(null);

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
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="pt-4 space-y-2 border-t">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                {shippingInfo && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Shipping (UPS/FedEx Ground)</span>
                    <span>${shippingInfo.cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg">
                  <span>{shippingInfo ? "Total" : "Subtotal"}</span>
                  <span>${shippingInfo ? (totalPrice + shippingInfo.cost).toFixed(2) : totalPrice.toFixed(2)}</span>
                </div>
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
                    orderDataRef.current = null;
                    try {
                      const res = await fetch("/api/paypal/create-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          items: items.map(i => ({ sku: i.sku, quantity: i.quantity }))
                        }),
                      });

                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Failed to create order");
                      }

                      const data = await res.json();
                      const shippingCost = Number(data.shippingCost);
                      if (!Number.isFinite(shippingCost) || shippingCost < 0) {
                        throw new Error("Checkout returned an invalid shipping charge");
                      }
                      setShippingInfo({
                        cost: shippingCost,
                        label: data.shippingLabel || "Shipping & Handling",
                      });
                      // Write to ref immediately — always readable in onApprove regardless of render timing
                      orderDataRef.current = { paypalOrderId: data.paypalOrderId, orderId: data.orderId };
                      return data.paypalOrderId;
                    } catch (err: any) {
                      const msg = err.message || "Could not start payment. Please try again.";
                      setError(msg);
                      toast.error(msg);
                      setLoading(false);
                      throw err;
                    }
                  }}
                  onApprove={async (data: any) => {
                    const orderData = orderDataRef.current;
                    if (!orderData?.orderId) {
                      setError("Order information missing. Please try again.");
                      setProcessingPayment(false);
                      setLoading(false);
                      return;
                    }

                    setProcessingPayment(true);
                    try {
                      const res = await fetch("/api/paypal/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          paypalOrderId: data.orderID,
                          orderId: orderData.orderId,
                        }),
                      });

                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Payment capture failed");
                      }

                      clearCart();
                      navigate("/checkout/success");
                    } catch (err: any) {
                      const msg = err.message || "Payment failed. Please contact support.";
                      setError(msg);
                      toast.error(msg);
                    } finally {
                      setProcessingPayment(false);
                      setLoading(false);
                    }
                  }}
                  onError={() => {
                    const msg = "There was an error with your PayPal payment. Please try again.";
                    setError(msg);
                    toast.error(msg);
                    setLoading(false);
                  }}
                />

                {(loading || processingPayment) && (
                  <div className="mt-4 text-center text-sm text-slate-600">
                    {processingPayment 
                      ? "Processing your payment... Please do not close this window." 
                      : "Preparing your order..."}
                  </div>
                )}

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
