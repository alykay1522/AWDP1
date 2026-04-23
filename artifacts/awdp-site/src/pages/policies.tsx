import { Shield, Truck, RefreshCcw, Lock, Zap, PackageCheck, AlertTriangle } from "lucide-react";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { Link } from "wouter";

export default function Policies() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <PageSeo
        title="Store Policies — All Window Door Parts"
        description="Shipping policy, return policy, and security guarantee for All Window Door Parts. UPS, FedEx, and USPS shipping. SSL-secured checkout."
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

            {/* Shipping notice */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
              <Truck className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-sm">Shipping Determined at Checkout</p>
                <p className="text-slate-600 text-sm mt-0.5">
                  Shipping costs are calculated automatically during checkout based on your delivery address, package weight, and dimensions.
                  There is no guarantee that orders will ship immediately — some items may need to be sourced from our distributors first.
                  We will contact you if additional lead time is required.
                </p>
              </div>
            </div>

            {/* Shipping options */}
            <h3 className="font-bold text-slate-800 mb-3">Shipping Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <PackageCheck className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">Standard Shipping</span>
                </div>
                <p className="text-slate-600 text-sm">3&ndash;5 business days</p>
                <p className="text-xs text-slate-400">UPS / FedEx / USPS</p>
              </div>
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-sm">Expedited Shipping</span>
                </div>
                <p className="text-slate-600 text-sm">2&ndash;3 business days</p>
                <p className="text-xs text-slate-400">UPS / FedEx</p>
              </div>
              <div className="border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Truck className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-sm">Next Day Air</span>
                </div>
                <p className="text-slate-600 text-sm">Next business day</p>
                <p className="text-xs text-slate-400">Available at checkout</p>
              </div>
            </div>

            {/* Obsolete parts notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Hard-to-Find &amp; Obsolete Parts</p>
                <p className="text-amber-700 text-sm mt-0.5">
                  We specialize in hard-to-find and obsolete window and door parts. Shipping times for
                  these items may vary and could take longer than standard estimates. We will contact you
                  if your order requires additional lead time.
                </p>
              </div>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed">
              We ship via UPS, FedEx, and/or USPS. You do not need to complete a purchase to view shipping charges &mdash; they are shown before you pay.
            </p>
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
              <strong>Most items are special order and cannot be returned.</strong>
            </div>
            <div className="space-y-3 text-slate-700 leading-relaxed">
              <p>
                Special order items — which include most items shown and offered on our sites — are sourced specifically for your order through our national distribution network and are <strong>non-returnable and non-exchangeable</strong>.
              </p>
              <p>Custom-cut weatherstripping and any items cut-to-length are also non-returnable.</p>
              <p>
                If you are unsure whether an item is a special order, please contact us <strong>before purchasing</strong>. Our experts will confirm compatibility and let you know the ordering terms.
              </p>
              <p className="text-sm text-slate-500">Contact: <a href="mailto:info@allwindowdoorparts.com" className="text-primary font-semibold underline">info@allwindowdoorparts.com</a> or <a href="tel:+17855330244" className="text-primary font-semibold underline">785-533-0244</a></p>
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
              <p>
                Security is a very important part of having a safe and enjoyable online experience. We use
                the latest technology to protect all of the information you send and receive during the
                checkout process. The connection between your browser and our server is encrypted with
                industry leading SSL technology. SSL encrypts all of your personal information, including
                credit card number, name, and address, so it cannot be read as the information travels
                over the internet. Your browser must support SSL.
              </p>
              <p>
                Our Secure Shopping Guarantee protects you every time you shop with us so that you never
                have to worry about the safety of your credit card information. We use the industry standard
                encryption protocol known as Secure Socket Layer (SSL), to keep your order information
                secure. We guarantee that every transaction you make here will be safe and secure. You pay
                nothing if unauthorized charges are made to your card as a result of shopping online with us.
              </p>
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
            <p className="text-slate-700 leading-relaxed">
              Under the Fair Credit Billing Act, your bank cannot hold you liable for more than $50 of
              fraudulent charges. If your bank does hold you liable for any of this $50, we will cover
              the entire liability for you, up to the full $50. We will cover this liability only if the
              unauthorized use of your credit card resulted through no fault of your own from purchases
              made on our site while using our secure servers. Should any unauthorized charges appear on
              your credit card as a result of shopping here you must notify your credit card provider in
              accordance with its reporting rules and procedures.
            </p>
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
