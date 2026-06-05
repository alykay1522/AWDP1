import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  showTechnical?: boolean;
}

export function AdminError({
  title = "Failed to load data",
  message = "There was a problem fetching this section. Please try again.",
  error,
  onRetry,
  showTechnical = false,
}: AdminErrorProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex items-start gap-4">
        <div className="mt-1">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">{title}</h3>
          <p className="text-sm text-red-700 mb-4">{message}</p>

          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-red-700 hover:bg-red-100"
            >
              Reload page
            </Button>
          </div>

          {showTechnical && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-red-600 hover:underline">
                Show technical details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-red-900 p-3 text-xs text-red-200">
                {error.message}
                {error.stack && "\n\n" + error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminQueryError({ 
  error, 
  onRetry 
}: { 
  error: Error | null; 
  onRetry?: () => void 
}) {
  return (
    <AdminError
      title="Failed to load data"
      message="We couldn't fetch the latest information. This might be temporary."
      error={error}
      onRetry={onRetry}
      showTechnical
    />
  );
}
