import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "./components/ui/toaster.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { CartProvider } from "./lib/cart.tsx";
import { Layout } from "./components/layout.tsx";
import { AdminLayout } from "./components/admin-layout.tsx";
import { useAdminAuth } from "./lib/useAdminAuth.ts";
import NotFound from "./pages/not-found.tsx";
import { ErrorBoundary } from "./components/error-boundary.tsx";

// Public pages
import Home from "./pages/home.tsx";
import Shop from "./pages/shop.tsx";
import ProductDetail from "./pages/product.tsx";
import Categories from "./pages/categories.tsx";
import PartsIdentification from "./pages/parts-id.tsx";
import Contact from "./pages/contact.tsx";
import About from "./pages/about.tsx";
import Checkout from "./pages/checkout.tsx";
import CheckoutSuccess from "./pages/checkout-success.tsx";
import Policies from "./pages/policies.tsx";
import GuideHub from "./pages/guide-hub.tsx";
import GuideWindowBalance from "./pages/guide-window-balance.tsx";
import GuidePatioDoorRoller from "./pages/guide-patio-door-roller.tsx";
import GuideWeatherstripping from "./pages/guide-weatherstripping.tsx";
import GuideWindowOperator from "./pages/guide-window-operator.tsx";
import GuideDoorLock from "./pages/guide-door-lock.tsx";
import GuideGlazingBead from "./pages/guide-glazing-bead.tsx";
import Resources from "./pages/resources.tsx";
import BalanceWizard from "./components/BalanceWizard.tsx";
// Admin pages
import AdminLogin from "./pages/admin-login.tsx";
import AdminDashboard from "./pages/admin-dashboard.tsx";
import AdminProductsList from "./pages/admin-products-list.tsx";
import AdminNewProduct from "./pages/admin-new-product.tsx";
import AdminOrders from "./pages/admin-orders.tsx";
import AdminCategories from "./pages/admin-categories.tsx";
import AdminPartsIdList from "./pages/admin-parts-id-list.tsx";
import AdminContactsList from "./pages/admin-contacts-list.tsx";
import AdminPrices from "./pages/admin-prices.tsx";
import AdminSettings from "./pages/admin-settings.tsx";
import AdminImages from "./pages/admin-images.tsx";
import AdminBulkEditor from "./pages/admin-bulk-editor.tsx";
import AdminCsvImport from "./pages/admin-csv-import.tsx";
import AdminContent from "./pages/admin-content.tsx";
import AdminResourcesPage from "./pages/admin-resources.tsx";
import AdminPriceSync from "./pages/admin-price-sync.tsx";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

const queryClient = new QueryClient();

function AdminErrorFallback({ error, resetError }: { error?: Error; resetError?: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Admin failed to load</h2>
        <p className="text-slate-600 mb-6">
          Something went wrong while loading the admin panel. This could be a temporary connection issue or a component error.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              if (resetError) resetError();
              window.location.reload();
            }}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          
          <button
            onClick={() => window.location.href = "/admin/login"}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Go to login
          </button>

          <a 
            href="mailto:info@allwindowdoorparts.com?subject=Admin%20Panel%20Error"
            className="block text-sm text-slate-500 hover:text-slate-700 mt-4"
          >
            Contact support
          </a>
        </div>

        {error && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Technical details</summary>
            <pre className="mt-2 p-3 bg-slate-900 text-red-400 text-xs rounded overflow-auto max-h-40">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isError, error } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading admin…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-red-600 mb-3 text-4xl">🔒</div>
          <h3 className="text-xl font-semibold mb-2">Unable to verify admin access</h3>
          <p className="text-slate-600 mb-4">
            We couldn't check your authentication status. Please try logging in again.
          </p>
          <button
            onClick={() => window.location.href = "/admin/login"}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium"
          >
            Go to Admin Login
          </button>
          {error && <p className="text-xs text-red-500 mt-3">{error.message}</p>}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [location] = useLocation();

  const normalized = (location || "/").replace(/\/$/, "") || "/";

  if (normalized === "/admin/login") {
    return <AdminLogin />;
  }

  if (normalized.startsWith("/admin")) {
    return (
      <ErrorBoundary fallback={<AdminErrorFallback />}>
        <AdminGuard>
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/products/new" component={AdminNewProduct} />
              <Route path="/admin/products/bulk-editor" component={AdminBulkEditor} />
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
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/product/:sku" component={ProductDetail} />
        <Route path="/categories" component={Categories} />
        <Route path="/parts-identification" component={PartsIdentification} />
        <Route path="/contact" component={Contact} />
        <Route path="/about" component={About} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/policies" component={Policies} />
        <Route path="/privacy-policy">
          {() => { window.location.replace("/policies#privacy"); return null; }}
        </Route>
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
    </Layout>
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
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </QueryClientProvider>
      <Analytics />
      <SpeedInsights />
    </HelmetProvider>
  );
}

export default App;
