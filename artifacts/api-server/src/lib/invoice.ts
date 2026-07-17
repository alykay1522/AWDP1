/**
 * Order invoice rendering — shared by the customer invoice email and the
 * printable invoice endpoint (GET /api/orders/:orderId/invoice).
 */

export interface InvoiceOrder {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  lineItems: Array<{ sku: string; name: string; price: number; quantity: number }>;
  subtotal: string;
  shippingCost: string;
  total: string;
  status: string;
  createdAt?: Date | string | null;
  paymentMethod?: string;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function fmtDate(value: InvoiceOrder["createdAt"]): string {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function addressHtml(a: InvoiceOrder["shippingAddress"]): string {
  if (!a) return "—";
  return [esc(a.line1), a.line2 ? esc(a.line2) : "", `${esc(a.city)}, ${esc(a.state)} ${esc(a.postal_code)}`, esc(a.country)]
    .filter(Boolean)
    .join("<br>");
}

/** Inner invoice markup (email-safe inline styles). */
export function renderInvoiceBody(order: InvoiceOrder): string {
  const paid = order.status === "paid";
  const rows = order.lineItems
    .map(
      (item) => `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0">${esc(item.name)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;font-size:12px">${esc(item.sku)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(item.price)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${money(item.price * item.quantity)}</td>
      </tr>`,
    )
    .join("");

  return `
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
    <tr>
      <td style="vertical-align:top">
        <h2 style="margin:0 0 4px;color:#1e3a8a;font-size:20px">All Window Door Parts</h2>
        <p style="margin:0;font-size:13px;color:#475569">
          785-533-0244<br>
          info@allwindowdoorparts.com<br>
          www.allwindowdoorparts.com
        </p>
      </td>
      <td style="vertical-align:top;text-align:right">
        <h1 style="margin:0 0 6px;font-size:26px;letter-spacing:2px;color:#0f172a">INVOICE</h1>
        <p style="margin:0;font-size:13px;color:#475569">
          Invoice #: <strong>${esc(order.orderId)}</strong><br>
          Date: ${fmtDate(order.createdAt)}<br>
          ${paid
            ? `<span style="display:inline-block;margin-top:6px;padding:3px 12px;border:2px solid #16a34a;border-radius:4px;color:#16a34a;font-weight:bold;font-size:13px">PAID${order.paymentMethod ? ` — ${esc(order.paymentMethod).toUpperCase()}` : ""}</span>`
            : `<span style="display:inline-block;margin-top:6px;padding:3px 12px;border:2px solid #64748b;border-radius:4px;color:#64748b;font-weight:bold;font-size:13px">${esc(order.status).toUpperCase()}</span>`}
        </p>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr>
      <td style="vertical-align:top;width:50%">
        <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px">Bill To</p>
        <p style="margin:0;font-size:14px;line-height:1.5">
          ${esc(order.customerName)}<br>
          ${esc(order.customerEmail)}${order.customerPhone ? `<br>${esc(order.customerPhone)}` : ""}
        </p>
      </td>
      <td style="vertical-align:top;width:50%">
        <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px">Ship To</p>
        <p style="margin:0;font-size:14px;line-height:1.5">${addressHtml(order.shippingAddress)}</p>
      </td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead>
      <tr style="background:#1e3a8a;color:#ffffff">
        <th style="padding:10px 8px;text-align:left">Item</th>
        <th style="padding:10px 8px;text-align:center">SKU</th>
        <th style="padding:10px 8px;text-align:right">Unit Price</th>
        <th style="padding:10px 8px;text-align:center">Qty</th>
        <th style="padding:10px 8px;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" rowspan="3" style="padding:12px 8px;vertical-align:top;font-size:12px;color:#64748b">
          Thank you for your business!<br>Questions about this invoice? Call 785-533-0244.
        </td>
        <td style="padding:8px;text-align:right;color:#475569">Subtotal</td>
        <td style="padding:8px;text-align:right">${money(order.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:8px;text-align:right;color:#475569">Shipping</td>
        <td style="padding:8px;text-align:right">${money(order.shippingCost)}</td>
      </tr>
      <tr>
        <td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #1e3a8a">Total</td>
        <td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #1e3a8a;color:#1e3a8a">${money(order.total)}</td>
      </tr>
    </tfoot>
  </table>`;
}

/** Full standalone printable invoice page. */
export function renderInvoicePage(order: InvoiceOrder): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Invoice ${esc(order.orderId)} — All Window Door Parts</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; }
    .sheet { max-width: 760px; margin: 24px auto; background: #fff; padding: 40px; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
    .toolbar { max-width: 760px; margin: 16px auto 0; text-align: right; }
    .toolbar button { background: #1e3a8a; color: #fff; border: 0; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: bold; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">${renderInvoiceBody(order)}</div>
</body>
</html>`;
}
