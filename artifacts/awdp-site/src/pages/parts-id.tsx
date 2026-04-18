import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSubmitPartsId } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, UploadCloud, CheckCircle2, Camera, X, Loader2, ChevronRight, ChevronLeft, Home, DoorOpen, Wind, Grid2x2, Layers } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";
import { analytics } from "@/lib/analytics";
import { Breadcrumb } from "@/components/breadcrumb";

const partsIdSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  description: z.string().min(10, "Please describe the part or problem"),
  windowDoorBrand: z.string().optional(),
  windowDoorAge: z.string().optional(),
  imageBase64: z.string().optional(),
  imageFileName: z.string().optional(),
});

type PartsIdFormValues = z.infer<typeof partsIdSchema>;

const PART_TYPES = [
  { id: "casement",    label: "Casement Window",      Icon: Home,      desc: "Side-hinged, crank to open" },
  { id: "double-hung", label: "Double-Hung Window",   Icon: Layers,    desc: "Top & bottom sashes slide" },
  { id: "sliding",     label: "Sliding Window",       Icon: Wind,      desc: "Sash slides left or right" },
  { id: "patio-door",  label: "Patio / Sliding Door", Icon: DoorOpen,  desc: "Sliding glass door" },
  { id: "entry-door",  label: "Entry Door",           Icon: DoorOpen,  desc: "Hinged exterior door" },
  { id: "screen",      label: "Screen / Screen Door", Icon: Grid2x2,   desc: "Window or door screen" },
  { id: "skylight",    label: "Skylight / Roof",      Icon: Camera,    desc: "Overhead window or vent" },
  { id: "other",       label: "Other / Not Sure",     Icon: Shield,    desc: "We'll figure it out together" },
];

const AGE_OPTIONS = [
  "Less than 5 years", "5–10 years", "10–20 years",
  "20–30 years", "30+ years", "Unknown",
];

const TOTAL_STEPS = 4;

