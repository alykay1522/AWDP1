import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Sparkles, Tag, Package, DollarSign, Layers,
  CheckCircle2, ArrowLeft, Info, X, Loader2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { PageSeo } from "@/components/page-seo";

// ── PROFITABLE Cipher ──────────────────────────────────────────────────────────
// P=1 R=2 O=3 F=4 I=5 T=6 A=7 B=8 L=9 E=0
// Digit → PROFITABLE letter, PROFITABLE letter → digit, everything else passes through
const NUM_TO_LETTER: Record<string, string> = {
  "0": "E", "1": "P", "2": "R", "3": "O", "4": "F",
  "5": "I", "6": "T", "7": "A", "8": "B", "9": "L",
};
const LETTER_TO_NUM: Record<string, string> = {
  "P": "1", "R": "2", "O": "3", "F": "4", "I": "5",
  "T": "6", "A": "7", "B": "8", "L": "9", "E": "0",
};

function applyCipher(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .map((ch) => {
      if (NUM_TO_LETTER[ch] !== undefined) return NUM_TO_LETTER[ch];
      if (LETTER_TO_NUM[ch] !== undefined) return LETTER_TO_NUM[ch];
      return ch;
    })
    .join("");
}

function buildAwdpSku(originalSku: string): string {
  const trimmed = originalSku.trim();
  if (!trimmed) return "";
  return "AWDP-" + applyCipher(trimmed);
}

// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Window Operators & Cranks", "Window Locks & Latches", "Window Balances",
  "Window Screens & Frames", "Door Hardware", "Door Locks & Multipoint",
  "Weatherstripping & Seals", "Hinges & Pivots", "Rollers & Guides",
  "Sash & Frame Parts", "Glazing & Seals", "Deer Blind Windows", "Skylights",
  "Rollers & Screens", "Window & Door Hardware", "Locks & Handles", "Tracks & Channels",
];

