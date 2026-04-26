import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save, Loader2, CheckCircle2, Home, User, Shield,
  ChevronDown, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type Settings = Record<string, string>;

type Tab = "homepage" | "about" | "policies";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">{icon} {title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-6 space-y-5">{children}</div>}
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ── Content defaults (mirrors server DEFAULT_SETTINGS) ────────────────────────

const DEFAULTS: Settings = {
  heroHeadline: "America's Most Trusted Window & Door Parts Supplier",
  heroSubheadline: "From obsolete casement operators to hard-to-find sash balances — we've stocked and shipped the parts big-box stores can't. Veteran-owned, 40+ years experience.",
  heroBadge: "Veteran Owned & Operated",
  heroCtaShop: "Shop All Parts Now",
  heroCtaPartsId: "Free Parts ID Service",
  aboutHeroTitle: "40+ Years of Hardware Expertise",
  aboutHeroSubtitle: "We are America's trusted source for replacement window and door parts. We don't just sell hardware; we solve problems.",
  aboutStoryP1: "Our AllWindowDoorParts GROUP USA was built by industry veterans—not executives in a boardroom. With over 40 years of hands-on experience in construction, remodeling and fenestration, we've dealt with every kind of window and door hardware challenge.",
  aboutStoryP2: "We have helped D.I.Y. homeowners, contractors big and small wasting precious time searching for parts that were discontinued, redesigned, or impossible to find in hardware stores and big box stores. So, we created a company dedicated to solving that problem.",
  aboutStoryP3: "If a part exists, we can get it. If it doesn't, we know the right modern replacement—or can confirm and save you time wasted when something is truly no longer available.",
  aboutExpertiseTitle: "Unmatched Expertise",
  aboutExpertiseText: "Our team has over 40 years of hands-on experience. We know Casement, Awning, Single/Double Hung and slider windows inside and out.",
  aboutVeteranTitle: "Veteran Owned",
  aboutVeteranText: "Operated with the same integrity, precision, and dedication to service that we learned in the military.",
  aboutInventoryTitle: "Massive Inventory",
  aboutInventoryText: "We stock thousands of parts from hundreds of manufacturers, including rare and hard-to-find components.",
  aboutCtaTitle: "Ready to fix that window or door?",
  aboutCtaText: "Browse our catalog or let our experts find the exact part you need for free.",
  policyShippingMain: "Shipping costs are calculated automatically during checkout based on your delivery address, package weight, and dimensions. There is no guarantee that orders will ship immediately — some items may need to be sourced from our distributors first. We will contact you if additional lead time is required.",
  policyShippingObsolete: "We specialize in hard-to-find and obsolete window and door parts. Shipping times for these items may vary and could take longer than standard estimates. We will contact you if your order requires additional lead time.",
  policyShippingNote: "We ship via UPS, FedEx, and/or USPS. You do not need to complete a purchase to view shipping charges — they are shown before you pay.",
  policyReturnsWarning: "Most items are special order and cannot be returned.",
  policyReturnsBody: "Special order items — which include most items shown and offered on our sites — are sourced specifically for your order through our national distribution network and are non-returnable and non-exchangeable.\n\nCustom-cut weatherstripping and any items cut-to-length are also non-returnable.\n\nIf you are unsure whether an item is a special order, please contact us before purchasing. Our experts will confirm compatibility and let you know the ordering terms.",
  policySecurity: "Security is a very important part of having a safe and enjoyable online experience. We use the latest technology to protect all of the information you send and receive during the checkout process...",
  policyGuarantee: "Under the Fair Credit Billing Act, your bank cannot hold you liable for more than $50 of fraudulent charges...",
};

// ── Tab content components ────────────────────────────────────────────────────

