import { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

interface CartItem {
  sku: string;
  name: string;
  price: number | string;
  quantity: number;
  imageUrl?: string | null;
}

interface Props {
  items: CartItem[];
  totalPrice: number;
  onSuccess: (orderId: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export function PayPalCheckoutButton({ items, totalPrice, onSuccess, onError, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const renderedRef = useRef(false);

  // Fetch client ID from backend
  useEffect(() => {
    fetch("/api/paypal/client-id")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.clientId) setClientId(data.clientId);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Load PayPal JS SDK
  useEffect(() => {
    if (!clientId) return;
    if (window.paypal) { setScriptLoaded(true); setLoading(false); return; }
    const existing = document.querySelector(`script[data-paypal-sdk]`);
    if (existing) {
      existing.addEventListener("load", () => { setScriptLoaded(true); setLoading(false); });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons`;
    script.dataset.paypalSdk = "true";
    script.onload = () => { setScriptLoaded(true); setLoading(false); };
    script.onerror = () => setLoading(false);
    document.head.appendChild(script);
  }, [clientId]);

  // Render PayPal buttons
  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !containerRef.current || disabled) return;
    if (renderedRef.current) return;

    renderedRef.current = true;

    const mappedItems = items.map((item) => ({
      sku: item.sku,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
    }));

    window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "blue",
        shape: "rect",
        label: "paypal",
        height: 45,
      },
      createOrder: async () => {
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: mappedItems }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create order");
        }
        const data = await res.json();
        // Store orderId in session storage for capture step
        sessionStorage.setItem("awdp_paypal_order_id", data.orderId);
        return data.paypalOrderId;
      },
      onApprove: async (data: { orderID: string }) => {
        const orderId = sessionStorage.getItem("awdp_paypal_order_id") || "";
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paypalOrderId: data.orderID, orderId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Payment capture failed");
        }
        const result = await res.json();
        sessionStorage.removeItem("awdp_paypal_order_id");
        onSuccess(result.orderId || orderId);
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        const msg = "PayPal payment failed. Please try again or call 785-533-0244.";
        toast({ title: "Payment Error", description: msg, variant: "destructive" });
        onError?.(msg);
      },
      onCancel: () => {
        toast({ title: "Payment Cancelled", description: "Your cart has been saved.", variant: "default" });
      },
    }).render(containerRef.current);
  }, [scriptLoaded, disabled]);

  if (!clientId && !loading) return null; // PayPal not configured — silently hide
  if (loading) return (
    <div className="w-full h-11 bg-[#FFC439] rounded animate-pulse flex items-center justify-center text-sm text-yellow-900 font-medium">
      Loading PayPal...
    </div>
  );

  return <div ref={containerRef} className={disabled ? "opacity-40 pointer-events-none" : ""} />;
}
