type EventProps = Record<string, string | number | boolean>;

export const analytics = {
  track(event: string, props?: EventProps) {
    // Fire GA4 / gtag if loaded on page
    if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
      (window as any).gtag("event", event.replace(/\s+/g, "_").toLowerCase(), props ?? {});
    }
    // Log in development for visibility
    if (import.meta.env.DEV) {
      console.log("[analytics]", event, props ?? "");
    }
  },
};