export default function PartsIdentification() {
  const [step, setStep] = useState(1);
  const [partType, setPartType] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm<PartsIdFormValues>({
    resolver: zodResolver(partsIdSchema),
    defaultValues: { name: "", email: "", phone: "", description: "", windowDoorBrand: "", windowDoorAge: "" },
  });

  const submitMutation = useSubmitPartsId();

  // ── image helpers ─────────────────────────────────────────────────────
  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload an image file (JPEG, PNG, etc).", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => { if (e.target?.result) setImagePreview(e.target.result as string); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  // ── step navigation ───────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) return !!partType;
    if (step === 2) return form.watch("description")?.length >= 10;
    if (step === 3) return true; // photo optional
    return true;
  };

  const advance = async () => {
    if (step === 2) {
      const ok = await form.trigger(["description"]);
      if (!ok) return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const back = () => { if (step > 1) setStep(s => s - 1); };

  // ── submit ────────────────────────────────────────────────────────────
  const onSubmit = async (data: PartsIdFormValues) => {
    data.description = `[${partType}] ${data.description}`;
    if (selectedImage && imagePreview) {
      data.imageFileName = selectedImage.name;
      data.imageBase64 = imagePreview;
    }
    analytics.track("Parts ID Wizard Submitted", { partType, hasImage: !!selectedImage });
    submitMutation.mutate(
      { data },
      {
        onSuccess: () => {
          analytics.track("Parts ID Submission Success");
          setIsSubmitted(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
        onError: () => {
          toast({ title: "Submission failed", description: "Please try again or email info@allwindowdoorparts.com.", variant: "destructive" });
        },
      }
    );
  };

  // ── success screen ────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <ErrorBoundary>
        <PageSeo title="Request Submitted | All Window Door Parts" description="Your free parts identification request has been submitted." />
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4">
          <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-lg p-10 border">
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 mb-3">You're all set!</h1>
            <p className="text-slate-600 mb-2">We received your request and will identify your part — usually within 1 business day.</p>
            <p className="text-slate-500 text-sm mb-8">Check your inbox for a confirmation email. If you have photos to add, reply to that email.</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-600 mb-8 border">
              <p className="font-semibold text-slate-800 mb-1">In the meantime, you can also reach us at:</p>
              <p>📞 785-533-0244</p>
              <p>✉️ Info@allwindowdoorparts.com</p>
            </div>
            <Button size="lg" onClick={() => window.location.href = "/"} className="w-full">Back to Home</Button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ── progress bar ──────────────────────────────────────────────────────
  const progress = ((step - 1) / TOTAL_STEPS) * 100;

  const stepLabels = ["Part Type", "Describe It", "Add a Photo", "Your Info"];

  return (
    <ErrorBoundary>
      <PageSeo
        title="Free Parts Identification | All Window Door Parts"
        description="Can't find your part? Send us a photo and description — our experts identify any window or door part for free, usually within 1 business day."
      />

      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Free Parts ID" }]} />

      {/* Header */}
      <div className="bg-primary text-white py-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Shield className="w-3.5 h-3.5" /> FREE SERVICE — NO CHARGE EVER
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">Find My Part — Free</h1>
        <p className="text-primary-foreground/80 max-w-xl mx-auto text-lg">
          Answer 4 quick questions and we'll identify your exact part — usually within 1 business day.
        </p>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-slate-200 sticky top-[72px] z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const isActive = step === n;
              const isDone = step > n;
              return (
                <div key={n} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors
                    ${isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : n}
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? "text-primary font-semibold" : isDone ? "text-emerald-600" : "text-slate-400"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Wizard body */}
      <div className="min-h-[60vh] bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ── STEP 1: Part Type ── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">What type of window or door?</h2>
              <p className="text-slate-500 text-center mb-8">Pick the closest match — not sure is totally fine.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PART_TYPES.map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPartType(id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md
                      ${partType === id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-slate-200 bg-white hover:border-primary/40"}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${partType === id ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="font-semibold text-slate-900 text-sm leading-tight mb-1">{label}</div>
                    <div className="text-xs text-slate-400 leading-snug">{desc}</div>
                    {partType === id && (
                      <div className="mt-2 flex items-center gap-1 text-primary text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Describe ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">Describe the part or problem</h2>
              <p className="text-slate-500 text-center mb-8">The more detail, the faster we can identify it. Photos welcome in step 3.</p>
              <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Describe the part or what's broken <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    {...form.register("description")}
                    rows={5}
                    placeholder={`e.g. "The crank handle on my casement window broke off. The window is about 15 years old. The operator has a worm gear style and the arm is about 7 inches long."`}
                    className="resize-none text-base"
                  />
                  {form.formState.errors.description && (
                    <p className="text-red-500 text-sm mt-1">{form.formState.errors.description.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Describe color, size, material, how it broke — anything helps.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Window / Door Brand</label>
                    <Input
                      {...form.register("windowDoorBrand")}
                      placeholder="e.g. Andersen, Pella, Marvin…"
                      className="text-base"
                    />
                    <p className="text-xs text-slate-400 mt-1">Check the frame or any stickers for a brand name.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Approximate Age</label>
                    <select
                      {...form.register("windowDoorAge")}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select age…</option>
                      {AGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Photo ── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">Add a photo <span className="text-slate-400 font-normal text-xl">(optional but very helpful)</span></h2>
              <p className="text-slate-500 text-center mb-8">A clear photo of the broken part — even just with your phone — cuts identification time in half.</p>
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Uploaded part" className="w-full max-h-72 object-contain rounded-xl border bg-slate-50" />
                    <button
                      type="button"
                      onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                      className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full border shadow flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                    <p className="text-sm text-emerald-600 font-semibold mt-3 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> {selectedImage?.name} uploaded
                    </p>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                      ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary hover:bg-slate-50"}`}
                    onClick={() => document.getElementById("photo-upload")?.click()}
                  >
                    <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-700 font-semibold mb-1">Drop a photo here or click to browse</p>
                    <p className="text-sm text-slate-400">JPEG, PNG, HEIC — max 5 MB</p>
                    <input id="photo-upload" type="file" accept="image/*" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
                  </div>
                )}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Tips for a great photo:</strong> Good lighting, close-up of the part number/label if visible, show any damage clearly.
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Contact ── */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">Almost done — how do we reach you?</h2>
              <p className="text-slate-500 text-center mb-8">We'll email you the part match and a direct link to order. No spam, ever.</p>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Full Name <span className="text-red-500">*</span></label>
                    <Input {...form.register("name")} placeholder="Your name" className="text-base" />
                    {form.formState.errors.name && <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Email Address <span className="text-red-500">*</span></label>
                    <Input {...form.register("email")} type="email" placeholder="you@example.com" className="text-base" />
                    {form.formState.errors.email && <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                    <Input {...form.register("phone")} type="tel" placeholder="(555) 555-5555" className="text-base" />
                    <p className="text-xs text-slate-400 mt-1">We may call for tricky identifications — only if you provide it.</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-50 rounded-xl border p-4 mb-6 text-sm text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800 mb-2">Your request summary:</p>
                  <p>🪟 <strong>Type:</strong> {PART_TYPES.find(t => t.id === partType)?.label}</p>
                  {form.watch("windowDoorBrand") && <p>🏷️ <strong>Brand:</strong> {form.watch("windowDoorBrand")}</p>}
                  {form.watch("windowDoorAge") && <p>📅 <strong>Age:</strong> {form.watch("windowDoorAge")}</p>}
                  <p>📝 <strong>Description:</strong> {form.watch("description")?.slice(0, 80)}{(form.watch("description")?.length ?? 0) > 80 ? "…" : ""}</p>
                  {selectedImage && <p>📷 <strong>Photo:</strong> {selectedImage.name}</p>}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-lg py-6 font-bold"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                  ) : (
                    <><UploadCloud className="w-5 h-5 mr-2" /> Submit Free Parts ID Request</>
                  )}
                </Button>
                <p className="text-center text-xs text-slate-400 mt-3">
                  Free service. No obligation. We respond within 1 business day.
                </p>
              </form>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 4 && (
            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={back} disabled={step === 1} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={advance} disabled={!canAdvance()} className="gap-2 px-8">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          {step === 4 && (
            <div className="mt-4">
              <Button variant="outline" onClick={back} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom trust strip */}
      <div className="bg-white border-t py-8 px-4">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-6 text-center text-sm text-slate-500">
          <div><Shield className="w-6 h-6 mx-auto text-primary mb-1" /><p className="font-semibold text-slate-700">Always Free</p><p>No charge, ever</p></div>
          <div><CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1" /><p className="font-semibold text-slate-700">Expert ID</p><p>40+ years experience</p></div>
          <div><Camera className="w-6 h-6 mx-auto text-amber-500 mb-1" /><p className="font-semibold text-slate-700">Fast Response</p><p>Usually 1 business day</p></div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
