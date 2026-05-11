import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart";
import { Layout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import { useAdminAuth } from "@/lib/useAdminAuth";
import NotFound from "@/pages/not-found";

// Public pages
import Home from "@/pages/home";
import Shop from "@/pages/shop";
import ProductDetail from "@/pages/product";
import Categories from "@/pages/categories";
import PartsIdentification from "@/pages/parts-id";
import Contact from "@/pages/contact";
import About from "@/pages/about";
import CheckoutSuccess from "@/pages/checkout-success";
import Policies from "@/pages/policies";
import GuideHub from "@/pages/guide-hub";
import GuideWindowBalance from "@/pages/guide-window-balance";
import GuidePatioDoorRoller from "@/pages/guide-patio-door-roller";
import GuideWeatherstripping from "@/pages/guide-weatherstripping";
import GuideWindowOperator from "@/pages/guide-window-operator";
import GuideDoorLock from "@/pages/guide-door-lock";
import GuideGlazingBead from "@/pages/guide-glazing-bead";
import Resources from "@/pages/resources";
import BalanceWizard from "@/components/BalanceWizard";
// Admin pages
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminProductsList from "@/pages/admin-products-list";
import AdminNewProduct from "@/pages/admin-new-product";
import AdminOrders from "@/pages/admin-orders";
import AdminCategories from "@/pages/admin-categories";
import AdminPartsIdList from "@/pages/admin-parts-id-list";
import AdminContactsList from "@/pages/admin-contacts-list";
import AdminPrices from "@/pages/admin-prices";
import AdminSettings from "@/pages/admin-settings";
import AdminImages from "@/pages/admin-images";
import AdminBulkEditor from "@/pages/admin-bulk-editor";
import AdminCsvImport from "@/pages/admin-csv-import";
import AdminContent from "@/pages/admin-content";
import AdminResourcesPage from "@/pages/admin-resources";
import AdminPriceSync from "@/pages/admin-price-sync";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

const queryClient = new QueryClient();

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
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

  if (location === "/admin/login") {
    return <AdminLogin />;
  }

  if (location.startsWith("/admin")) {
    return (
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
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
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
