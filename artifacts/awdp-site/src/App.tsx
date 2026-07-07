import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "./components/ui/toaster.jsx";
import { TooltipProvider } from "./components/ui/tooltip.jsx";
import { CartProvider } from "./lib/cart.jsx";
import { Layout } from "./components/layout.jsx";
import { AdminLayout } from "./components/admin-layout.jsx";
import { useAdminAuth } from "./lib/useAdminAuth.js";
import NotFound from "./pages/not-found.jsx";
import { ErrorBoundary } from "./components/error-boundary.jsx";
import Home from "./pages/home.jsx";

// Keep the homepage in the entry bundle and split every secondary storefront page.
// The prior eager imports produced a nearly 1 MB entry chunk for first-time visitors.
const Shop = lazy(() => import("./pages/shop.jsx"));
const ProductDetail = lazy(() => import("./pages/product.jsx"));
const Categories = lazy(() => import("./pages/categories.jsx"));
const PartsIdentification = lazy(() => import("./pages/parts-id.jsx"));
const Contact = lazy(() => import("./pages/contact.jsx"));
const About = lazy(() => import("./pages/about.jsx"));
const Checkout = lazy(() => import("./pages/checkout.jsx"));
const CheckoutSuccess = lazy(() => import("./pages/checkout-success.jsx"));
const Policies = lazy(() => import("./pages/policies.jsx"));
const GuideHub = lazy(() => import("./pages/guide-hub.jsx"));
const GuideWindowBalance = lazy(() => import("./pages/guide-window-balance.jsx"));
const GuidePatioDoorRoller = lazy(() => import("./pages/guide-patio-door-roller.jsx"));
const GuideWeatherstripping = lazy(() => import("./pages/guide-weatherstripping.jsx"));
const GuideWindowOperator = lazy(() => import("./pages/guide-window-operator.jsx"));
const GuideDoorLock = lazy(() => import("./pages/guide-door-lock.jsx"));
const GuideGlazingBead = lazy(() => import("./pages/guide-glazing-bead.jsx"));
const Resources = lazy(() => import("./pages/resources.jsx"));
const BalanceWizard = lazy(() => import("./components/BalanceWizard.jsx"));

const AdminLogin = lazy(() => import("./pages/admin-login.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin-dashboard.jsx"));
const AdminProductsList = lazy(() => import("./pages/admin-products-list.jsx"));
const AdminNewProduct = lazy(() => import("./pages/admin-new-product.jsx"));
const AdminOrders = lazy(() => import("./pages/admin-orders.jsx"));
const AdminCategories = lazy(() => import("./pages/admin-categories.jsx"));
const AdminPartsIdList = lazy(() => import("./pages/admin-parts-id-list.jsx"));
const AdminContactsList = lazy(() => import("./pages/admin-contacts-list.jsx"));
const AdminPrices = lazy(() => import("./pages/admin-prices.jsx"));
const AdminSettings = lazy(() => import("./pages/admin-settings.jsx"));
const AdminImages = lazy(() => import("./pages/admin-images.jsx"));
const AdminBulkEditor = lazy(() => import("./pages/admin-bulk-editor.jsx"));
const AdminProductPackageImport = lazy(() => import("./pages/admin-product-package-import.jsx"));
const AdminCsvImport = lazy(() => import("./pages/admin-csv-import.jsx"));
const AdminContent = lazy(() => import("./pages/admin-content.jsx"));
const AdminResourcesPage = lazy(() => import("./pages/admin-resources.jsx"));
const AdminPriceSync = lazy(() => import("./pages/admin-price-sync.jsx"));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function PartsIdentificationWithNotice() {
  return (
    <>
      <div className="bg-amber-50 border-y border-amber-200 px-4 py-4 text-amber-950">
        <div className="max-w-3xl mx-auto text-center text-sm md:text-base">
          <p className="font-bold">Please wait for us to respond to your first inquiry before submitting another.</p>
          <p>Submitting multiple inquiries will cause a delay. We hope to get back to you in a timely manner.</p>
        </div>
      </div>
      <PartsIdentification />
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  }
});

