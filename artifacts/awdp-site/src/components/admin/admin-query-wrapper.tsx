import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AdminQueryError } from "./admin-error";

interface AdminQueryWrapperProps<T> {
  /** The result object from useQuery (or similar) */
  query: {
    data?: T;
    isLoading: boolean;
    isError: boolean;
    error?: Error | null;
    refetch?: () => void;
  };
  children: (data: T) => ReactNode;
  /** Optional loading message */
  loadingMessage?: string;
  /** Optional empty state when data is empty array/object */
  emptyState?: ReactNode;
}

/**
 * Reusable wrapper for admin pages that use React Query.
 * Handles loading, error, and success states consistently.
 *
 * Usage:
 *   <AdminQueryWrapper query={productsQuery}>
 *     {(data) => <YourTable data={data} />}
 *   </AdminQueryWrapper>
 */
export function AdminQueryWrapper<T>({
  query,
  children,
  loadingMessage = "Loading…",
  emptyState,
}: AdminQueryWrapperProps<T>) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        <span>{loadingMessage}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <AdminQueryError 
          error={error ?? null} 
          onRetry={refetch} 
        />
      </div>
    );
  }

  // Handle empty data (arrays or objects)
  const isEmpty =
    data == null ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === "object" && Object.keys(data).length === 0);

  if (isEmpty && emptyState) {
    return <>{emptyState}</>;
  }

  if (isEmpty) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No data available.
      </div>
    );
  }

  return <>{children(data as T)}</>;
}
