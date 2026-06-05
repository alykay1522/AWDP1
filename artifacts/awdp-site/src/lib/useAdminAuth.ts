import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

async function checkAuth(): Promise<boolean> {
  const res = await fetch("/api/admin/auth-check", { credentials: "include" });
  if (!res.ok) {
    throw new Error("Auth check failed");
  }
  return true;
}

export function useAdminAuth() {
  const { data: isAuthenticated, isLoading, error, isError } = useQuery({
    queryKey: ["admin-auth"],
    queryFn: checkAuth,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    isAuthenticated: isAuthenticated ?? false,
    isLoading,
    error,
    isError,
  };
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  return useMutation({
    mutationFn: async () => {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.setQueryData(["admin-auth"], false);
      navigate("/admin/login");
    },
  });
}
