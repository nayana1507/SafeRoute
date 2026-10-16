
"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, googleProvider } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      await signInWithPopup(auth, googleProvider);
      router.replace("/");
    } catch (error) {
      console.error("Google login error:", error);
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <h1 className="text-3xl font-bold">SafeRoute</h1>

        <p className="mt-3 text-slate-300">
          Sign in to find routes for your delivery journey.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
