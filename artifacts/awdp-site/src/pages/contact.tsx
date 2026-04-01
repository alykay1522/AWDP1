import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSubmitContact } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(10, "Please provide more details in your message"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const submitContactMutation = useSubmitContact();

  const onSubmit = (data: ContactFormValues) => {
    submitContactMutation.mutate(
      { data },
      {
        onSuccess: () => {
          setIsSubmitted(true);
        },
        onError: () => {
          toast({
            title: "Error sending message",
            description: "Please try again or call us directly.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20">
      <PageSeo
        title="Contact Us"
        path="/contact"
        description="Contact All Window Door Parts at 785-533-0244 or Info@allwindowdoorparts.com. Veteran-owned window and door parts supplier. We're here to help you find the right part."
      />
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">Contact Us</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            We're here to help with your window and door hardware needs. Reach out to our veteran-owned team for expert assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-8">
              <h3 className="text-xl font-serif font-bold text-slate-900 mb-6 border-b pb-4">Get In Touch</h3>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-1">Phone</h4>
                    <a href="tel:785-533-0244" className="text-lg font-medium text-primary hover:underline">785-533-0244</a>
                    <p className="text-xs text-slate-500 mt-1">Available during business hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-1">Email</h4>
                    <a href="mailto:Info@allwindowdoorparts.com" className="text-base font-medium text-slate-700 hover:text-primary hover:underline break-all">Info@allwindowdoorparts.com</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-1">Business Hours</h4>
                    <p className="text-slate-700 font-medium">Monday - Friday</p>
                    <p className="text-slate-600">8:00 AM - 5:00 PM CST</p>
                    <p className="text-slate-500 text-sm mt-1">Closed weekends and major holidays</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary text-white rounded-2xl shadow-md p-8">
              <h3 className="text-xl font-serif font-bold mb-4">Looking for a specific part?</h3>
              <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                The fastest way to get help finding a part is to use our free Parts Identification Service. Just snap a photo and send it our way.
              </p>
              <Button asChild variant="outline" className="w-full bg-transparent text-white border-white/30 hover:bg-white/10">
                <a href="/parts-identification">Use Free Parts ID</a>
              </Button>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border p-8 md:p-10">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4">Message Sent!</h2>
                  <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                    Thank you for contacting All Window Door Parts. A member of our team will get back to you shortly.
                  </p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">Send Another Message</Button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6">Send us a Message</h2>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number (Optional)</FormLabel>
                              <FormControl>
                                <Input type="tel" placeholder="(555) 123-4567" {...field} className="bg-slate-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subject (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Order question, general inquiry..." {...field} className="bg-slate-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="How can we help you today?" 
                                className="min-h-[150px] bg-slate-50" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full md:w-auto min-w-[200px] h-12 text-base font-bold"
                        disabled={submitContactMutation.isPending}
                      >
                        {submitContactMutation.isPending ? "Sending..." : (
                          <>Send Message <Send className="ml-2 w-4 h-4" /></>
                        )}
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
