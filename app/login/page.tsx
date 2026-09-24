"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const router = useRouter();

  const handleForgotPassword = async () => {
  // Mengambil nilai email dari state/input yang sedang diketik pengguna
  const emailInput = (document.getElementById("email") as HTMLInputElement)?.value;
  
  if (!emailInput) {
    alert("Silakan masukkan email Anda terlebih dahulu pada kolom email.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(emailInput, {
    redirectTo: `${window.location.origin}/dashboard`,
  });

  if (error) {
    alert("Gagal mengirim email pemulihan: " + error.message);
  } else {
    alert("Tautan pemulihan kata sandi telah dikirim ke email Anda. Silakan cek inbox/spam.");
  }
};

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Format User ID menjadi email (menyesuaikan akun utama atau domain lokal)
    const cleanUserId = userId.trim().toLowerCase();
    const emailToUse = cleanUserId === "ragaraisuli" 
      ? "ragaraisuli@gmail.com" 
      : `${cleanUserId}@gmail.com`;

    if (isSignUp) {
      // Proses Daftar Akun Baru (Sign Up)
      const { error } = await supabase.auth.signUp({
        email: emailToUse,
        password,
      });

      if (error) {
        setMessage({ text: error.message || "Gagal mendaftarkan akun.", type: "error" });
        setLoading(false);
      } else {
        setMessage({ 
          text: "Pendaftaran berhasil! Silakan langsung klik tombol Masuk.", 
          type: "success" 
        });
        setIsSignUp(false);
        setLoading(false);
      }
    } else {
      // Proses Masuk (Login)
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        setMessage({ text: "User ID atau Password salah!", type: "error" });
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-white">Financial Planner</h1>
          <p className="text-xs text-slate-400">
            {isSignUp ? "Buat akun baru untuk akses catatan" : "Silakan login untuk akses data keuangan"}
          </p>
        </div>

        {message && (
          <div className={`text-xs p-3 rounded-xl text-center border ${
            message.type === "error" 
              ? "bg-rose-950/60 border-rose-900 text-rose-400" 
              : "bg-emerald-950/60 border-emerald-900 text-emerald-400"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">User ID</label>
            <input
              type="text"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Contoh: finance"
              className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? "Memproses..." : isSignUp ? "Daftar Akun (Sign Up)" : "Masuk (Login)"}
          </button>
        </form>

{!isSignUp && (
  <div className="text-right mb-4">
    <button
      type="button"
      onClick={handleForgotPassword} // <-- Hubungkan ke fungsi di atas
      className="text-xs text-slate-400 hover:text-emerald-400 transition"
    >
      Lupa Password?
    </button>
  </div>
)}

        <div className="text-center pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 transition"
          >
            {isSignUp 
              ? "Sudah punya akun? Masuk di sini" 
              : "Belum punya akun? Buat baru (Sign Up)"}
          </button>
        </div>
      </div>
    </main>
  );
}