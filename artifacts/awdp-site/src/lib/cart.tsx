import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Product {
  id: number;
  name: string;
  price: string | number;
  selectedAttributes?: Record<string, string>;
  [key: string]: unknown;
}

export interface CartItem extends Product {
  quantity: number;
  cartLineKey: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (cartLineKey: string) => void;
  updateQuantity: (cartLineKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizedSelections(
  selections: Record<string, string> | undefined,
): Record<string, string> {
  if (!selections) return {};
  return Object.fromEntries(
    Object.entries(selections)
      .filter(([, value]) => String(value).trim() !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildCartLineKey(product: Product): string {
  return `${product.id}:${JSON.stringify(normalizedSelections(product.selectedAttributes))}`;
}

function hydrateCartItem(item: Partial<CartItem> & Product): CartItem {
  return {
    ...item,
    selectedAttributes: normalizedSelections(item.selectedAttributes),
    quantity: Math.max(1, Number(item.quantity) || 1),
    cartLineKey: item.cartLineKey || buildCartLineKey(item),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("awdp-cart");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(hydrateCartItem) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("awdp-cart", JSON.stringify(items));
  }, [items]);

  const addToCart = (product: Product, quantity = 1) => {
    const normalizedProduct = {
      ...product,
      selectedAttributes: normalizedSelections(product.selectedAttributes),
    };
    const cartLineKey = buildCartLineKey(normalizedProduct);

    setItems((current) => {
      const existing = current.find((item) => item.cartLineKey === cartLineKey);
      if (existing) {
        return current.map((item) =>
          item.cartLineKey === cartLineKey
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [
        ...current,
        {
          ...normalizedProduct,
          quantity,
          cartLineKey,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (cartLineKey: string) => {
    setItems((current) =>
      current.filter((item) => item.cartLineKey !== cartLineKey),
    );
  };

  const updateQuantity = (cartLineKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartLineKey);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.cartLineKey === cartLineKey ? { ...item, quantity } : item,
      ),
    );
  };

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
