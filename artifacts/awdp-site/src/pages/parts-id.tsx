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
import { Shield, UploadCloud, CheckCircle2, Camera, X, Loader2, ChevronRight, ChevronLeft, Home, DoorOpen, Wind, Grid2x2, Layers, Circle, Info, User, ChevronDown, ChevronUp, AlertCircle, Lightbulb, Sparkles, AlertTriangle, Sun, Ruler, Eye } from "lucide-react";
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

const TOTAL_STEPS = 3;

export default function PartsIdentification() {
  const [step, setStep] = useState(1);
  const [partType, setPartType] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPhotoExamples, setShowPhotoExamples] = useState(false);

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
    if (step === 1) return !!partType && form.watch("description")?.length >= 10;
    if (step === 2) return true; // photo optional
    return true;
  };

  const advance = async () => {
    if (step === 1) {
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

    try {
      await submitMutation.mutateAsync({ data });
      analytics.track("Parts ID Submission Success");
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast({ title: "Submission failed", description: "Please try again or email info@allwindowdoorparts.com.", variant: "destructive" });
    }
  };

  // ── success screen ────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <ErrorBoundary>
        <PageSeo title="Parts ID Request Submitted | Free Identification Service" description="Your free parts identification request has been submitted. Our experts will identify your window or door part as soon as possible." />
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4">
          <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-lg p-10 border">
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 mb-3">You're all set!</h1>
            <p className="text-slate-600 mb-2">We received your request and will identify your part as soon as possible.</p>
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

  const steps = [
    { number: 1, label: "Tell Us About Your Part", description: "Part type & description", icon: Info },
    { number: 2, label: "Upload a Photo", description: "Optional but helpful", icon: Camera },
    { number: 3, label: "Your Contact Info", description: "How we reach you", icon: User },
  ];

  return (
    <ErrorBoundary>
      <PageSeo
        title="Free Parts Identification Service | Identify Window & Door Parts"
        description="Can't identify your window or door part? Upload a photo for free expert identification. We respond as soon as possible. Veteran-owned, 40+ years experience. No obligation."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Free Parts Identification Service",
          "provider": {
            "@type": "LocalBusiness",
            "name": "All Window Door Parts",
            "telephone": "+17855330244",
            "email": "Info@allwindowdoorparts.com",
            "url": "https://www.allwindowdoorparts.com"
          },
          "description": "Send us a photo of your window or door hardware and our experts will identify the correct replacement part — free of charge. We respond as soon as possible.",
          "serviceType": "Parts Identification",
          "areaServed": "USA",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "name": "Free Parts Identification"
          }
        }}
      />

      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Free Parts ID" }]} />

      {/* Header */}
      <div className="bg-primary text-white py-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Shield className="w-3.5 h-3.5" /> FREE SERVICE — NO CHARGE EVER
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">Find My Part — Free</h1>
        <p className="text-primary-foreground/80 max-w-xl mx-auto text-lg">
          Answer 3 quick questions and we'll identify your exact part — we respond as soon as possible.
        </p>
      </div>

      {/* Step indicator - Enhanced Visual Funnel */}
      <div className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 sticky top-[72px] z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-12 left-0 right-0 h-1 bg-slate-200 -z-10">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-primary to-slate-200 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {steps.map((stepData, i) => {
              const isActive = step === stepData.number;

              const isDone = step > stepData.number;
              const Icon = stepData.icon;
              return (
                <div key={stepData.number} className="flex flex-col items-center flex-1 relative z-10">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500
                    ${isDone ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110" : isActive ? "bg-primary text-white shadow-lg shadow-primary/30 scale-110" : "bg-white border-3 border-slate-200 text-slate-300"}`}>
                    {isDone ? <CheckCircle2 className="w-10 h-10" /> : isActive ? <Icon className="w-10 h-10" /> : <span className="text-2xl font-bold">{stepData.number}</span>}
                  </div>
                  <div className="mt-3 text-center">
                    <h3 className={`font-bold text-sm mb-1 transition-colors ${isActive ? "text-primary" : isDone ? "text-emerald-600" : "text-slate-400"}`}>
                      {stepData.label}
                    </h3>
                    <p className={`text-xs transition-colors ${isActive ? "text-slate-700 font-medium" : isDone ? "text-slate-600" : "text-slate-400"}`}>
                      {stepData.description}
                    </p>
                  </div>
                  {isActive && <div className="mt-2 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                </div>
              );
            })}
          </div>

          {/* Progress percentage */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
              <div className="w-full bg-slate-100 rounded-full h-2 w-32">
                <div
                  className="bg-gradient-to-r from-primary to-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {Math.round(progress)}% Complete
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard body */}
      <div className="min-h-[60vh] bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ── STEP 1: Tell Us About Your Part (Part Type + Description) ── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">Tell Us About Your Part</h2>
              <p className="text-slate-500 text-center mb-8">First, select your part type, then describe the issue.</p>

              {/* Part Type Selection */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">What type of window or door?</h3>
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

              {/* Description Form */}
              {partType && (
                <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Describe the part or what's broken <span className="text-red-500">*</span></label>
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
              )}
            </div>
          )}

          {/* ── STEP 2: Upload a Photo ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 text-center">Upload a Photo</h2>
              <p className="text-slate-500 text-center mb-8">A clear photo of the broken part — even just with your phone — cuts identification time in half. (Optional but very helpful)</p>
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
                  <div>
                    {/* Hidden file input — required for click-to-browse to work */}
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processFile(file);
                        // Reset so same file can be re-selected
                        e.target.value = "";
                      }}
                    />
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                        ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary hover:bg-slate-50"}`}
                      onClick={() => document.getElementById("photo-upload")?.click()}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <UploadCloud className="w-8 h-8 text-slate-400" />
                        <p className="font-medium text-slate-700">Drag and drop your photo here</p>
                        <p className="text-sm text-slate-500">or click to browse</p>
                        <p className="text-xs text-slate-400">JPEG, PNG, WebP up to 5MB</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo Examples Section - Collapsible */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setShowPhotoExamples(!showPhotoExamples)}
                    className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <div className="text-left">
                          <p className="font-semibold text-blue-900">Photo Tips & Examples</p>
                          <p className="text-xs text-blue-600">See what makes a good photo</p>
                        </div>
                      </div>
                    </div>
                    {showPhotoExamples ? (
                      <ChevronUp className="w-5 h-5 text-blue-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-blue-500" />
                    )}
                  </button>

                  {showPhotoExamples && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Good Photo Examples */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h3 className="font-semibold text-emerald-900">Good Photo Examples ✨</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Example 1: Clear, well-lit */}
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-emerald-300">
                              <div className="text-center">
                                <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                                <Sun className="w-6 h-6 text-amber-400 mx-auto" />
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Clear, well-lit photo showing the entire part</p>
                          </div>
                          {/* Example 2: Reference object */}
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-emerald-300">
                              <div className="text-center relative">
                                <Camera className="w-8 h-8 text-emerald-500" />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center">
                                  <Ruler className="w-3 h-3 text-slate-600" />
                                </div>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Photo with a reference object (ruler/coin) for scale</p>
                          </div>
                          {/* Example 3: Markings */}
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-emerald-300">
                              <div className="text-center">
                                <Eye className="w-8 h-8 text-emerald-500" />
                                <div className="flex gap-1 mt-1">
                                  <div className="w-3 h-3 bg-emerald-400 rounded-sm"></div>
                                  <div className="w-3 h-3 bg-emerald-400 rounded-sm"></div>
                                  <div className="w-3 h-3 bg-emerald-400 rounded-sm"></div>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Photo showing any markings or stamps on the part</p>
                          </div>
                          {/* Example 4: Multiple angles */}
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="aspect-video bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-emerald-300">
                              <div className="flex gap-2">
                                <div className="w-12 h-12 bg-emerald-200 rounded-lg flex items-center justify-center">
                                  <Camera className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="w-12 h-12 bg-emerald-300 rounded-lg flex items-center justify-center">
                                  <Camera className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="w-12 h-12 bg-emerald-200 rounded-lg flex items-center justify-center">
                                  <Camera className="w-5 h-5 text-emerald-600" />
                                </div>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Multiple angles if needed</p>
                          </div>
                        </div>
                      </div>

                      {/* Bad Photo Examples */}
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <h3 className="font-semibold text-red-900">Avoid These ❌</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Bad 1: Blurry */}
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="aspect-video bg-gradient-to-br from-red-100 to-red-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-red-300">
                              <div className="text-center filter blur-sm">
                                <Camera className="w-8 h-8 text-red-400" />
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Blurry or out-of-focus photos</p>
                          </div>
                          {/* Bad 2: Dark */}
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-red-300">
                              <div className="text-center opacity-30">
                                <Camera className="w-8 h-8 text-slate-400" />
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Photos that are too dark or have poor lighting</p>
                          </div>
                          {/* Bad 3: Small portion */}
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="aspect-video bg-gradient-to-br from-red-100 to-red-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-red-300">
                              <div className="w-8 h-8 bg-red-200 rounded-lg flex items-center justify-center">
                                <Camera className="w-4 h-4 text-red-400" />
                              </div>
                            </div>
                            <p className="text-xs font-medium text-slate-700">Photos that only show a small portion of the part</p>
                          </div>
                          {/* Bad 4: Glare */}
                          <div className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="aspect-video bg-gradient-to-br from-red-100 to-red-50 rounded-lg mb-2 flex items-center justify-center border-2 border-dashed border-red-300 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent"></div>
                              <Camera className="w-8 h-8 text-red-400 relative" />
                            </div>
                            <p className="text-xs font-medium text-slate-700">Photos with glare or reflections</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="w-5 h-5 text-amber-600" />
                          <h3 className="font-semibold text-amber-900">Quick Tips 💡</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-amber-800">
                          <li className="flex items-start gap-2">
                            <Sun className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <span>Use good lighting — natural light or a well-lit room works best</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Ruler className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <span>Include something for scale (ruler, coin, pen) if possible</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Eye className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <span>Show any markings, stamps, or model numbers clearly</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Camera className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <span>Take multiple angles if the part is complex</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Your Contact Info ── */}
          {step === 3 && (
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

                {/* Summary - fixed conditional rendering to avoid esbuild JSX parse issues */}
                <div className="bg-slate-50 rounded-xl border p-4 mb-6 text-sm text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800 mb-2">Your request summary:</p>
                  <p>🪟 <strong>Type:</strong> {PART_TYPES.find(t => t.id === partType)?.label}</p>
                  {form.watch("windowDoorBrand") ? <p>🏷️ <strong>Brand:</strong> {form.watch("windowDoorBrand")}</p> : null}
                  {form.watch("windowDoorAge") ? <p>📅 <strong>Age:</strong> {form.watch("windowDoorAge")}</p> : null}
                  <p>📝 <strong>Description:</strong> {form.watch("description")?.slice(0, 80)}{(form.watch("description")?.length ?? 0) > 80 ? "…" : ""}</p>
                  {selectedImage ? <p>📷 <strong>Photo:</strong> {selectedImage.name}</p> : null}
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
                  Free service. No obligation. We respond to parts ID requests as soon as possible. Please don't send multiple requests unless you're inquiring about more than one item.
                </p>
              </form>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 3 && (
            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={back} disabled={step === 1} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={advance} disabled={!canAdvance()} className="gap-2 px-8">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          {step === 3 && (
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
          <div><Camera className="w-6 h-6 mx-auto text-amber-500 mb-1" /><p className="font-semibold text-slate-700">Fast Response</p><p>We respond as soon as possible</p></div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
