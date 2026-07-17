import { waitUntil } from "@vercel/functions";
import { getOrderRecipients, sendOutboundEmail } from "./lib/email.js";
import { renderInvoiceBody } from "./lib/invoice";

interface OrderItem { name: string; sku: string; price: number; quantity: number; }
interface OrderEmailPayload {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: { line1: string; line2?: string; city: string; state: string; postal_code: string; country: string; };
  items: OrderItem[];
  subtotal: string;
  shippingCost?: string;
  total: string;
  paymentMethod: "stripe" | "paypal";
  createdAt?: Date | string | null;
}

function fmtAddr(a?: OrderEmailPayload["shippingAddress"]): string {
  if (!a) return "Not provided";
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.postal_code}`, a.country].filter(Boolean).join("<br>");
}

function ownerHtml(o: OrderEmailPayload): string {
  const rows = o.items.map(i => `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.sku}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(i.price*i.quantity).toFixed(2)}</td>
  </tr>`).join("");
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">New Order Received</h1></div>
  <div style="padding:24px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px 0"><strong>Order ID:</strong></td><td>${o.orderId}</td></tr>
      <tr><td style="padding:8px 0"><strong>Payment:</strong></td><td style="text-transform:capitalize">${o.paymentMethod}</td></tr>
      <tr><td style="padding:8px 0"><strong>Customer:</strong></td><td>${o.customerName}</td></tr>
      <tr><td style="padding:8px 0"><strong>Email:</strong></td><td><a href="mailto:${o.customerEmail}">${o.customerEmail}</a></td></tr>
      <tr><td style="padding:8px 0"><strong>Phone:</strong></td><td>${o.customerPhone||"Not provided"}</td></tr>
      <tr><td style="padding:8px 0;vertical-align:top"><strong>Ship To:</strong></td><td>${fmtAddr(o.shippingAddress)}</td></tr>
    </table>
    <h3 style="border-bottom:2px solid #1e3a8a;padding-bottom:8px">Order Items</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:center">SKU</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px">Order Total:</td><td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px;color:#1e3a8a">$${o.total}</td></tr></tfoot>
    </table>
    <div style="margin-top:24px;padding:16px;background:#fef9c3;border-left:4px solid #f59e0b">
      <strong>Order follow-up:</strong> Contact <a href="mailto:${o.customerEmail}">${o.customerEmail}</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b">All Window Door Parts — 785-533-0244 — info@allwindowdoorparts.com</div>
</body></html>`;
}

function siteBaseUrl(): string {
  return (
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://www.allwindowdoorparts.com"
  ).replace(/\/+$/, "");
}

function invoiceUrl(o: OrderEmailPayload): string {
  return `${siteBaseUrl()}/api/orders/${encodeURIComponent(o.orderId)}/invoice?email=${encodeURIComponent(o.customerEmail)}`;
}

function customerInvoiceHtml(o: OrderEmailPayload): string {
  const invoice = renderInvoiceBody({
    orderId: o.orderId,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shippingAddress: o.shippingAddress,
    lineItems: o.items,
    subtotal: o.subtotal,
    shippingCost: o.shippingCost ?? "0",
    total: o.total,
    status: "paid",
    createdAt: o.createdAt ?? new Date(),
    paymentMethod: o.paymentMethod,
  });
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Thank You for Your Order!</h1></div>
  <div style="padding:24px">
    <p>Hi ${o.customerName || "Valued Customer"},</p>
    <p>Your payment has been received. Your invoice is below — you can also
      <a href="${invoiceUrl(o)}" style="color:#1e3a8a;font-weight:bold">view and print it online</a>.</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:24px;margin:16px 0">${invoice}</div>
    <p>We hope to get back to you in a timely manner regarding shipping details.</p>
    <p>Questions? <a href="tel:785-533-0244">785-533-0244</a> or <a href="mailto:info@allwindowdoorparts.com">info@allwindowdoorparts.com</a></p>
    <p>Thank you for choosing All Window Door Parts — veteran owned &amp; operated, 40+ years experience.</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b">All Window Door Parts — 785-533-0244 — info@allwindowdoorparts.com</div>
</body></html>`;
}

function customerHtml(o: OrderEmailPayload): string {
  const rows = o.items.map(i => `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${(i.price*i.quantity).toFixed(2)}</td>
  </tr>`).join("");
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Thank You for Your Order!</h1></div>
  <div style="padding:24px">
    <p>Hi ${o.customerName||"Valued Customer"},</p>
    <p>We've received your order. We hope to get back to you in a timely manner regarding shipping details.</p>
    <table style="width:100%;border-collapse:collapse;margin:4px 0 16px;background:#f8fafc">
      <tr><td style="padding:8px"><strong>Order ID:</strong></td><td style="padding:8px">${o.orderId}</td></tr>
    </table>
    <h3 style="border-bottom:2px solid #1e3a8a;padding-bottom:8px">Your Items</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" style="padding:12px 8px;text-align:right;font-weight:bold">Order Total:</td><td style="padding:12px 8px;text-align:right;font-weight:bold;color:#1e3a8a">$${o.total}</td></tr></tfoot>
    </table>
    <p style="margin-top:24px">Questions? <a href="tel:785-533-0244">785-533-0244</a> or <a href="mailto:info@allwindowdoorparts.com">info@allwindowdoorparts.com</a></p>
    <p>Thank you for choosing All Window Door Parts — veteran owned &amp; operated, 40+ years experience.</p>
  </div>
  <div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#64748b">All Window Door Parts — 785-533-0244 — info@allwindowdoorparts.com</div>
</body></html>`;
}

async function deliverOrderNotifications(payload: OrderEmailPayload): Promise<void> {
  await sendOutboundEmail({
    to: getOrderRecipients(),
    replyTo: payload.customerEmail || undefined,
    subject: `New Order ${payload.orderId} — $${payload.total}`,
    html: ownerHtml(payload),
  });

  if (payload.customerEmail) {
    try {
      await sendOutboundEmail({
        to: payload.customerEmail,
        replyTo: "info@allwindowdoorparts.com",
        subject: `Invoice ${payload.orderId} — Order Confirmation`,
        html: customerInvoiceHtml(payload),
      });
    } catch (error) {
      console.error("[email] Customer order confirmation failed", error);
    }
  }
}

export async function sendOrderNotification(payload: OrderEmailPayload): Promise<void> {
  const delivery = deliverOrderNotifications(payload);

  if (process.env.VERCEL) {
    waitUntil(delivery.catch((error) => {
      console.error("[email] Staff order notification failed", error);
    }));
    return;
  }

  await delivery;
}
