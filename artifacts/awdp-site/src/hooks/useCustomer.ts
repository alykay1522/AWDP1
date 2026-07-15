import { useCallback, useEffect, useState } from "react";

export interface CustomerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Customer {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  shippingAddress: CustomerAddress | null;
}

/** Fetches the signed-in customer (null when logged out). */
export function useCustomer() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("auth check failed");
      const data = await res.json();
      setCustomer(data.customer ?? null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setCustomer(null);
  }, []);

  return { customer, loading, refresh, logout, setCustomer };
}
