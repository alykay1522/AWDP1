import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSubmitPartsId } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, UploadCloud, CheckCircle2, Search, Camera, Wrench, AlertCircle, FileImage, X } from "lucide-react";

// The API schema definition
const partsIdSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  description: z.string().min(10, "Please provide some details about the part or where it came from"),
  windowDoorBrand: z.string().optional(),
  windowDoorAge: z.string().optional(),
  imageBase64: z.string().optional(),
  imageFileName: z.string().optional(),
});

type PartsIdFormValues = z.infer<typeof partsIdSchema>;

export default function PartsIdentification() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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

  const submitPartsIdMutation = useSubmitPartsId();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, etc).",
        variant: "destructive"
      });
      return;
    }

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImagePreview(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const onSubmit = async (data: PartsIdFormValues) => {
    // If we have an image, we need to convert it to base64
    if (selectedImage) {
      data.imageFileName = selectedImage.name;
      
      // We already have the base64 from the preview
      if (imagePreview) {
        // Strip the data:image/jpeg;base64, part for the API
        const base64Data = imagePreview.split(',')[1];
        data.imageBase64 = base64Data;
      }
    }

    submitPartsIdMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          setIsSubmitted(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        onError: () => {
          toast({
            title: "Submission failed",
            description: "There was a problem submitting your request. Please try again or call us.",
            variant: "destructive"
          });
        }
      }
    );
  };

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-3xl text-center">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-slate-900 mb-6">Request Received!</h1>
        <p className="text-xl text-slate-600 mb-8 leading-relaxed">
          Thank you for trusting All Window Door Parts. Our team of experts is reviewing your photo and details. 
          We typically identify parts and respond via email within 1-2 business days with a direct link to purchase your exact replacement.
        </p>
        <div className="bg-slate-50 border rounded-xl p-6 md:p-8 text-left max-w-xl mx-auto mb-10">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-primary" /> What happens next?</h3>
          <ol className="space-y-4 text-slate-600">
            <li className="flex gap-3">
              <span className="font-bold text-primary">1.</span>
              Our 40+ year veterans inspect your photos against thousands of known hardware profiles.
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">2.</span>
              We find the exact match (or the modern functional equivalent if your part is obsolete).
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-primary">3.</span>
              You receive an email with the part name, price, and a simple 1-click link to order.
            </li>
          </ol>
        </div>
        <Button size="lg" onClick={() => window.location.href = "/shop"}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo
        title="Free Parts Identification — Can't Find Your Part?"
        path="/parts-identification"
        description="Can't identify your window or door part? Submit photos and a description — our experts with 40+ years of experience will identify it for you. Free, no-obligation service from All Window Door Parts."
        keywords="window part identification, door part identification, free parts ID, identify window hardware, mystery window part, find replacement window part"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Free Parts Identification Service",
            provider: {
              "@type": "LocalBusiness",
              name: "All Window Door Parts",
              url: "https://www.allwindowdoorparts.com",
              telephone: "+17855330244",
            },
            serviceType: "Window and Door Parts Identification",
            description: "Send us photos of your window or door hardware and our experts with 40+ years of experience will identify the exact replacement part needed — free with no obligation.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Free parts identification service — no charge, no obligation",
            },
            areaServed: { "@type": "Country", name: "United States" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How does the Free Parts Identification service work?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Upload clear photos of your window or door part along with a brief description and any brand or age information you know. Our experts — with 40+ years of experience — will identify the exact replacement part and contact you with the answer. The service is completely free with no obligation to purchase."
                }
              },
              {
                "@type": "Question",
                name: "What types of parts can you identify?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We identify all types of window and door hardware including sash balances, casement operators, tilt latches, patio door rollers, hinges, locks, handles, weatherstripping, and obsolete or discontinued parts from the 1970s, 80s, and 90s. If it's a window or door part, we can almost certainly identify it."
                }
              },
              {
                "@type": "Question",
                name: "How long does it take to get an answer?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Most part identification requests are answered within 1–2 business days. For urgent needs, you can also call us directly at 785-533-0244."
                }
              },
              {
                "@type": "Question",
                name: "Is the parts identification service really free?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes — 100% free, no strings attached, and no obligation to buy anything. We offer this service because we want to help homeowners, contractors, and property managers find the right part the first time."
                }
              },
              {
                "@type": "Question",
                name: "What photos should I send for the best results?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Take photos in good lighting. Place a ruler or coin next to the part for scale. Show the broken or worn area clearly. If you see any stamped numbers, manufacturer logos, or model numbers on the part, photograph those too — they help us identify the part quickly and accurately."
                }
              },
              {
                "@type": "Question",
                name: "Can you help with obsolete or discontinued parts?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Absolutely — that's one of our specialties. We carry or know the modern replacements for thousands of discontinued parts from major manufacturers. Even if your window is 40–50 years old, there's a good chance we can find a compatible replacement."
                }
              }
            ]
          }
        ] as unknown as object}
      />
      {/* Hero Section */}
      <section className="bg-primary text-white py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1994&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-1.5 rounded-full text-sm font-bold shadow-md mb-8 uppercase tracking-wider">
            <Shield className="w-4 h-4" /> Free Service • No Obligation
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6">
            Not Sure What Part You Need?
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-2 font-medium">
            We'll Help You Figure It Out — FREE!
          </p>
          <p className="text-lg text-blue-200 mt-6 max-w-2xl mx-auto">
            Send us pictures of your needed parts. Our team with decades of industry experience will identify it and send you a link to buy the exact replacement parts or upgrade &ndash; completely free.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 -mt-10 relative z-20 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Main Form Area */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl border p-6 md:p-10">
            <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-3">
              <Search className="w-6 h-6 text-primary" /> Start Identification Request
            </h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* Photo Upload Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">1. Upload a Photo (Required)</h3>
                    <p className="text-sm text-slate-500 mb-4">Take a clear, well-lit photo of the broken part. If possible, show it next to a ruler or tape measure.</p>
                  </div>
                  
                  <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      isDragging ? 'border-primary bg-primary/5' : 
                      imagePreview ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-primary/50 bg-slate-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('photo-upload')?.click()}
                  >
                    <input 
                      type="file" 
                      id="photo-upload" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageChange}
                    />
                    
                    {imagePreview ? (
                      <div className="flex flex-col items-center">
                        <div className="relative w-full max-w-xs aspect-video bg-black/5 rounded-lg overflow-hidden mb-4 border">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            aria-label="Remove uploaded image"
                            className="absolute top-2 right-2 w-8 h-8 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImagePreview(null);
                              setSelectedImage(null);
                            }}
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                          <FileImage className="w-4 h-4 text-emerald-600" /> {selectedImage?.name}
                        </p>
                        <p className="text-xs text-primary mt-2 font-bold hover:underline">Click to change image</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center pointer-events-none">
                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                          <Camera className="w-8 h-8 text-slate-400" />
                        </div>
                        <h4 className="font-bold text-slate-900 mb-1">Click to upload or drag & drop</h4>
                        <p className="text-sm text-slate-500">SVG, PNG, JPG or GIF (max. 5MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Details Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">2. Part Details</h3>
                    <p className="text-sm text-slate-500 mb-4">Tell us everything you know. The more info, the faster we find it.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="windowDoorBrand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Window/Door Brand (if known)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Andersen, Pella, unknown" {...field} className="bg-slate-50" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="windowDoorAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approximate Age</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 15 years, installed in 2005" {...field} className="bg-slate-50" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description of the part and issue <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What is this part? Where does it go? What is broken? Are there any numbers stamped on it?" 
                            className="min-h-[120px] bg-slate-50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <hr className="border-slate-100" />

                {/* Contact Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">3. Where should we send the match?</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} className="bg-slate-50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} className="bg-slate-50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="md:w-1/2">
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="(555) 123-4567" {...field} className="bg-slate-50" />
                        </FormControl>
                        <FormDescription>We'll only call if we need more info to find your part.</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-14 text-lg font-bold shadow-md"
                  disabled={submitPartsIdMutation.isPending || (!selectedImage && !imagePreview)}
                >
                  {submitPartsIdMutation.isPending ? "Submitting..." : "Submit for Free Identification"}
                </Button>
                
                {!selectedImage && !imagePreview && (
                  <p className="text-center text-sm text-destructive font-medium mt-2">
                    Please upload a photo of your part to submit.
                  </p>
                )}
              </form>
            </Form>
          </div>

          {/* Sidebar Trust Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-primary text-white p-8 rounded-2xl shadow-lg">
              <Shield className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-2xl font-serif font-bold mb-4">Why use our free service?</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                  <div>
                    <strong className="block text-lg">Save Time & Money</strong>
                    <span className="text-blue-100 text-sm">Don't guess and order the wrong part. Let us get it right the first time.</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                  <div>
                    <strong className="block text-lg">Access to Obsolete Parts</strong>
                    <span className="text-blue-100 text-sm">We know the modern replacements for discontinued parts from the 70s, 80s, and 90s.</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                  <div>
                    <strong className="block text-lg">Veteran Expertise</strong>
                    <span className="text-blue-100 text-sm">Our staff has literally seen it all. 40+ years in the window and door business.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white border rounded-2xl p-8 text-center shadow-sm">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Photo Tips for Success</h3>
              <ul className="text-sm text-slate-600 space-y-2 text-left bg-slate-50 p-4 rounded-lg">
                <li>• Take photos in good lighting</li>
                <li>• Place a ruler or coin next to it for scale</li>
                <li>• Show the broken area clearly</li>
                <li>• Look for stamped numbers/logos and photograph them</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
