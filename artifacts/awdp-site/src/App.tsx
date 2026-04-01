import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Page imports
import Home from "@/pages/home";
import Shop from "@/pages/shop";
import ProductDetail from "@/pages/product";
import Categories from "@/pages/categories";
import PartsIdentification from "@/pages/parts-id";
import Contact from "@/pages/contact";
import About from "@/pages/about";
import CheckoutSuccess from "@/pages/checkout-success";
import AdminPrices from "@/pages/admin-prices";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/product/:sku" component={ProductDetail} />
      <Route path="/categories" component={Categories} />
      <Route path="/parts-identification" component={PartsIdentification} />
      <Route path="/contact" component={Contact} />
      <Route path="/about" component={About} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/admin/prices" component={AdminPrices} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Router />
            </Layout>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
