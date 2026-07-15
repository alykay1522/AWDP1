import { useCart } from "@/lib/cart";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "wouter";
import { useCustomer } from "@/hooks/useCustomer";

function attributeLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function Checkout() {
  const { items, totalPrice, clearCart, removeFromCart } = useCart();
  const { customer, loading: customerLoading } = useCustomer();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [shippingInfo, setShippingInfo] = useState<{ cost: number; label: string } | null>(null);

  // Fetch the PayPal client ID from the server so checkout does not depend on a
  // build-time frontend environment variable.
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalError, setPaypalError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/paypal/client-id")
      .then((res) => {
        if (!res.ok) throw new Error("PayPal not configured");
        return res.json();
      })
      .then((data) => setPaypalClientId(data.clientId))
      .catch(() => setPaypalError("PayPal is temporarily unavailable. Please call 785-533-0244 to place your order."));
  }, []);

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

  if (paypalError) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Checkout Unavailable</h1>
        <p className="text-slate-600 mb-6">{paypalError}</p>
        <Button onClick={() => navigate("/shop")}>Continue Shopping</Button>
      </div>
    );
  }

  if (!paypalClientId) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-slate-500">Loading checkout…</p>
      </div>
    );
  }

  return (
    <PayPalScriptProvider options={{ "client-id": paypalClientId, currency: "USD" }}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Checkout</h1>

        {!customerLoading && !customer && (
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            Have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>{" "}
            to save this order to your order history.
          </div>
        )}
        {!customerLoading && customer && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Signed in as {customer.email} — this order will be saved to your account.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.cartLineKey} className="flex justify-between items-start border-b pb-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-slate-500">SKU: {item.sku}</div>
                    {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0 && (
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        {Object.entries(item.selectedAttributes).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{attributeLabel(key)}:</span> {value}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-sm mt-1">Qty: {item.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div>${(Number(item.price) * item.quantity).toFixed(2)}</div>
                    <button
                      onClick={() => removeFromCart(item.cartLineKey)}
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
                    <span>Shipping ({shippingInfo.label})</span>
                    <span>${shippingInfo.cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg">
                  <span>{shippingInfo ? "Total" : "Subtotal (shipping calculated next)"}</span>
                  <span>${shippingInfo ? (totalPrice + shippingInfo.cost).toFixed(2) : totalPrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimum order $50. Shipping calculated when you click Pay with PayPal.</p>
              </div>
            </CardContent>
          </Card>

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
                          items: items.map((item) => ({
                            sku: item.sku,
                            quantity: item.quantity,
                            selectedAttributes: item.selectedAttributes ?? {},
                          })),
                        }),
                      });

                      if (!res.ok) {
                        const responseError = await res.json().catch(() => ({}));
                        throw new Error(responseError.error || "Failed to create order");
                      }

                      const data = await res.json();
                      orderDataRef.current = {
                        paypalOrderId: data.paypalOrderId,
                        orderId: data.orderId,
                      };
                      setShippingInfo({
                        cost: Number(data.shippingCost) || 0,
                        label: data.shippingLabel || "UPS/FedEx Ground",
                      });
                      return data.paypalOrderId;
                    } catch (requestError: any) {
                      const message = requestError.message || "Could not start payment. Please try again.";
                      setError(message);
                      toast.error(message);
                      setLoading(false);
                      throw requestError;
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
                        const responseError = await res.json().catch(() => ({}));
                        throw new Error(responseError.error || "Payment capture failed");
                      }

                      clearCart();
                      navigate("/checkout/success");
                    } catch (captureError: any) {
                      const message = captureError.message || "Payment failed. Please contact support at 785-533-0244.";
                      setError(message);
                      toast.error(message);
                    } finally {
                      setProcessingPayment(false);
                      setLoading(false);
                    }
                  }}
                  onCancel={() => {
                    const message = "PayPal checkout was canceled. Your cart has not been charged.";
                    setError(message);
                    setLoading(false);
                    setProcessingPayment(false);
                    orderDataRef.current = null;
                  }}
                  onError={() => {
                    const message = "There was an error with your PayPal payment. Please try again.";
                    setError(message);
                    toast.error(message);
                    setLoading(false);
                    setProcessingPayment(false);
                  }}
                />

                {(loading || processingPayment) && (
                  <div className="mt-4 text-center text-sm text-slate-600">
                    {processingPayment
                      ? "Processing your payment… Please do not close this window."
                      : "Preparing your order…"}
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
