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
import {
  Shield,
  UploadCloud,
  CheckCircle2,
  Camera,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Home,
  DoorOpen,
  Wind,
  Grid2x2,
  Layers,
  Info,
  User,
} from "lucide-react";
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

type PartsIdResult = {
  success: boolean;
  ticketId?: string;
  message: string;
  imageStored?: boolean;
  notificationDelivered?: boolean;
};

const PART_TYPES = [
  { id: "casement", label: "Casement Window", Icon: Home, desc: "Side-hinged, crank to open" },
  { id: "double-hung", label: "Double-Hung Window", Icon: Layers, desc: "Top and bottom sashes slide" },
  { id: "sliding", label: "Sliding Window", Icon: Wind, desc: "Sash slides left or right" },
  { id: "patio-door", label: "Patio / Sliding Door", Icon: DoorOpen, desc: "Sliding glass door" },
  { id: "entry-door", label: "Entry Door", Icon: DoorOpen, desc: "Hinged exterior door" },
  { id: "screen", label: "Screen / Screen Door", Icon: Grid2x2, desc: "Window or door screen" },
  { id: "other", label: "Other / Not Sure", Icon: Shield, desc: "We will help identify it" },
];

const AGE_OPTIONS = [
  "Less than 5 years",
  "5–10 years",
  "10–20 years",
  "20–30 years",
  "30+ years",
  "Unknown",
];

const TOTAL_STEPS = 3;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 1.6 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image format could not be processed. Please use JPEG, PNG, or WebP."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the image for upload.")),
      "image/jpeg",
      quality,
    );
  });
}