function HomepageTab({ form, set }: { form: Settings; set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Hero Section" icon={<Home className="w-4 h-4 text-primary" />}>
        <Field label="Veteran Badge Text" hint="Small badge above the headline">
          <Input value={form.heroBadge ?? ""} onChange={set("heroBadge")} placeholder="Veteran Owned & Operated" />
        </Field>
        <Field label="Hero Headline" hint="Main H1 — largest text on the page">
          <Input value={form.heroHeadline ?? ""} onChange={set("heroHeadline")} placeholder="America's Most Trusted Window & Door Parts Supplier" />
        </Field>
        <Field label="Hero Subheadline" hint="Supporting text under the headline">
          <Textarea rows={3} value={form.heroSubheadline ?? ""} onChange={set("heroSubheadline")} placeholder="From obsolete casement operators..." />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Primary CTA Button" hint="Main shop button text">
            <Input value={form.heroCtaShop ?? ""} onChange={set("heroCtaShop")} placeholder="Shop All Parts Now" />
          </Field>
          <Field label="Secondary CTA Button" hint="Free Parts ID button text">
            <Input value={form.heroCtaPartsId ?? ""} onChange={set("heroCtaPartsId")} placeholder="Free Parts ID Service" />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function AboutTab({ form, set }: { form: Settings; set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Hero Section" icon={<User className="w-4 h-4 text-primary" />}>
        <Field label="Hero Title">
          <Input value={form.aboutHeroTitle ?? ""} onChange={set("aboutHeroTitle")} />
        </Field>
        <Field label="Hero Subtitle">
          <Textarea rows={2} value={form.aboutHeroSubtitle ?? ""} onChange={set("aboutHeroSubtitle")} />
        </Field>
      </Section>

      <Section title="Our Story" icon={<User className="w-4 h-4 text-slate-500" />}>
        <Field label="Paragraph 1">
          <Textarea rows={4} value={form.aboutStoryP1 ?? ""} onChange={set("aboutStoryP1")} />
        </Field>
        <Field label="Paragraph 2">
          <Textarea rows={4} value={form.aboutStoryP2 ?? ""} onChange={set("aboutStoryP2")} />
        </Field>
        <Field label="Paragraph 3">
          <Textarea rows={4} value={form.aboutStoryP3 ?? ""} onChange={set("aboutStoryP3")} />
        </Field>
      </Section>

      <Section title="Value Cards" icon={<User className="w-4 h-4 text-slate-500" />}>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Card 1</p>
            <Field label="Title">
              <Input value={form.aboutExpertiseTitle ?? ""} onChange={set("aboutExpertiseTitle")} />
            </Field>
            <Field label="Body">
              <Textarea rows={3} value={form.aboutExpertiseText ?? ""} onChange={set("aboutExpertiseText")} />
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Card 2 (highlighted)</p>
            <Field label="Title">
              <Input value={form.aboutVeteranTitle ?? ""} onChange={set("aboutVeteranTitle")} />
            </Field>
            <Field label="Body">
              <Textarea rows={3} value={form.aboutVeteranText ?? ""} onChange={set("aboutVeteranText")} />
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Card 3</p>
            <Field label="Title">
              <Input value={form.aboutInventoryTitle ?? ""} onChange={set("aboutInventoryTitle")} />
            </Field>
            <Field label="Body">
              <Textarea rows={3} value={form.aboutInventoryText ?? ""} onChange={set("aboutInventoryText")} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Call to Action" icon={<User className="w-4 h-4 text-slate-500" />}>
        <Field label="Title">
          <Input value={form.aboutCtaTitle ?? ""} onChange={set("aboutCtaTitle")} />
        </Field>
        <Field label="Supporting Text">
          <Textarea rows={2} value={form.aboutCtaText ?? ""} onChange={set("aboutCtaText")} />
        </Field>
      </Section>
    </div>
  );
}

function PoliciesTab({ form, set }: { form: Settings; set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Shipping Policy" icon={<Shield className="w-4 h-4 text-primary" />}>
        <Field label="Main Notice" hint="Shown in the info box at the top of the shipping section">
          <Textarea rows={4} value={form.policyShippingMain ?? ""} onChange={set("policyShippingMain")} />
        </Field>
        <Field label="Hard-to-Find Parts Notice" hint="Shown in the amber warning box">
          <Textarea rows={3} value={form.policyShippingObsolete ?? ""} onChange={set("policyShippingObsolete")} />
        </Field>
        <Field label="Footer Note" hint="Plain note at the bottom of the shipping section">
          <Textarea rows={2} value={form.policyShippingNote ?? ""} onChange={set("policyShippingNote")} />
        </Field>
      </Section>

      <Section title="Return Policy" icon={<Shield className="w-4 h-4 text-amber-500" />}>
        <Field label="Warning Banner Text" hint="Shown in the red alert box">
          <Input value={form.policyReturnsWarning ?? ""} onChange={set("policyReturnsWarning")} />
        </Field>
        <Field label="Return Policy Body" hint="Use blank lines to separate paragraphs">
          <Textarea rows={8} value={form.policyReturnsBody ?? ""} onChange={set("policyReturnsBody")} />
        </Field>
      </Section>

      <Section title="Security Notice" icon={<Shield className="w-4 h-4 text-emerald-500" />}>
        <Field label="Security Notice Text" hint="Use blank lines to separate paragraphs">
          <Textarea rows={8} value={form.policySecurity ?? ""} onChange={set("policySecurity")} />
        </Field>
      </Section>

      <Section title="Guarantee Details" icon={<Shield className="w-4 h-4 text-blue-500" />}>
        <Field label="Guarantee Text">
          <Textarea rows={5} value={form.policyGuarantee ?? ""} onChange={set("policyGuarantee")} />
        </Field>
      </Section>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode; href: string }[] = [
  { id: "homepage", label: "Homepage", icon: <Home className="w-4 h-4" />, href: "/" },
  { id: "about",    label: "About Page", icon: <User className="w-4 h-4" />, href: "/about" },
  { id: "policies", label: "Policies Page", icon: <Shield className="w-4 h-4" />, href: "/policies" },
];

export default function AdminContent() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("homepage");
  const [form, setForm] = useState<Settings>({ ...DEFAULTS });
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
    if (data?.settings) setForm((prev) => ({ ...prev, ...data.settings }));
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
      qc.invalidateQueries({ queryKey: ["site-content"] });
      if (data.settings) setForm((prev) => ({ ...prev, ...data.settings }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Content saved", description: "Changes are now live on the site." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = useCallback(
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
    []
  );

  const handleSave = () => mutation.mutate(form);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Site Content Editor</h1>
          <p className="text-slate-400 text-sm mt-0.5">Edit the text and copy on public-facing pages</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> :
           saved ? <CheckCircle2 className="w-4 h-4" /> :
           <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 md:p-8 max-w-4xl space-y-5">
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          Editing the <strong>{TABS.find((t) => t.id === activeTab)?.label}</strong> — changes go live as soon as you save.
        </div>

        {activeTab === "homepage" && <HomepageTab form={form} set={set} />}
        {activeTab === "about"    && <AboutTab    form={form} set={set} />}
        {activeTab === "policies" && <PoliciesTab form={form} set={set} />}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
