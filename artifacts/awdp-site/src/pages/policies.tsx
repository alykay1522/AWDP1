import { Shield, Truck, RefreshCcw, Lock } from "lucide-react";
import PageSEO from "@/components/page-seo";
import { Link } from "wouter";

export default function Policies() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <PageSEO
        title="Store Policies — All Window Door Parts"
        description="Shipping policy, return policy, and security guarantee for All Window Door Parts. UPS, FedEx, and USPS shipping. SSL-secured checkout."
        path="/policies"
      />

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
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-900">Shipping Policy</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">
              This website incorporates UPS, FedEx and / or USPS quick estimates for shipping calculators.
              This means shipping costs are automatically calculated with approximate shipping charges based
              on your &ldquo;ship to&rdquo; address for smaller items, small packages, and other types of
              ground shipments.
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
            <p className="text-slate-700 leading-relaxed font-semibold">
              SPECIAL ORDER ITEMS &mdash; which include most items shown and offered on our sites are not
              returnable through the national distribution network.
            </p>
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