async function prepareImage(file: File): Promise<{ dataUrl: string; fileName: string; byteSize: number }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Please select an image smaller than 10MB.");
  }

  const source = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(source.naturalWidth, source.naturalHeight));
  let width = Math.max(1, Math.round(source.naturalWidth * scale));
  let height = Math.max(1, Math.round(source.naturalHeight * scale));
  let quality = 0.86;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not process the image.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    blob = await canvasToBlob(canvas, quality);

    if (blob.size <= TARGET_IMAGE_BYTES) break;
    quality = Math.max(0.58, quality - 0.08);
    width = Math.max(900, Math.round(width * 0.86));
    height = Math.max(900, Math.round(height * 0.86));
  }

  if (!blob || blob.size > 2.3 * 1024 * 1024) {
    throw new Error("The photo is still too large after optimization. Please choose a smaller image.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 90) || "part-photo";
  return {
    dataUrl: await readAsDataUrl(blob),
    fileName: `${baseName}.jpg`,
    byteSize: blob.size,
  };
}

export default function PartsIdentification() {
  const [step, setStep] = useState(1);
  const [partType, setPartType] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | undefined>();
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageByteSize, setImageByteSize] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const form = useForm<PartsIdFormValues>({
    resolver: zodResolver(partsIdSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      description: "",
      windowDoorBrand: "",
      windowDoorAge: "",
    },
  });

  const submitMutation = useSubmitPartsId();

  const processFile = async (file: File) => {
    setIsProcessingImage(true);
    try {
      const prepared = await prepareImage(file);
      setSelectedImageName(prepared.fileName);
      setImagePreview(prepared.dataUrl);
      setImageByteSize(prepared.byteSize);
      toast({
        title: "Photo ready",
        description: "The photo was optimized and will be attached to your request.",
      });
    } catch (error) {
      setSelectedImageName(null);
      setImagePreview(null);
      setImageByteSize(0);
      toast({
        title: "Photo could not be added",
        description: error instanceof Error ? error.message : "Please choose a different image.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const advance = async () => {
    if (step === 1) {
      if (!partType) {
        toast({ title: "Choose a part type", description: "Select the closest window or door type.", variant: "destructive" });
        return;
      }
      if (!(await form.trigger("description"))) return;
    }
    if (step === 2 && isProcessingImage) return;
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  const onSubmit = async (values: PartsIdFormValues) => {
    if (isProcessingImage) {
      toast({ title: "Photo is still processing", description: "Please wait until the photo preview appears." });
      return;
    }

    const data: PartsIdFormValues = {
      ...values,
      description: `[${partType}] ${values.description}`,
      ...(imagePreview && selectedImageName
        ? { imageBase64: imagePreview, imageFileName: selectedImageName }
        : {}),
    };

    analytics.track("Parts ID Wizard Submitted", { partType, hasImage: Boolean(imagePreview), imageByteSize });

    try {
      const result = await submitMutation.mutateAsync({ data }) as PartsIdResult;
      if (imagePreview && result.imageStored === false) {
        throw new Error("The request was received, but the photo was not stored. Please try again.");
      }
      analytics.track("Parts ID Submission Success", {
        imageStored: result.imageStored ?? false,
        notificationDelivered: result.notificationDelivered ?? false,
      });
      setTicketId(result.ticketId);
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again or email info@allwindowdoorparts.com.",
        variant: "destructive",
      });
    }
  };

  if (isSubmitted) {
    return (
      <ErrorBoundary>
        <PageSeo title="Parts ID Request Submitted | Free Identification Service" description="Your free parts identification request has been submitted." />
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4">
          <div className="max-w-lg w-full text-center bg-white rounded-2xl shadow-lg p-10 border">
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-slate-900 mb-3">Your request was received</h1>
            {ticketId && <p className="font-mono text-sm text-slate-500 mb-3">Ticket: {ticketId}</p>}
            <p className="text-slate-600 mb-2">Your information{imagePreview ? " and photo were saved" : " was saved"} for our parts team.</p>
            <p className="text-slate-500 text-sm mb-8">We will review the request and contact you with the best available match.</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-600 mb-8 border">
              <p className="font-semibold text-slate-800 mb-1">Contact us:</p>
              <p>785-533-0244</p>
              <p>Info@allwindowdoorparts.com</p>
            </div>
            <Button size="lg" onClick={() => { window.location.href = "/"; }} className="w-full">Back to Home</Button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;
  const steps = [
    { number: 1, label: "Part Details", Icon: Info },
    { number: 2, label: "Photo", Icon: Camera },
    { number: 3, label: "Contact", Icon: User },
  ];

  return (
    <ErrorBoundary>
      <PageSeo
        title="Free Parts Identification Service | Identify Window & Door Parts"
        description="Upload a photo for free expert window and door parts identification."
      />
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Free Parts ID" }]} />

      <div className="bg-primary text-white py-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <Shield className="w-3.5 h-3.5" /> FREE PARTS IDENTIFICATION
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">Find My Part</h1>
        <p className="text-primary-foreground/80 max-w-xl mx-auto text-lg">Tell us about the part, attach a clear photo, and our team will help identify it.</p>
      </div>

      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="relative flex justify-between">
            <div className="absolute left-10 right-10 top-5 h-1 bg-slate-200">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            {steps.map(({ number, label, Icon }) => {
              const active = step === number;
              const complete = step > number;
              return (
                <div key={number} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${complete ? "bg-emerald-500 border-emerald-500 text-white" : active ? "bg-primary border-primary text-white" : "bg-white border-slate-300 text-slate-400"}`}>
                    {complete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-semibold ${active ? "text-primary" : "text-slate-500"}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-[60vh] bg-slate-50 py-10 px-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-serif font-bold text-slate-900">Tell us about the part</h2>
                <p className="text-slate-500 mt-1">Choose the closest type and describe what you need.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {PART_TYPES.map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPartType(id)}
                    className={`text-left rounded-xl border-2 p-4 transition-all ${partType === id ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-400"}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${partType === id ? "text-primary" : "text-slate-400"}`} />
                      <div><p className="font-semibold text-slate-900">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="bg-white border rounded-xl p-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Describe the part or problem</label>
                  <Textarea {...form.register("description")} rows={5} placeholder="Include color, measurements, markings, how it broke, and where it is installed." />
                  {form.formState.errors.description && <p className="text-red-600 text-sm mt-1">{form.formState.errors.description.message}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-semibold text-slate-800 mb-2">Brand</label><Input {...form.register("windowDoorBrand")} placeholder="Andersen, Pella, Marvin…" /></div>
                  <div><label className="block text-sm font-semibold text-slate-800 mb-2">Approximate age</label><select {...form.register("windowDoorAge")} className="w-full h-10 px-3 rounded-md border border-input bg-background"><option value="">Select age…</option>{AGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center"><h2 className="text-2xl font-serif font-bold text-slate-900">Upload a clear photo</h2><p className="text-slate-500 mt-1">The photo is optimized before submission so it reaches us reliably.</p></div>
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void processFile(file);
                    event.target.value = "";
                  }}
                />
                {isProcessingImage ? (
                  <div className="py-16 text-center"><Loader2 className="w-9 h-9 mx-auto animate-spin text-primary mb-3" /><p className="font-semibold text-slate-800">Preparing photo…</p><p className="text-sm text-slate-500">Do not continue until the preview appears.</p></div>
                ) : imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Uploaded part preview" className="w-full max-h-96 object-contain rounded-xl border bg-slate-50" />
                    <button type="button" onClick={() => { setSelectedImageName(null); setImagePreview(null); setImageByteSize(0); }} aria-label="Remove photo" className="absolute top-3 right-3 w-9 h-9 bg-white rounded-full border shadow flex items-center justify-center hover:bg-red-50"><X className="w-4 h-4" /></button>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm"><p className="text-emerald-700 font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Photo attached</p><p className="text-slate-500">{selectedImageName} · {(imageByteSize / 1024).toFixed(0)} KB</p></div>
                  </div>
                ) : (
                  <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => document.getElementById("photo-upload")?.click()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary hover:bg-slate-50"}`}>
                    <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-3" /><p className="font-semibold text-slate-800">Drop a photo here or click to browse</p><p className="text-sm text-slate-500 mt-1">JPEG, PNG, WebP, HEIC, or HEIF</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center"><h2 className="text-2xl font-serif font-bold text-slate-900">How should we contact you?</h2><p className="text-slate-500 mt-1">We use this information only to respond to your request.</p></div>
              <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                <div><label className="block text-sm font-semibold text-slate-800 mb-2">Name</label><Input {...form.register("name")} autoComplete="name" />{form.formState.errors.name && <p className="text-red-600 text-sm mt-1">{form.formState.errors.name.message}</p>}</div>
                <div><label className="block text-sm font-semibold text-slate-800 mb-2">Email</label><Input {...form.register("email")} type="email" autoComplete="email" />{form.formState.errors.email && <p className="text-red-600 text-sm mt-1">{form.formState.errors.email.message}</p>}</div>
                <div><label className="block text-sm font-semibold text-slate-800 mb-2">Phone <span className="font-normal text-slate-400">(optional)</span></label><Input {...form.register("phone")} type="tel" autoComplete="tel" /></div>
                <div className={`rounded-lg border p-3 text-sm ${imagePreview ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{imagePreview ? "Your photo is attached and will be saved with this request." : "No photo is attached. You can go back and add one before submitting."}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || submitMutation.isPending}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={() => void advance()} disabled={isProcessingImage}>Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
            ) : (
              <Button type="submit" disabled={submitMutation.isPending || isProcessingImage} className="min-w-44">{submitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : "Submit Parts ID Request"}</Button>
            )}
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}
