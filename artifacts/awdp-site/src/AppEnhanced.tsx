import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Router as WouterRouter } from "wouter";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.jsx";
import FaqPage from "./pages/faq.jsx";
import { Layout } from "./components/layout.jsx";
import { Toaster } from "./components/ui/toaster.jsx";
import { TooltipProvider } from "./components/ui/tooltip.jsx";
import { CartProvider } from "./lib/cart.jsx";
import { SiteCopyCleanup } from "./components/site-copy-cleanup.jsx";

const faqQueryClient = new QueryClient();

function StandaloneFaqApp() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={faqQueryClient}>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter>
              <SiteCopyCleanup />
              <Layout>
                <FaqPage />
              </Layout>
              <Toaster />
            </WouterRouter>
          </TooltipProvider>
        </CartProvider>
      </QueryClientProvider>
      <Analytics />
      <SpeedInsights />
    </HelmetProvider>
  );
}

export default function AppEnhanced() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/faq") return <StandaloneFaqApp />;

  return (
    <>
      <SiteCopyCleanup />
      <App />
    </>
  );
}