function RouteLoadingFallback({ label = "Loading page…" }: { label?: string }) {
  return (
    <div className="min-h-[45vh] flex items-center justify-center bg-slate-50" role="status" aria-live="polite" aria-label={label}>
      <div className="flex items-center gap-3 text-slate-600 text-sm">
        <span className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-primary animate-spin" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

function AdminLoadingFallback() {
  return <RouteLoadingFallback label="Loading admin tools…" />;
}

function AdminErrorFallback({ error, resetError }: { error?: Error; resetError?: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl" aria-hidden="true">⚠️</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Admin failed to load</h2>
        <p className="text-slate-600 mb-6">Something went wrong while loading the admin panel. This could be a temporary connection issue or a component error.</p>
        <div className="space-y-3">
          <button
            onClick={() => {
              resetError?.();
              window.location.reload();
            }}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = "/admin/login"; }}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Go to login
          </button>
          <a href="mailto:info@allwindowdoorparts.com?subject=Admin%20Panel%20Error" className="block text-sm text-slate-500 hover:text-slate-700 mt-4">
            Contact support
          </a>
        </div>
        {error && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Technical details</summary>
            <pre className="mt-2 p-3 bg-slate-900 text-red-400 text-xs rounded overflow-auto max-h-40">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isError, error } = useAdminAuth();
  if (isLoading) return <AdminLoadingFallback />;
  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-red-600 mb-3 text-4xl" aria-hidden="true">🔒</div>
          <h3 className="text-xl font-semibold mb-2">Unable to verify admin access</h3>
          <p className="text-slate-600 mb-4">We couldn't check your authentication status. Please try logging in again.</p>
          <button onClick={() => { window.location.href = "/admin/login"; }} className="px-6 py-2 bg-primary text-white rounded-lg font-medium">
            Go to Admin Login
          </button>
          {error && <p className="text-xs text-red-500 mt-3">{error.message}</p>}
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/admin/login" replace />;
  return <>{children}</>;
}

function AdminRoutes() {
  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <ErrorBoundary fallback={<AdminErrorFallback />}>
        <AdminGuard>
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/products/new" component={AdminNewProduct} />
              <Route path="/admin/products/bulk-editor" component={AdminBulkEditor} />
              <Route path="/admin/products/import-package" component={AdminProductPackageImport} />
              <Route path="/admin/products" component={AdminProductsList} />
              <Route path="/admin/orders" component={AdminOrders} />
              <Route path="/admin/categories" component={AdminCategories} />
              <Route path="/admin/parts-id" component={AdminPartsIdList} />
              <Route path="/admin/contacts" component={AdminContactsList} />
              <Route path="/admin/images" component={AdminImages} />
              <Route path="/admin/prices" component={AdminPrices} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/csv-import" component={AdminCsvImport} />
              <Route path="/admin/content" component={AdminContent} />
              <Route path="/admin/resources" component={AdminResourcesPage} />
              <Route path="/admin/price-sync" component={AdminPriceSync} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </AdminGuard>
      </ErrorBoundary>
    </Suspense>
  );
}

function PublicRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/product/:sku" component={ProductDetail} />
        <Route path="/categories" component={Categories} />
        <Route path="/parts-identification" component={PartsIdentificationWithNotice} />
        <Route path="/contact" component={Contact} />
        <Route path="/about" component={About} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/policies" component={Policies} />
        <Route path="/privacy-policy"><Redirect to="/policies#privacy" replace /></Route>
        <Route path="/guides" component={GuideHub} />
        <Route path="/guides/window-balance" component={GuideWindowBalance} />
        <Route path="/guides/patio-door-roller" component={GuidePatioDoorRoller} />
        <Route path="/guides/weatherstripping" component={GuideWeatherstripping} />
        <Route path="/guides/window-operator" component={GuideWindowOperator} />
        <Route path="/guides/door-lock" component={GuideDoorLock} />
        <Route path="/guides/glazing-bead" component={GuideGlazingBead} />
        <Route path="/resources" component={Resources} />
        <Route path="/identify-balance" component={BalanceWizard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const [location] = useLocation();
  const normalized = (location || "/").replace(/\/$/, "") || "/";

  if (normalized === "/admin/login") {
    return (
      <Suspense fallback={<AdminLoadingFallback />}>
        <ErrorBoundary fallback={<AdminErrorFallback />}>
          <AdminLogin />
        </ErrorBoundary>
      </Suspense>
    );
  }

  if (normalized.startsWith("/admin")) return <AdminRoutes />;
  return <Layout><PublicRoutes /></Layout>;
}

function PublicTelemetry() {
  const [location] = useLocation();
  const normalized = (location || "/").replace(/\/$/, "") || "/";

  if (normalized === "/admin" || normalized.startsWith("/admin/")) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter>
              <ScrollToTop />
              <AppContent />
              <PublicTelemetry />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;