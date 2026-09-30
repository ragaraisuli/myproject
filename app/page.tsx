"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Transaction = {
  id: string;
  date: string;
  type: string;
  category: string;
  subCategory: string;
  amount: number;
};

const DEFAULT_CATEGORY_OPTIONS: Record<string, string[]> = {
  Pemasukan: ["Gaji Suami", "Bonus", "Investasi", "Lainnya"],
  Pengeluaran: [],
  Aset: ["Tabungan Bank", "Emas", "Reksa Dana", "Kas Tunai"],
};

export default function Home() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [date, setDate] = useState("");
  const [type, setType] = useState("Pemasukan");
  const [category, setCategory] = useState("Gaji Suami");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // State untuk mengontrol Bottom Sheet
  const [isSubCategorySheetOpen, setIsSubCategorySheetOpen] = useState(false);

  const [dynamicSubCategories, setDynamicSubCategories] = useState<Record<string, string[]>>({
    Pemasukan: [],
    Pengeluaran: [],
    Aset: [],
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUserId(session.user.id);
        setIsCheckingAuth(false);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUserId(session?.user?.id || null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from("sub_categories")
        .select("*")
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Gagal memuat sub kategori:", error.message);
      } else if (data) {
        const extracted: Record<string, string[]> = {
          Pemasukan: [],
          Pengeluaran: [],
          Aset: [],
        };

        data.forEach((item: any) => {
          const tType = item.type;
          if (extracted[tType] && !extracted[tType].includes(item.name)) {
            extracted[tType].push(item.name);
          }
        });

        setDynamicSubCategories(extracted);
      }
    };

    if (!isCheckingAuth && currentUserId) {
      fetchSubCategories();
    }
  }, [isCheckingAuth, currentUserId]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!currentUserId) return;

      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      try {
        while (hasMore) {
          const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", currentUserId)
            .order("date", { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) break;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < pageSize) hasMore = false;
            else page++;
          } else {
            hasMore = false;
          }
        }

        const mappedData: Transaction[] = allData.map((item: any) => ({
          id: item.id.toString(),
          date: item.date,
          type: item.type,
          category: item.category,
          subCategory: item.sub_category || "-",
          amount: Number(item.amount),
        }));

        setTransactions(mappedData);
      } catch (err) {
        console.error("Kesalahan:", err);
      }
    };

    if (!isCheckingAuth && currentUserId) {
      fetchTransactions();
    }

    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, [isCheckingAuth, currentUserId]);

  const categoryOptions: Record<string, string[]> = {
    Pemasukan: Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS.Pemasukan, ...(dynamicSubCategories.Pemasukan || [])])),
    Pengeluaran: Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS.Pengeluaran, ...(dynamicSubCategories.Pengeluaran || [])])),
    Aset: Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS.Aset, ...(dynamicSubCategories.Aset || [])])),
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSaveNewSubCategory = async () => {
    const trimmedName = newSubName.trim();
    if (!trimmedName) {
      alert("Nama sub kategori tidak boleh kosong!");
      return;
    }

    const capitalizedName = trimmedName.toUpperCase();
    const currentOptions = categoryOptions[type] || [];
    
    if (currentOptions.includes(capitalizedName)) {
      alert("Sub kategori sudah ada!");
      return;
    }

    if (!currentUserId) return;

    const { error } = await supabase.from("sub_categories").insert([
      { user_id: currentUserId, type: type, name: capitalizedName },
    ]);

    if (error) {
      alert("Gagal menyimpan: " + error.message);
      return;
    }

    setDynamicSubCategories((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), capitalizedName],
    }));

    setCategory(capitalizedName);
    setIsAddSubModalOpen(false);
    setNewSubName("");
  };

  const handleDeleteSubCategory = async () => {
    if (!category) return;
    if (!window.confirm(`Hapus sub kategori "${category}"?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("sub_categories")
        .delete()
        .eq("user_id", session.user.id)
        .eq("name", category)
        .eq("type", type);

      if (error) {
        alert("Gagal menghapus dari database.");
        return;
      }

      const currentOptions = categoryOptions[type] || [];
      const updatedOptions = currentOptions.filter((item) => item !== category);

      setDynamicSubCategories((prev) => ({
        ...prev,
        [type]: (prev[type] || []).filter((item) => item !== category),
      }));

      setCategory(updatedOptions[0] || "");
      setIsSubCategorySheetOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const availableSubCategories = categoryOptions[newType] || [];
    setCategory(availableSubCategories[0] || "");
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date || !currentUserId) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) return;

    const newTxPayload = {
      user_id: currentUserId,
      date: date,
      type: type,
      category: category,
      sub_category: note,
      amount: parsedAmount,
    };

    const { data, error } = await supabase
      .from("transactions")
      .insert([newTxPayload])
      .select();

    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else if (data && data[0]) {
      const inserted = data[0];
      const newTxFormatted: Transaction = {
        id: inserted.id.toString(),
        date: inserted.date,
        type: inserted.type,
        category: inserted.category,
        subCategory: inserted.sub_category || "-",
        amount: Number(inserted.amount),
      };
      setTransactions([newTxFormatted, ...transactions]);
      setNote("");
      setAmount("");
      alert("Data berhasil disimpan!");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus catatan ini?")) {
      const { error } = await supabase.from("transactions").delete().match({ id });
      if (!error) {
        setTransactions(transactions.filter((t) => t.id !== id));
      }
    }
  };

  const totalPemasukan = transactions
    .filter((t) => t.type.toLowerCase().includes("pemasukan"))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalPengeluaran = transactions
    .filter((t) => t.type.toLowerCase().includes("pengeluaran"))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAsetInvestasi = transactions
    .filter((t) => t.type.toLowerCase().includes("aset"))
    .reduce((acc, t) => acc + t.amount, 0);

  const netAsetTabungan = (totalPemasukan - totalPengeluaran) + totalAsetInvestasi;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-xs text-slate-400 animate-pulse">Memeriksa sesi login...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        
        <div className="flex justify-between items-center">
          <button
            onClick={handleLogout}
            className="bg-rose-950/80 hover:bg-rose-900 border border-rose-900 text-rose-300 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 shadow-md"
          >
            <span>🚪</span> Keluar
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 shadow-md"
            >
              <span>📂</span> Impor Excel
            </button>
            <Link
              href="/dashboard"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-md"
            >
              Dashboard 📊
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-xl space-y-1">
          <h1 className="text-lg font-bold text-white">Financial Planner</h1>
          <p className="text-[11px] text-slate-400">Catat keuangan harian langsung dari HP</p>
        </div>

        {/* Total Ringkasan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-emerald-400 font-medium">Total Pemasukan</p>
            <p className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">{formatRupiah(totalPemasukan)}</p>
          </div>
          <span className="text-xl">📥</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-rose-400 font-medium">Total Pengeluaran</p>
            <p className="text-lg font-extrabold text-rose-400 font-mono mt-0.5">{formatRupiah(totalPengeluaran)}</p>
          </div>
          <span className="text-xl">📤</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-amber-400 font-medium">Total Aset & Investasi</p>
            <p className="text-lg font-extrabold text-amber-400 font-mono mt-0.5">{formatRupiah(netAsetTabungan)}</p>
          </div>
          <span className="text-xl">💰</span>
        </div>

        {/* Form Input */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-xs font-bold text-slate-200">+ Tambah Catatan Baru</h2>
          
          <form onSubmit={handleManualSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">1. Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none scheme-dark"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">2. Keterangan Utama</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none cursor-pointer"
              >
                <option value="Pemasukan">Pemasukan</option>
                <option value="Pengeluaran">Pengeluaran</option>
                <option value="Aset">Aset & Investasi</option>
              </select>
            </div>

            {/* TOMBOL CUSTOM BOTTOM SHEET (MENGGANTIKAN SELECT BAWAAN HP) */}
            <div>
               <label className="block text-slate-400 mb-1">3. Sub Kategori</label>
               {isMounted ? (
                 <button
                   type="button"
                   onClick={() => setIsSubCategorySheetOpen(true)}
                   className="w-full bg-slate-950 text-slate-200 px-3.5 py-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs hover:border-emerald-500 transition shadow-inner"
                 >
                   <span className="font-bold text-emerald-400 text-sm tracking-wide">{category || "Pilih Sub Kategori"}</span>
                   <span className="text-slate-400 bg-slate-900 px-2 py-1 rounded-lg text-[10px]">Ubah ▼</span>
                 </button>
               ) : (
                 <div className="w-full bg-slate-950 text-slate-500 px-3.5 py-3 rounded-xl border border-slate-800">
                   Memuat pilihan...
                 </div>
               )}
            </div>

            <div>
              <label className="block text-slate-400 mb-1">4. Keterangan Bebas (Opsional)</label>
              <input
                type="text"
                placeholder="Misal: Beli token listrik"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">5. Nominal (Rp)</label>
              <input
                type="number"
                required
                placeholder="Contoh: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-100 hover:bg-white text-slate-950 font-bold py-3 rounded-xl transition shadow-md mt-2"
            >
              Simpan
            </button>
          </form>
        </div>

        {/* Riwayat */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <h2 className="text-xs font-bold text-slate-200">📜 Riwayat Catatan</h2>
          {transactions.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-4">Belum ada data tercatat.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {transactions.map((t) => {
                const isPemasukan = t.type.toLowerCase().includes("pemasukan");
                const isAset = t.type.toLowerCase().includes("aset");
                const colorClass = isPemasukan ? "text-emerald-400" : isAset ? "text-amber-400" : "text-rose-400";
                
                return (
                  <div key={t.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">{t.category}</p>
                      <p className="text-[10px] text-slate-400">
                        {t.date} • <span className={colorClass}>{t.type}</span> {t.subCategory && t.subCategory !== "-" ? `• ${t.subCategory}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-mono font-bold ${colorClass}`}>
                        {isPemasukan || isAset ? "+" : "-"}{formatRupiah(t.amount)}
                      </p>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-slate-500 hover:text-rose-400 transition p-1"
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* BOTTOM SHEET CUSTOM MODAL */}
      {isSubCategorySheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm transition-opacity">
          <div className="bg-slate-900 border-t border-slate-800 w-full max-w-md rounded-t-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
            
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-1"></div>

            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Pilih Sub Kategori</h3>
                <p className="text-[10px] text-slate-400">Kategori: <span className="text-emerald-400 font-semibold">{type}</span></p>
              </div>
              <button
                onClick={() => setIsSubCategorySheetOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1 rounded-full text-xs font-bold"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 py-1 max-h-[45vh]">
              {Array.isArray(categoryOptions[type]) && categoryOptions[type].map((subCat: string) => {
                const isSelected = category === subCat;
                return (
                  <button
                    type="button"
                    key={subCat}
                    onClick={() => {
                      setCategory(subCat);
                      setIsSubCategorySheetOpen(false);
                    }}
                    className={`p-3 rounded-xl text-xs font-medium text-center transition truncate border ${
                      isSelected
                        ? "bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20"
                        : "bg-slate-950 text-slate-300 hover:bg-slate-800 border-slate-800"
                    }`}
                  >
                    {subCat}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsSubCategorySheetOpen(false);
                  setIsAddSubModalOpen(true);
                }}
                className="w-full bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 border border-emerald-900 py-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>+</span> Tambah Sub Kategori Baru
              </button>

              {category && (
                <button
                  type="button"
                  onClick={handleDeleteSubCategory}
                  className="w-full bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/60 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <span>🗑️</span> Hapus Sub Kategori ({category})
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Modal Tambah Sub Kategori */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Tambah Sub Kategori Baru</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium">Nama Sub Kategori</label>
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Contoh: Belanja Bulanan"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSubModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNewSubCategory}
                className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}