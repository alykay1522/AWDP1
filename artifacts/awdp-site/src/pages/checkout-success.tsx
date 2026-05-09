import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useCart } from "@/lib/cart";
import { CheckCircle2, Package, Phone, Mail, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_MAILTO } from "@/lib/siteContact";

export default function CheckoutSuccess() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderId = params.get("order_id");
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();
  const [fulfilled, setFulfilled] = useState(false);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    // Stripe success URL includes session_id; PayPal returns without it — call fulfill whenever
    // session_id is present so paid Stripe checkouts complete even if the site is now PayPal-only.
    if (sessionId && !fulfilled) {
      setFulfilled(true);
      fetch("/api/checkout/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    }
  }, [sessionId, fulfilled]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-16 px-4">
      <div className="max-w-lg w-full text-center space-y-6">

        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold font-serif text-foreground mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for your order. You'll receive a confirmation email shortly.
          </p>
        </div>

        {orderId && (
          <div className="bg-muted/50 border rounded-lg p-4 text-left space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Order Reference</p>
            <p className="text-xl font-bold text-primary font-mono tracking-wider">{orderId}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">What happens next?</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>We'll review your order and confirm availability</li>
                <li>Most orders ship within 1-2 business days</li>
                <li>You'll receive tracking information by email</li>
                <li>Questions? We're here to help</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <p className="font-semibold text-sm">Need help with your order?</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:785-533-0244"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <Phone className="w-4 h-4" /> 785-533-0244
            </a>
            <a
              href="mailto:info@allwindowdoorparts.com"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <Mail className="w-4 h-4" /> info@allwindowdoorparts.com
              href={SITE_CUSTOMER_MAILTO}
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <Mail className="w-4 h-4" /> {SITE_CUSTOMER_EMAIL}
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" /> Back to Home
            </Link>
          </Button>
          <Button asChild>
            <Link href="/shop">
              Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
