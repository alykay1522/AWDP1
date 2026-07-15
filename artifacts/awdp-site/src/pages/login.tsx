import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, name: name || undefined, phone: phone || undefined };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      navigate("/account");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "login" ? "Sign In" : "Create Account"}
          </CardTitle>
          <p className="text-sm text-slate-500">
            {mode === "login"
              ? "Sign in to view your orders and saved info."
              : "Save your info and track your orders."}
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label htmlFor="acct-name" className="block text-sm font-medium mb-1">Name</label>
                  <input
                    id="acct-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="acct-phone" className="block text-sm font-medium mb-1">Phone (optional)</label>
                  <input
                    id="acct-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="acct-email" className="block text-sm font-medium mb-1">Email</label>
              <input
                id="acct-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="acct-password" className="block text-sm font-medium mb-1">Password</label>
              <input
                id="acct-password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {mode === "register" && (
                <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-600">
            {mode === "login" ? (
              <>
                New customer?{" "}
                <button type="button" className="text-primary font-medium hover:underline" onClick={() => { setMode("register"); setError(null); }}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" className="text-primary font-medium hover:underline" onClick={() => { setMode("login"); setError(null); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Questions? Call us at <a href="tel:785-533-0244" className="underline">785-533-0244</a>.
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-slate-500 mt-6">
        <Link href="/shop" className="hover:underline">← Continue shopping</Link>
      </p>
    </div>
  );
}
