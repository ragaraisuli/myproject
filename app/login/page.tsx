"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header / Judul */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-900 text-emerald-400 text-xl mb-1 shadow-inner">
            📊
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">Financial Planner</h1>
          <p className="text-xs text-slate-400">Masuk untuk mengelola keuangan Anda</p>
        </div>

        {/* Pesan Error jika Gagal Login */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-900 text-rose-300 text-xs p-3 rounded-xl text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-slate-400 font-medium">Email</label>
            <input
              type="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 px-3.5 py-3 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-400 font-medium">Kata Sandi</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 text-slate-200 px-3.5 py-3 rounded-xl border border-slate-800 focus:border-emerald-500 focus:outline-none transition text-xs sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg mt-2 disabled:opacity-50 text-xs sm:text-sm tracking-wide"
          >
            {loading ? "Memproses..." : "Masuk ke Aplikasi"}
          </button>
        </form>

        {/* Footer Kecil */}
        <div className="text-center pt-2 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500">
            Terhubung secara aman dengan database Supabase
          </p>
        </div>

      </div>
    </main>
  );
}