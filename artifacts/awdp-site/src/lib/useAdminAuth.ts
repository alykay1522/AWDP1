import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

async function checkAuth(): Promise<boolean> {
  const res = await fetch("/api/admin/auth-check", { credentials: "include" });
  return res.ok;
}

export function useAdminAuth() {
  const { data: isAuthenticated, isLoading } = useQuery({
    queryKey: ["admin-auth"],
    queryFn: checkAuth,
    retry: false,
    staleTime: 60_000,
  });

  return { isAuthenticated: isAuthenticated ?? false, isLoading };
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
