import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface Product {
  id: number;
  name: string;
  price: string | number;
  selectedAttributes?: Record<string, string>;
  catalogProductId?: number;
  [key: string]: unknown;
}

export interface CartItem extends Product {
  quantity: number;
  cartLineKey: string;
}

type CartLineIdentifier = string | number;

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (identifier: CartLineIdentifier) => void;
  updateQuantity: (identifier: CartLineIdentifier, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type SelectionWindow = Window & {
  __awdpSelectedAttributes?: Record<string, string>;
};

function normalizedSelections(
  selections: Record<string, string> | undefined,
): Record<string, string> {
  if (!selections) return {};
  return Object.fromEntries(
    Object.entries(selections)
      .map(([key, value]) => [key, String(value).trim()])
      .filter(([, value]) => value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function productPageSelections(product: Product): Record<string, string> {
  if (product.selectedAttributes) {
    return normalizedSelections(product.selectedAttributes);
  }
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/product/")
  ) {
    return normalizedSelections(
      (window as SelectionWindow).__awdpSelectedAttributes,
    );
  }
  return {};
}

function baseProductId(product: Product): number {
  return Number(product.catalogProductId ?? product.id);
}

function buildCartLineKey(product: Product): string {
  return `${baseProductId(product)}:${JSON.stringify(
    normalizedSelections(product.selectedAttributes),
  )}`;
}

function numericLineId(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0) || 1;
}

function hydrateCartItem(item: Partial<CartItem> & Product): CartItem {
  const catalogProductId = Number(item.catalogProductId ?? item.id);
  const selectedAttributes = normalizedSelections(item.selectedAttributes);
  const cartLineKey =
    item.cartLineKey ||
    `${catalogProductId}:${JSON.stringify(selectedAttributes)}`;
  return {
    ...item,
    id: numericLineId(cartLineKey),
    catalogProductId,
    selectedAttributes,
    quantity: Math.max(1, Number(item.quantity) || 1),
    cartLineKey,
  };
}

function matchesLine(item: CartItem, identifier: CartLineIdentifier): boolean {
  return typeof identifier === "number"
    ? item.id === identifier
    : item.cartLineKey === identifier;
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

  const addToCart = useCallback((product: Product, quantity = 1) => {
    const catalogProductId = baseProductId(product);
    const selectedAttributes = productPageSelections(product);
    const normalizedProduct: Product = {
      ...product,
      catalogProductId,
      selectedAttributes,
    };
    const cartLineKey = buildCartLineKey(normalizedProduct);
    const lineId = numericLineId(cartLineKey);

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
          id: lineId,
          quantity,
          cartLineKey,
        },
      ];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((identifier: CartLineIdentifier) => {
    setItems((current) =>
      current.filter((item) => !matchesLine(item, identifier)),
    );
  }, []);

  const updateQuantity = useCallback((
    identifier: CartLineIdentifier,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      removeFromCart(identifier);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        matchesLine(item, identifier) ? { ...item, quantity } : item,
      ),
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [items],
  );

  const contextValue = useMemo<CartContextType>(() => ({
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    isCartOpen,
    setIsCartOpen,
  }), [
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    isCartOpen,
  ]);

  return (
    <CartContext.Provider value={contextValue}>
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
