import { useQuery } from "@tanstack/react-query";
import { Shield, Truck, RefreshCcw, Lock, Zap, PackageCheck, AlertTriangle, EyeOff } from "lucide-react";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { Link } from "wouter";

type Settings = Record<string, string>;

const DEFAULTS: Settings = {
  policyShippingMain: "Shipping costs are calculated automatically during checkout based on your delivery address, package weight, and dimensions. There is no guarantee that orders will ship immediately — some items may need to be sourced from our distributors first. We will contact you if additional lead time is required.",
  policyShippingObsolete: "We specialize in hard-to-find and obsolete window and door parts. Shipping times for these items may vary and could take longer than standard estimates. We will contact you if your order requires additional lead time.",
  policyShippingNote: "We ship via UPS, FedEx, and/or USPS. You do not need to complete a purchase to view shipping charges — they are shown before you pay.",
  policyReturnsWarning: "Most items are special order and cannot be returned.",
  policyReturnsBody: "Special order items — which include most items shown and offered on our sites — are sourced specifically for your order through our national distribution network and are non-returnable and non-exchangeable.\n\nCustom-cut weatherstripping and any items cut-to-length are also non-returnable.\n\nIf you are unsure whether an item is a special order, please contact us before purchasing. Our experts will confirm compatibility and let you know the ordering terms.",
  policySecurity: "Security is a very important part of having a safe and enjoyable online experience. We use the latest technology to protect all of the information you send and receive during the checkout process. The connection between your browser and our server is encrypted with industry leading SSL technology. SSL encrypts all of your personal information, including credit card number, name, and address, so it cannot be read as the information travels over the internet. Your browser must support SSL.\n\nOur Secure Shopping Guarantee protects you every time you shop with us so that you never have to worry about the safety of your credit card information. We use the industry standard encryption protocol known as Secure Socket Layer (SSL), to keep your order information secure. We guarantee that every transaction you make here will be safe and secure. You pay nothing if unauthorized charges are made to your card as a result of shopping online with us.",
  policyGuarantee: "Under the Fair Credit Billing Act, your bank cannot hold you liable for more than $50 of fraudulent charges. If your bank does hold you liable for any of this $50, we will cover the entire liability for you, up to the full $50. We will cover this liability only if the unauthorized use of your credit card resulted through no fault of your own from purchases made on our site while using our secure servers. Should any unauthorized charges appear on your credit card as a result of shopping here you must notify your credit card provider in accordance with its reporting rules and procedures.",
};

function s(settings: Settings | undefined, key: string): string {
  return settings?.[key] || DEFAULTS[key] || "";
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n+/).filter(Boolean).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </>
  );
}

