import { useCart } from "@/lib/cart";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState, useRef, useEffect, useMemo } from "react";
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

  // Required contact info — checkout cannot complete without all of these.
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  });
  const [showContactErrors, setShowContactErrors] = useState(false);
  const prefilledRef = useRef(false);

  // Prefill from the signed-in customer's saved info (once)
  useEffect(() => {
    if (!customer || prefilledRef.current) return;
    prefilledRef.current = true;
    setContact((prev) => ({
      ...prev,
      name: prev.name || customer.name || "",
      email: prev.email || customer.email || "",
      phone: prev.phone || customer.phone || "",
      line1: prev.line1 || customer.shippingAddress?.line1 || "",
      line2: prev.line2 || customer.shippingAddress?.line2 || "",
      city: prev.city || customer.shippingAddress?.city || "",
      state: prev.state || customer.shippingAddress?.state || "",
      postal_code: prev.postal_code || customer.shippingAddress?.postal_code || "",
      country: prev.country || customer.shippingAddress?.country || "US",
    }));
  }, [customer]);

  const contactErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (contact.name.trim().length < 2) errors.name = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errors.email = "A valid email address is required";
    const phoneDigits = contact.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = "A valid phone number (at least 10 digits) is required";
    if (contact.line1.trim().length < 3) errors.line1 = "Street address is required";
    if (!contact.city.trim()) errors.city = "City is required";
    if (contact.state.trim().length < 2) errors.state = "State is required";
    if (contact.postal_code.trim().length < 3) errors.postal_code = "ZIP code is required";
    return errors;
  }, [contact]);
  const contactValid = Object.keys(contactErrors).length === 0;

  // Ref so PayPal SDK callbacks always read the latest values
  const contactRef = useRef(contact);
  useEffect(() => {
    contactRef.current = contact;
  }, [contact]);
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact & Shipping</CardTitle>
                <p className="text-sm text-slate-500">All fields marked * are required to place your order.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" onBlurCapture={() => setShowContactErrors(true)}>
                  <div>
                    <label htmlFor="co-name" className="block text-sm font-medium mb-1">Full Name *</label>
                    <input id="co-name" type="text" required autoComplete="name" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                    {showContactErrors && contactErrors.name && <p className="text-xs text-red-600 mt-1">{contactErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="co-email" className="block text-sm font-medium mb-1">Email *</label>
                      <input id="co-email" type="email" required autoComplete="email" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                      {showContactErrors && contactErrors.email && <p className="text-xs text-red-600 mt-1">{contactErrors.email}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-phone" className="block text-sm font-medium mb-1">Phone *</label>
                      <input id="co-phone" type="tel" required autoComplete="tel" placeholder="(555) 555-5555" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                      {showContactErrors && contactErrors.phone && <p className="text-xs text-red-600 mt-1">{contactErrors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="co-line1" className="block text-sm font-medium mb-1">Street Address *</label>
                    <input id="co-line1" type="text" required autoComplete="address-line1" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={contact.line1} onChange={(e) => setContact({ ...contact, line1: e.target.value })} />
                    {showContactErrors && contactErrors.line1 && <p className="text-xs text-red-600 mt-1">{contactErrors.line1}</p>}
                  </div>
                  <div>
                    <label htmlFor="co-line2" className="block text-sm font-medium mb-1">Apt / Suite (optional)</label>
                    <input id="co-line2" type="text" autoComplete="address-line2" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={contact.line2} onChange={(e) => setContact({ ...contact, line2: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="co-city" className="block text-sm font-medium mb-1">City *</label>
                      <input id="co-city" type="text" required autoComplete="address-level2" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
                      {showContactErrors && contactErrors.city && <p className="text-xs text-red-600 mt-1">{contactErrors.city}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-state" className="block text-sm font-medium mb-1">State *</label>
                      <input id="co-state" type="text" required autoComplete="address-level1" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })} />
                      {showContactErrors && contactErrors.state && <p className="text-xs text-red-600 mt-1">{contactErrors.state}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-zip" className="block text-sm font-medium mb-1">ZIP *</label>
                      <input id="co-zip" type="text" required autoComplete="postal-code" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={contact.postal_code} onChange={(e) => setContact({ ...contact, postal_code: e.target.value })} />
                      {showContactErrors && contactErrors.postal_code && <p className="text-xs text-red-600 mt-1">{contactErrors.postal_code}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent>
                {!contactValid && (
                  <div
                    className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm"
                    role="status"
                    onClick={() => setShowContactErrors(true)}
                  >
                    Please complete your contact &amp; shipping info above (name, email, phone, and address) to pay.
                  </div>
                )}
                <PayPalButtons
                  style={{ layout: "vertical" }}
                  disabled={!contactValid}
                  forceReRender={[contactValid]}
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
                          customer: {
                            name: contactRef.current.name.trim(),
                            email: contactRef.current.email.trim(),
                            phone: contactRef.current.phone.trim(),
                            address: {
                              line1: contactRef.current.line1.trim(),
                              line2: contactRef.current.line2.trim() || undefined,
                              city: contactRef.current.city.trim(),
                              state: contactRef.current.state.trim(),
                              postal_code: contactRef.current.postal_code.trim(),
                              country: contactRef.current.country.trim() || "US",
                            },
                          },
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
                      navigate(
                        `/checkout/success?order_id=${encodeURIComponent(orderData.orderId)}&email=${encodeURIComponent(contactRef.current.email.trim())}`,
                      );
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
