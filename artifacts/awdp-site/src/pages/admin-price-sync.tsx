import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCcw, Play, CheckCircle2, AlertCircle, Loader2,
  DollarSign, BarChart2, Globe, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AdminLayout } from "@/components/admin-layout";

const API = "/api";

const SISTER_SITES = [
  {
    key: "allbrand",
    label: "AllBrand Window Door Parts",
    url: "allbrandwindowdoorparts.com",
    color: "bg-blue-100 text-blue-800",
  },
  {
    key: "biltbest",
    label: "BiltBest Window Parts",
    url: "biltbestwindowparts.com",
    color: "bg-purple-100 text-purple-800",
  },
];

type ScrapeStatus = "idle" | "running" | "done" | "error";

interface ScrapeState {
  status: ScrapeStatus;
  scraped: number;
  total: number;
  matched: number;
  priced: number;
  pct: number;
  log: string[];
}

const defaultScrapeState: ScrapeState = {
  status: "idle",
  scraped: 0,
  total: 0,
  matched: 0,
  priced: 0,
  pct: 0,
  log: [],
};

interface PreviewRow {
  sku: string;
  name: string;
  current_price: string;
  avg_sister_price: string;
  new_price: string;
  category: string;
  site_count: string;
}

export default function AdminPriceSync() {
  const qc = useQueryClient();
  const [scrapeStates, setScrapeStates] = useState<Record<string, ScrapeState>>({
    allbrand: { ...defaultScrapeState },
    biltbest: { ...defaultScrapeState },
  });
  const [applyStatus, setApplyStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [applyResult, setApplyResult] = useState<string>("");
  const [applyAll, setApplyAll] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const abortRefs = useRef<Record<string, AbortController>>({});

  // Status query
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["sister-price-status"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/sister-prices/status`);
      return r.json();
    },
    refetchInterval: 5000,
  });

  // Preview query
  const { data: previewData, refetch: refetchPreview, isFetching: previewLoading } = useQuery({
    queryKey: ["sister-price-preview"],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/sister-prices/preview`);
      return r.json();
    },
    enabled: false,
  });

  const startScrape = useCallback(async (siteKey: string) => {
    abortRefs.current[siteKey]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[siteKey] = ctrl;

    setScrapeStates((s) => ({
      ...s,
      [siteKey]: { ...defaultScrapeState, status: "running", log: ["Starting scrape…"] },
    }));

    try {
      const res = await fetch(`${API}/admin/sister-prices/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteKey }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            setScrapeStates((s) => {
              const prev = s[siteKey];
              let logEntry = "";
              if (ev.type === "status") logEntry = ev.message;
              else if (ev.type === "progress")
                logEntry = `Scraped ${ev.scraped}/${ev.total} — ${ev.matched} matched, ${ev.priced} with price`;
              else if (ev.type === "done")
                logEntry = `✓ Complete: ${ev.scraped} scraped, ${ev.matched} matched, ${ev.priced} with price`;
              else if (ev.type === "error") logEntry = `✗ Error: ${ev.message}`;

              return {
                ...s,
                [siteKey]: {
                  status: ev.type === "done" ? "done" : ev.type === "error" ? "error" : "running",
                  scraped: ev.scraped ?? prev.scraped,
                  total: ev.total ?? prev.total,
                  matched: ev.matched ?? prev.matched,
                  priced: ev.priced ?? prev.priced,
                  pct: ev.pct ?? prev.pct,
                  log: logEntry ? [...prev.log.slice(-19), logEntry] : prev.log,
                },
              };
            });
          } catch {}
        }
      }

      refetchStatus();
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setScrapeStates((s) => ({
        ...s,
        [siteKey]: { ...s[siteKey], status: "error", log: [...s[siteKey].log, `Error: ${err.message}`] },
      }));
    }
  }, [refetchStatus]);

  const stopScrape = (siteKey: string) => {
    abortRefs.current[siteKey]?.abort();
    setScrapeStates((s) => ({ ...s, [siteKey]: { ...s[siteKey], status: "idle" } }));
  };

  const applyPrices = async () => {
    setApplyStatus("loading");
    try {
      const r = await fetch(`${API}/admin/sister-prices/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyAll }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Apply failed");
      setApplyResult(data.message);
      setApplyStatus("done");
      qc.invalidateQueries({ queryKey: ["sister-price-status"] });
      qc.invalidateQueries({ queryKey: ["sister-price-preview"] });
    } catch (err: any) {
      setApplyResult(err.message);
      setApplyStatus("error");
    }
  };

  const sites = statusData?.sites as { site_name: string; total: string; matched: string; with_price: string; last_scraped: string }[] | undefined;

  const totalScraped = sites?.reduce((acc, s) => acc + parseInt(s.total, 10), 0) ?? 0;
  const totalMatched = sites?.reduce((acc, s) => acc + parseInt(s.matched, 10), 0) ?? 0;
  const totalWithPrice = sites?.reduce((acc, s) => acc + parseInt(s.with_price, 10), 0) ?? 0;

  const preview = previewData?.preview as PreviewRow[] | undefined;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Price Sync</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Scrape sister-site prices, match products, and update AWDP prices at{" "}
              <span className="font-semibold text-slate-700">sister avg × 1.30</span>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchStatus()}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pages Scraped", value: totalScraped.toLocaleString(), icon: <Globe className="w-4 h-4 text-blue-500" /> },
            { label: "Products Matched", value: totalMatched.toLocaleString(), icon: <BarChart2 className="w-4 h-4 text-green-500" /> },
            { label: "With Prices", value: totalWithPrice.toLocaleString(), icon: <DollarSign className="w-4 h-4 text-amber-500" /> },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scraper cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Step 1 — Scrape Sister Sites</h2>
          {SISTER_SITES.map((site) => {
            const st = scrapeStates[site.key];
            const siteData = sites?.find((s) => s.site_name === site.key);
            const isRunning = st.status === "running";

            return (
              <div key={site.key} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${site.color}`}>
                      {site.url}
                    </span>
                    <span className="font-semibold text-slate-800">{site.label}</span>
                    {siteData && (
                      <span className="text-xs text-slate-500">
                        {parseInt(siteData.total, 10).toLocaleString()} scraped · {parseInt(siteData.matched, 10).toLocaleString()} matched
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isRunning ? (
                      <Button variant="outline" size="sm" onClick={() => stopScrape(site.key)}>
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => startScrape(site.key)} className="gap-1.5">
                        <Play className="w-3.5 h-3.5" />
                        {siteData && parseInt(siteData.total, 10) > 0 ? "Re-Scrape" : "Start Scrape"}
                      </Button>
                    )}
                  </div>
                </div>

                {st.status !== "idle" && (
                  <div className="space-y-2">
                    {isRunning && st.total > 0 && (
                      <div className="space-y-1">
                        <Progress value={st.pct} className="h-2" />
                        <p className="text-xs text-slate-500">
                          {st.scraped.toLocaleString()} / {st.total.toLocaleString()} pages ({st.pct}%)
                        </p>
                      </div>
                    )}
                    {isRunning && st.total === 0 && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Initializing…
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-xs text-slate-600 space-y-0.5">
                      {st.log.map((l, i) => (
                        <div key={i} className={l.startsWith("✓") ? "text-green-700" : l.startsWith("✗") ? "text-red-600" : ""}>
                          {l}
                        </div>
                      ))}
                    </div>
                    {st.status === "done" && (
                      <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Scrape complete — {st.matched.toLocaleString()} products matched, {st.priced.toLocaleString()} with prices
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Apply section */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Step 2 — Apply Prices</h2>
          <p className="text-sm text-slate-500">
            For each matched product, the average sister-site price is calculated across both sites, then multiplied by{" "}
            <strong>1.30</strong> to set the AWDP retail price. The original price is preserved for reference.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
                className="rounded"
              />
              Update all matched products (including those already priced)
            </label>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={applyPrices}
              disabled={applyStatus === "loading" || totalMatched === 0}
              className="gap-2"
            >
              {applyStatus === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Apply Price Updates
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowPreview(!showPreview); if (!showPreview) refetchPreview(); }}
              className="gap-1.5"
            >
              {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showPreview ? "Hide Preview" : "Preview Changes"}
            </Button>
          </div>

          {applyStatus === "done" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" /> {applyResult}
            </div>
          )}
          {applyStatus === "error" && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" /> {applyResult}
            </div>
          )}

          {showPreview && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Price changes preview{" "}
                  {previewLoading && <Loader2 className="w-3.5 h-3.5 inline animate-spin ml-1" />}
                </p>
                {preview && <span className="text-xs text-slate-500">{preview.length} changes shown (top 500)</span>}
              </div>
              {preview && preview.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {["Product", "Category", "Sister Avg", "AWDP New Price", "Sites"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 text-slate-600 font-medium border-b border-slate-200">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.sku} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 max-w-xs truncate text-slate-800">{row.name}</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.category}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              ${parseFloat(row.avg_sister_price).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">
                              ${parseFloat(row.new_price).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge variant="secondary">{row.site_count}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : preview && preview.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No price changes to preview. Run a scrape first.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">How It Works</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Fetches all product pages from allbrandwindowdoorparts.com and biltbestwindowparts.com (~4,200 pages)</li>
            <li>Matches each to an AWDP product by name similarity (Jaccard similarity ≥ 28%)</li>
            <li>Calculates the average price across all sister sites with a valid price</li>
            <li>Sets the AWDP price = sister average × 1.30 (30% premium)</li>
            <li>Scraping both sites takes approximately 5–10 minutes with rate limiting</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