export default function Policies() {
  const { data } = useQuery<{ settings: Settings }>({
    queryKey: ["site-content"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = data?.settings;

  return (
    <div className="bg-slate-50 min-h-screen">
      <PageSeo
        title="Store Policies — All Window Door Parts"
        description="Shipping, return, security, and privacy policies for All Window Door Parts. UPS, FedEx, and USPS shipping. SSL-secured checkout. Veteran-owned."
        path="/policies"
      />
      <Breadcrumb items={[{ label: "Store Policies" }]} />

      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">

        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-4xl font-serif font-bold text-slate-900 mb-3">Store Policies</h1>
          <p className="text-slate-600 text-lg">
            If you have any questions about the shipping and return policies listed below, please feel free to{" "}
            <Link href="/contact" className="text-primary underline hover:text-primary/80 font-medium">contact us</Link>.
          </p>
          <p className="text-slate-600 mt-3">
            Our site will calculate shipping charges for you automatically during the checkout process,
            and you do not need to buy anything to see these charges. Shipping costs are calculated
            based on the carton weight and dimensions of each product.
          </p>
        </div>

        <div className="space-y-8">

          {/* Shipping Policy */}
          <section id="shipping" className="bg-white rounded-2xl border shadow-sm p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Shipping Policy</h2>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
              <Truck className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-sm">Shipping Determined at Checkout</p>
                <p className="text-slate-600 text-sm mt-0.5">{s(settings, "policyShippingMain")}</p>
              </div>
            </div>

            <h3 className="font-bold text-slate-800 mb-3">Shipping Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <PackageCheck className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">Standard Shipping</span>
                </div>
                <p className="text-slate-600 text-sm">3&ndash;5 business days (estimate)</p>
                <p className="text-xs text-slate-400">UPS / FedEx / USPS</p>
              </div>
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-sm">Expedited Shipping</span>
                </div>
                <p className="text-slate-600 text-sm">2&ndash;3 business days (estimate)</p>
                <p className="text-xs text-slate-400">UPS / FedEx</p>
              </div>
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Truck className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-sm">Next Day Air</span>
                </div>
                <p className="text-slate-600 text-sm">Next business day (estimate)</p>
                <p className="text-xs text-slate-400">Available at checkout</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Hard-to-Find &amp; Obsolete Parts</p>
                <p className="text-amber-700 text-sm mt-0.5">{s(settings, "policyShippingObsolete")}</p>
              </div>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed">{s(settings, "policyShippingNote")}</p>
          </section>

          {/* Return Policy */}
          <section id="returns" className="bg-white rounded-2xl border shadow-sm p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl">
                <RefreshCcw className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Return Policy</h2>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-900 font-semibold mb-4">
              <strong>{s(settings, "policyReturnsWarning")}</strong>
            </div>
            <div className="space-y-3 text-slate-700 leading-relaxed">
              <Paragraphs text={s(settings, "policyReturnsBody")} />
              <p className="text-sm text-slate-500">
                Contact:{" "}
                <a href="mailto:info@allwindowdoorparts.com" className="text-primary font-semibold underline">info@allwindowdoorparts.com</a>
                {" "}or{" "}
                <a href="tel:+17855330244" className="text-primary font-semibold underline">785-533-0244</a>
              </p>
            </div>
          </section>

          {/* Security Notice */}
          <section id="security" className="bg-white rounded-2xl border shadow-sm p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Security Notice</h2>
            </div>
            <div className="space-y-4 text-slate-700 leading-relaxed">
              <Paragraphs text={s(settings, "policySecurity")} />
            </div>
          </section>

          {/* Guarantee Details */}
          <section id="guarantee" className="bg-white rounded-2xl border shadow-sm p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Guarantee Details</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">{s(settings, "policyGuarantee")}</p>
          </section>

          {/* Privacy Policy */}
          <section id="privacy" className="bg-white rounded-2xl border shadow-sm p-8 scroll-mt-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-violet-50 text-violet-600 p-2.5 rounded-xl">
                <EyeOff className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Privacy Policy</h2>
            </div>
            <div className="space-y-4 text-slate-700 leading-relaxed text-sm">
              <p><strong>Last updated: April 2025</strong></p>

              <p>All Window Door Parts ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard the personal information you provide when using our website at <span className="font-medium">allwindowdoorparts.com</span>.</p>

              <h3 className="text-base font-bold text-slate-900 mt-2">Information We Collect</h3>
              <p>We collect information you voluntarily provide when placing an order, submitting a parts-identification request, or contacting us — including your name, email address, phone number, shipping address, and payment details. Payment data is processed securely by PayPal and is never stored on our servers.</p>
              <p>We also collect standard web analytics data (pages visited, browser type, referring URL) through Google Analytics (Google Tag Manager). This data is aggregated and does not identify you personally.</p>

              <h3 className="text-base font-bold text-slate-900 mt-2">How We Use Your Information</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>To process and fulfill your orders</li>
                <li>To respond to your inquiries and parts-identification requests</li>
                <li>To send order confirmations and shipping updates</li>
                <li>To improve our website and product catalog</li>
              </ul>

              <h3 className="text-base font-bold text-slate-900 mt-2">Information Sharing</h3>
              <p>We do not sell, rent, or share your personal information with third parties for marketing purposes. We share information only with service providers necessary to fulfill your order (e.g., payment processors and shipping carriers) and as required by law.</p>

              <h3 className="text-base font-bold text-slate-900 mt-2">Cookies</h3>
              <p>Our site uses session cookies to maintain your shopping cart and analytics cookies (Google Analytics) to understand site usage. You can disable cookies in your browser settings; however, some features such as the shopping cart may not function correctly.</p>

              <h3 className="text-base font-bold text-slate-900 mt-2">Data Security</h3>
              <p>All checkout data is transmitted over SSL/TLS encryption. We follow industry-standard practices to protect your personal information against unauthorized access, alteration, or disclosure.</p>

              <h3 className="text-base font-bold text-slate-900 mt-2">Your Rights</h3>
              <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at{" "}
                <a href="mailto:Info@allwindowdoorparts.com" className="text-primary underline font-medium">Info@allwindowdoorparts.com</a>
                {" "}or by calling{" "}
                <a href="tel:785-533-0244" className="text-primary underline font-medium">785-533-0244</a>.
              </p>

              <h3 className="text-base font-bold text-slate-900 mt-2">Changes to This Policy</h3>
              <p>We may update this Privacy Policy periodically. Changes will be posted on this page with an updated revision date.</p>
            </div>
          </section>

        </div>

        <p className="text-center text-slate-500 mt-12 text-lg font-medium">Thank you for shopping with us!</p>
        <div className="text-center mt-4">
          <Link href="/shop" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
