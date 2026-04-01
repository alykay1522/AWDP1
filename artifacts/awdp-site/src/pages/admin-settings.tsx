import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save, Phone, Mail, MapPin, DollarSign, Megaphone,
  Globe, Loader2, CheckCircle2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface Settings {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  orderMinimum: string;
  bannerEnabled: string;
  bannerText: string;
  metaDescription: string;
  freeShippingThreshold: string;
  taxRate: string;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b text-sm font-semibold text-slate-700">
        {icon} {title}
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>({
    businessName: "All Window Door Parts",
    phone: "785-533-0244",
    email: "Info@allwindowdoorparts.com",
    address: "",
    orderMinimum: "50",
    bannerEnabled: "false",
    bannerText: "",
    metaDescription: "",
    freeShippingThreshold: "0",
    taxRate: "0",
  });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<{ settings: Settings }>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (updates: Settings) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Save failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      if (data.settings) setForm(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Site Settings</h1>
          <p className="text-slate-400 text-sm">Control business info, order rules, and display settings</p>
        </div>
        <Button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
           saved ? <CheckCircle2 className="w-4 h-4" /> :
           <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save All Changes"}
        </Button>
      </div>

      <div className="p-6 md:p-8 max-w-3xl space-y-6">

        <Section title="Business Information" icon={<Phone className="w-4 h-4 text-primary" />}>
          <Field label="Business Name">
            <Input value={form.businessName} onChange={set("businessName")} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Phone Number" hint="Displayed in the site header and footer">
              <Input value={form.phone} onChange={set("phone")} placeholder="785-533-0244" />
            </Field>
            <Field label="Email Address">
              <Input value={form.email} onChange={set("email")} type="email" />
            </Field>
          </div>
          <Field label="Business Address" hint="Optional — used for structured data (Google)">
            <Input value={form.address} onChange={set("address")} placeholder="123 Main St, City, KS 12345" />
          </Field>
        </Section>

        <Section title="Order Settings" icon={<DollarSign className="w-4 h-4 text-primary" />}>
          <Field label="Minimum Order Amount ($)" hint="Orders below this amount will be blocked from checkout">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input value={form.orderMinimum} onChange={set("orderMinimum")} type="number" min="0" step="1" className="pl-7 max-w-xs" />
            </div>
          </Field>
          <Field label="Free Shipping Threshold ($)" hint="Set to 0 to disable free shipping offers">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input value={form.freeShippingThreshold} onChange={set("freeShippingThreshold")} type="number" min="0" step="1" className="pl-7 max-w-xs" />
            </div>
          </Field>
          <Field label="Tax Rate (%)" hint="Set to 0 if tax is handled by your payment processor">
            <div className="relative">
              <Input value={form.taxRate} onChange={set("taxRate")} type="number" min="0" step="0.01" max="100" className="max-w-xs pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </Field>
        </Section>

        <Section title="Announcement Banner" icon={<Megaphone className="w-4 h-4 text-primary" />}>
          <Field label="Show Announcement Banner">
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, bannerEnabled: prev.bannerEnabled === "true" ? "false" : "true" }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.bannerEnabled === "true" ? "bg-primary" : "bg-slate-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.bannerEnabled === "true" ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm text-slate-600">{form.bannerEnabled === "true" ? "Banner is visible to customers" : "Banner is hidden"}</span>
            </div>
          </Field>
          <Field label="Banner Text" hint="Shown at the top of every page when banner is enabled">
            <Input
              value={form.bannerText}
              onChange={set("bannerText")}
              placeholder="Free shipping on orders over $150! · Call 785-533-0244"
              disabled={form.bannerEnabled !== "true"}
            />
          </Field>
          {form.bannerEnabled === "true" && form.bannerText && (
            <div className="bg-primary text-white text-sm text-center py-2 px-4 rounded-lg font-medium">
              Preview: {form.bannerText}
            </div>
          )}
        </Section>

        <Section title="SEO / Meta" icon={<Globe className="w-4 h-4 text-primary" />}>
          <Field label="Default Meta Description" hint="Used on the homepage and as a fallback for other pages">
            <Textarea
              value={form.metaDescription}
              onChange={set("metaDescription")}
              rows={3}
              maxLength={160}
              placeholder="All Window Door Parts — veteran-owned supplier…"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.metaDescription.length}/160 characters</p>
          </Field>
        </Section>

        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span>Changes to order minimum and banner take effect immediately. Phone/email updates require a site redeploy to appear in the header.</span>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