const schema = z.object({
  originalSku: z.string().min(1, "Supplier part number is required"),
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  price: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Enter a valid price"),
  originalPrice: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) > 0),
    "Enter a valid original price"
  ),
  category: z.string().min(1),
  supplier: z.string().optional(),
  inStock: z.boolean().default(true),
  tagsRaw: z.string().optional(),
  brandsRaw: z.string().optional(),
  specKey: z.string().optional(),
  specValue: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminNewProduct() {
  const [, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      originalSku: "",
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      category: CATEGORIES[0],
      supplier: "",
      inStock: true,
      tagsRaw: "",
      brandsRaw: "",
      specKey: "",
      specValue: "",
    },
  });

  const originalSkuWatch = form.watch("originalSku");
  const previewSku = buildAwdpSku(originalSkuWatch);

  const addSpec = () => {
    const key = form.getValues("specKey")?.trim();
    const val = form.getValues("specValue")?.trim();
    if (!key || !val) return;
    setSpecs((prev) => ({ ...prev, [key]: val }));
    form.setValue("specKey", "");
    form.setValue("specValue", "");
  };

  const removeSpec = (key: string) => {
    setSpecs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const tags = values.tagsRaw
        ? values.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const brands = values.brandsRaw
        ? values.brandsRaw.split(",").map((b) => b.trim()).filter(Boolean)
        : [];

      const payload = {
        originalSku: values.originalSku.trim(),
        name: values.name,
        description: values.description ?? "",
        price: Number(values.price),
        originalPrice: values.originalPrice ? Number(values.originalPrice) : undefined,
        category: values.category,
        supplier: values.supplier ?? "",
        inStock: values.inStock,
        tags,
        compatibleBrands: brands,
        specifications: specs,
      };

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create product");
      }

      const { product, sku } = await res.json();

      toast({
        title: "Product created",
        description: `${product.name} saved as ${sku}`,
      });

      form.reset();
      setSpecs({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo title="Admin — Add New Product" path="/admin/products/new" noIndex />

      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-6">
        <div className="flex items-center gap-4 max-w-4xl">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5"
            onClick={() => setLocation("/admin/products")}
          >
            <ArrowLeft className="w-4 h-4" /> Products
          </Button>
          <div className="h-5 w-px bg-slate-600" />
          <div>
            <h1 className="text-xl font-bold">Add New Product</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              AWDP SKU is encoded from the supplier's original part number using the PROFITABLE cipher
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-4xl py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* SKU Encoding card */}
            <div className="bg-white border-2 border-dashed border-primary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                SKU Encoding — Supplier Part No. → AWDP SKU
              </div>

              <FormField control={form.control} name="originalSku" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Supplier / Original Part Number <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. 35-1234, TRUTH-35-1234, 9021032"
                      className="font-mono text-base tracking-wide"
                    />
                  </FormControl>
                  <FormDescription>
                    The manufacturer's or distributor's original part number — this is what gets encoded
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Live preview */}
              {originalSkuWatch.trim() && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <div className="bg-slate-100 rounded-lg px-3 py-2 font-mono text-sm text-slate-600">
                    {originalSkuWatch.trim().toUpperCase()}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="font-mono text-xl font-bold text-primary tracking-widest bg-primary/5 rounded-lg px-4 py-2 border border-primary/20">
                    {previewSku}
                  </div>
                </div>
              )}

              {!originalSkuWatch.trim() && (
                <div className="mt-4 text-sm text-muted-foreground italic">
                  Enter the supplier part number above to see the encoded AWDP SKU
                </div>
              )}

              {/* Cipher key reference */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground font-medium mb-2">PROFITABLE key (bidirectional):</p>
                <div className="flex flex-wrap gap-1.5">
                  {["P=1","R=2","O=3","F=4","I=5","T=6","A=7","B=8","L=9","E=0"].map((k) => (
                    <span key={k} className="bg-slate-100 rounded px-2 py-0.5 text-xs font-mono text-slate-600">{k}</span>
                  ))}
                  <span className="text-xs text-muted-foreground self-center ml-1">· all other characters pass through</span>
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <Package className="w-4 h-4 text-primary" /> Product Information
              </div>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Marvin Casement Operator, Right Hand" className="font-medium" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="Include part details, dimensions, compatible window/door brands and models…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="supplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier / Brand</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Marvin, Alcosupply, Strybuc…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <DollarSign className="w-4 h-4 text-primary" /> Pricing
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                        <Input {...field} type="number" step="0.01" min="0.01" placeholder="0.00" className="pl-7" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="originalPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original / MSRP <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                        <Input {...field} type="number" step="0.01" min="0.01" placeholder="0.00" className="pl-7" />
                      </div>
                    </FormControl>
                    <FormDescription>Shows as strikethrough "sale" price on product page</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="inStock" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${field.value ? "bg-green-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${field.value ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <FormLabel className="cursor-pointer" onClick={() => field.onChange(!field.value)}>
                      {field.value ? "In Stock" : "Out of Stock"}
                    </FormLabel>
                  </div>
                </FormItem>
              )} />
            </div>

            {/* Tags & Compatible Brands */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <Tag className="w-4 h-4 text-primary" /> Tags & Compatible Brands
              </div>

              <FormField control={form.control} name="tagsRaw" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="casement, operator, right-hand, white (comma-separated)" />
                  </FormControl>
                  <FormDescription>Comma-separated keywords that help customers find this product</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="brandsRaw" render={({ field }) => (
                <FormItem>
                  <FormLabel>Compatible Window / Door Brands</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Marvin, Andersen, Pella, Milgard (comma-separated)" />
                  </FormControl>
                  <FormDescription>Brands this part fits</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <Layers className="w-4 h-4 text-primary" /> Specifications
                <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
              </div>

              <div className="flex gap-2">
                <FormField control={form.control} name="specKey" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input {...field} placeholder="Spec name (e.g. Material)" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="specValue" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input {...field} placeholder="Value (e.g. Aluminum)" />
                    </FormControl>
                  </FormItem>
                )} />
                <Button type="button" variant="outline" onClick={addSpec} className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {Object.keys(specs).length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {Object.entries(specs).map(([k, v]) => (
                        <tr key={k} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-700 w-1/3">{k}</td>
                          <td className="px-4 py-2.5 text-slate-600">{v}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button type="button" onClick={() => removeSpec(k)} className="text-muted-foreground hover:text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4 shrink-0" />
                {previewSku
                  ? <span>Will be saved as <span className="font-mono font-semibold text-slate-700">{previewSku}</span></span>
                  : <span>Enter the supplier part number to see your AWDP SKU</span>
                }
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { form.reset(); setSpecs({}); }}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Save Product</>
                  )}
                </Button>
              </div>
            </div>

          </form>
        </Form>
      </div>
    </div>
  );
}
