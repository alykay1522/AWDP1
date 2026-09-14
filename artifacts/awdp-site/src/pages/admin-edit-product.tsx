import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Tag, Package, DollarSign, Layers, FolderTree,
  CheckCircle2, ArrowLeft, X, Loader2, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { PageSeo } from "@/components/page-seo";
import { parseApiResponseBody, readApiErrorMessage } from "@/lib/api-response";
import { AdminQueryError } from "@/components/admin/admin-error";

interface Product {
  id: number; sku: string; name: string; description: string;
  price: string; originalPrice: string | null; category: string;
  subcategory: string | null; supplier: string; inStock: boolean;
  imageUrl: string | null; tags: string[]; compatibleBrands: string[];
  specifications: Record<string, string>; createdAt: string;
}

interface Category { id: number; name: string; }

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  price: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Enter a valid price"),
  originalPrice: z.string().optional().refine(
    (v) => !v || (!isNaN(Number(v)) && Number(v) > 0),
    "Enter a valid original price"
  ),
  category: z.string().min(1, "Choose a category"),
  subcategory: z.string().optional(),
  supplier: z.string().optional(),
  imageUrl: z.string().optional().refine(
    (v) => !v || /^https?:\/\//.test(v) || v.startsWith("/"),
    "Enter a full URL or a path starting with /"
  ),
  inStock: z.boolean(),
  tagsRaw: z.string().optional(),
  brandsRaw: z.string().optional(),
  specKey: z.string().optional(),
  specValue: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminEditProduct() {
  const { sku } = useParams<{ sku: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  const encodedSku = encodeURIComponent(sku ?? "");

  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Product>({
    queryKey: ["admin-product", sku],
    queryFn: async () => {
      const res = await fetch(`/api/admin/products/${encodedSku}`, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 404 ? "Product not found" : "Failed to load product");
      const body = await res.json();
      return body.product as Product;
    },
    enabled: Boolean(sku),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const res = await fetch("/api/categories", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", description: "", price: "", originalPrice: "",
      category: "", subcategory: "", supplier: "", imageUrl: "",
      inStock: true, tagsRaw: "", brandsRaw: "", specKey: "", specValue: "",
    },
  });

  // Prefill the form once the product loads (only once, so in-progress edits aren't clobbered by refetches)
  useEffect(() => {
    if (!product || hydrated) return;
    form.reset({
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      originalPrice: product.originalPrice ?? "",
      category: product.category,
      subcategory: product.subcategory ?? "",
      supplier: product.supplier ?? "",
      imageUrl: product.imageUrl ?? "",
      inStock: product.inStock,
      tagsRaw: (product.tags ?? []).join(", "),
      brandsRaw: (product.compatibleBrands ?? []).join(", "),
      specKey: "",
      specValue: "",
    });
    setSpecs(product.specifications ?? {});
    setHydrated(true);
  }, [product, hydrated, form]);

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

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const tags = values.tagsRaw ? values.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
      const compatibleBrands = values.brandsRaw ? values.brandsRaw.split(",").map((b) => b.trim()).filter(Boolean) : [];

      const payload = {
        name: values.name,
        description: values.description ?? "",
        price: Number(values.price),
        originalPrice: values.originalPrice ? Number(values.originalPrice) : null,
        category: values.category,
        subcategory: values.subcategory?.trim() || null,
        supplier: values.supplier ?? "",
        imageUrl: values.imageUrl?.trim() || null,
        inStock: values.inStock,
        tags,
        compatibleBrands,
        specifications: specs,
      };

      const res = await fetch(`/api/admin/products/${encodedSku}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseApiResponseBody(res);
      if (!res.ok) throw new Error(readApiErrorMessage(res, parsed, "Failed to save product"));
      return parsed.json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", sku] });
      qc.invalidateQueries({ queryKey: ["admin-categories-list"] });
      toast({ title: "Product updated", description: `${sku} saved.` });
      setLocation("/admin/products");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await updateMutation.mutateAsync(values);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !hydrated) {
    if (isError) {
      return (
        <div className="p-8">
          <AdminQueryError error={error} onRetry={refetch} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading product…
      </div>
    );
  }

  // Ensure the product's saved category is selectable even if it isn't in the
  // categories table (free-text legacy values) — otherwise saving would silently
  // move the product to whatever option happens to be first in the list.
  const categoryOptions = (() => {
    const names = (categories ?? []).map((c) => c.name);
    if (product && !names.includes(product.category)) names.unshift(product.category);
    return names;
  })();

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo title={`Admin — Edit ${product?.name ?? sku}`} path={`/admin/products/${sku}/edit`} noIndex />

      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-6">
        <div className="flex items-center gap-4 max-w-4xl">
          <Link href="/admin/products">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Products
            </Button>
          </Link>
          <div className="h-5 w-px bg-slate-600" />
          <div>
            <h1 className="text-xl font-bold">Edit Product</h1>
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{sku}</p>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-4xl py-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Product Info */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <Package className="w-4 h-4 text-primary" /> Product Information
              </div>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} className="font-medium" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="supplier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier / Brand</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Marvin, Alcosupply, Strybuc…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Image URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Category */}
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-2 border-b">
                <FolderTree className="w-4 h-4 text-primary" /> Category
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormDescription>Determines which shop/category page this product appears on</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="subcategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Casement Operators" />
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
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/admin/products">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Save Changes</>
                )}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </div>
  );
}
