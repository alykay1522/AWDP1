import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AdminQueryError } from "@/components/admin/admin-error";

type CheckStatus = "ok" | "warn" | "error";

interface BuddyCheck {
  key: string;
  label: string;
  status: CheckStatus;
  summary: string;
  detail?: string;
  value?: string | number | boolean | null;
}

interface BuddySnapshot {
  status: CheckStatus;
  checkedAt: string;
  checks: BuddyCheck[];
  message?: string;
  reply?: string;
}

async function readApiError(res: Response, fallback: string) {
  const text = await res.text().catch(() => "");
  if (!text) return `${fallback} (${res.status})`;
  try {
    const parsed = JSON.parse(text) as { error?: string; detail?: string };
    return parsed.detail || parsed.error || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status}): ${text.slice(0, 160)}`;
  }
}

async function getBuddyHealth() {
  const res = await fetch("/api/admin/buddy/health", { credentials: "include" });
  if (!res.ok && res.status !== 500) {
    throw new Error(await readApiError(res, "Failed to load admin buddy"));
  }
  return res.json() as Promise<BuddySnapshot>;
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
  } satisfies Record<CheckStatus, string>;

  return (
    <Badge variant="outline" className={styles[status]}>
      {status.toUpperCase()}
    </Badge>
  );
}

function statusIcon(status: CheckStatus) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <AlertTriangle className="h-4 w-4 text-red-600" />;
}

export default function AdminBuddy() {
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: "you" | "buddy"; text: string }>>([]);

  const health = useQuery({
    queryKey: ["admin-buddy-health"],
    queryFn: getBuddyHealth,
    refetchInterval: 60_000,
  });

  const chat = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/admin/buddy/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Buddy could not answer"));
      return res.json() as Promise<BuddySnapshot>;
    },
    onSuccess: (data, text) => {
      setConversation((prev) => [
        ...prev,
        { role: "you", text },
        { role: "buddy", text: data.reply || data.message || "I checked the portal, but I do not have a summary." },
      ]);
      setMessage("");
      health.refetch();
    },
  });

  const checks = health.data?.checks ?? [];
  const grouped = useMemo(() => ({
    error: checks.filter((c) => c.status === "error"),
    warn: checks.filter((c) => c.status === "warn"),
    ok: checks.filter((c) => c.status === "ok"),
  }), [checks]);

  const askBuddy = () => {
    const text = message.trim();
    if (!text || chat.isPending) return;
    chat.mutate(text);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-slate-900 text-white py-6 px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6" />
              Admin AI Buddy
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Checks the admin portal, backend, database, orders, and price sync readiness.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-200 hover:bg-slate-800 gap-2 self-start md:self-auto"
            onClick={() => health.refetch()}
            disabled={health.isFetching}
          >
            {health.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run Checks
          </Button>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-6xl space-y-6">
        {health.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : health.isError ? (
          <AdminQueryError error={health.error} onRetry={health.refetch} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="bg-white rounded-xl border shadow-sm p-4 md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Overall Status</span>
                  {health.data && <StatusBadge status={health.data.status} />}
                </div>
                <p className="text-sm whitespace-pre-line text-slate-700">
                  {health.data?.message}
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  Last checked {health.data?.checkedAt ? new Date(health.data.checkedAt).toLocaleString() : "never"}
                </p>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Errors</span>
                </div>
                <p className="text-3xl font-bold text-red-700">{grouped.error.length}</p>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Passing</span>
                </div>
                <p className="text-3xl font-bold text-emerald-700">{grouped.ok.length}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-slate-800">Live Admin Checks</h2>
                </div>
                <div className="divide-y">
                  {checks.map((check) => (
                    <div key={check.key} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(check.status)}
                          <p className="font-medium text-sm text-slate-900">{check.label}</p>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{check.summary}</p>
                        {check.detail && <p className="text-xs text-slate-400 mt-1">{check.detail}</p>}
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[520px]">
                <div className="px-5 py-4 border-b flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-slate-800">Ask Buddy</h2>
                </div>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {conversation.length === 0 ? (
                    <div className="text-sm text-slate-500 space-y-2">
                      <p>Try asking:</p>
                      <button className="block text-left text-primary hover:underline" onClick={() => setMessage("Why did orders fail today?")}>Why did orders fail today?</button>
                      <button className="block text-left text-primary hover:underline" onClick={() => setMessage("Is price sync ready to run?")}>Is price sync ready to run?</button>
                      <button className="block text-left text-primary hover:underline" onClick={() => setMessage("What should I fix first?")}>What should I fix first?</button>
                    </div>
                  ) : conversation.map((entry, index) => (
                    <div
                      key={`${entry.role}-${index}`}
                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                        entry.role === "you"
                          ? "bg-primary text-white ml-8"
                          : "bg-slate-100 text-slate-700 mr-8"
                      }`}
                    >
                      {entry.text}
                    </div>
                  ))}
                  {chat.isPending && (
                    <div className="rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-500 mr-8 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Checking admin health...
                    </div>
                  )}
                  {chat.isError && (
                    <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
                      {chat.error.message}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t space-y-2">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask what is broken, whether price sync is ready, or what to fix first..."
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) askBuddy();
                    }}
                  />
                  <Button className="w-full gap-2" onClick={askBuddy} disabled={!message.trim() || chat.isPending}>
                    {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Ask Buddy
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
