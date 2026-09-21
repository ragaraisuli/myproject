"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
  Pengeluaran: ["MAKAN DILUAR", "LISTRIK", "BENSIN MOTOR", "BERBAGI", "BELANJA BULANAN"],
  Aset: ["Tabungan Bank", "Emas", "Reksa Dana", "Kas Tunai"],
};

export default function Home() {
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [date, setDate] = useState("");
  const [type, setType] = useState("Pemasukan");
  const [category, setCategory] = useState("Gaji Suami");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const [categoryOptions, setCategoryOptions] = useState<Record<string, string[]>>(DEFAULT_CATEGORY_OPTIONS);

  // Load data dari localStorage dengan pengecekan beberapa kemungkinan key
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Load Category Options
      const savedOptions = localStorage.getItem("categoryOptions");
      if (savedOptions) {
        try {
          const parsed = JSON.parse(savedOptions);
          setCategoryOptions({ ...DEFAULT_CATEGORY_OPTIONS, ...parsed });
        } catch (e) {
          console.error("Gagal memparsing categoryOptions", e);
        }
      }

      // 2. Load Transactions (Mengecek beberapa kemungkinan nama key sekaligus)
      const possibleKeys = ["family_transactions", "transactions", "catatan_keuangan", "data_transaksi"];
      let loadedTransactions: Transaction[] = [];

      for (const key of possibleKeys) {
        const savedTx = localStorage.getItem(key);
        if (savedTx) {
          try {
            const parsedTx = JSON.parse(savedTx);
            if (Array.isArray(parsedTx) && parsedTx.length > 0) {
              loadedTransactions = parsedTx;
              break; // Berhenti jika data ditemukan
            }
          } catch (e) {
            console.error(`Gagal memparsing key ${key}`, e);
          }
        }
      }

      if (loadedTransactions.length > 0) {
        setTransactions(loadedTransactions);
        // Standarisasikan ke key utama agar konsisten
        localStorage.setItem("family_transactions", JSON.stringify(loadedTransactions));
      }
    }

    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  // Sinkronisasi kategori default saat type berubah
  useEffect(() => {
    const currentOptions = categoryOptions[type] || [];
    if (currentOptions.length > 0 && !currentOptions.includes(category)) {
      setCategory(currentOptions[0]);
    }
  }, [type, categoryOptions]);

  const saveToStorage = (newTx: Transaction[]) => {
    setTransactions(newTx);
    if (typeof window !== "undefined") {
      localStorage.setItem("family_transactions", JSON.stringify(newTx));
    }
  };

  const handleSaveNewSubCategory = () => {
    const trimmedName = newSubName.trim();
    if (!trimmedName) {
      alert("Nama sub kategori tidak boleh kosong!");
      return;
    }

    const capitalizedName = trimmedName.toUpperCase();
    const currentOptions = categoryOptions[type] || [];
    
    if (currentOptions.includes(capitalizedName)) {
      alert("Sub kategori dengan nama tersebut sudah ada!");
      return;
    }

    const updatedCategoryOptions = {
      ...categoryOptions,
      [type]: [...currentOptions, capitalizedName],
    };
    setCategoryOptions(updatedCategoryOptions);
    if (typeof window !== "undefined") {
      localStorage.setItem("categoryOptions", JSON.stringify(updatedCategoryOptions));
    }

    setCategory(capitalizedName);
    setIsAddSubModalOpen(false);
    setNewSubName("");
  };

  const handleDeleteSubCategory = () => {
    if (!category) return;
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus sub kategori "${category}" dari kategori ${type}?`);
    if (!confirmDelete) return;

    const currentOptions = categoryOptions[type] || [];
    const updatedOptions = currentOptions.filter((item) => item !== category);

    const updatedMap = {
      ...categoryOptions,
      [type]: updatedOptions,
    };
    setCategoryOptions(updatedMap);
    if (typeof window !== "undefined") {
      localStorage.setItem("categoryOptions", JSON.stringify(updatedMap));
    }
    setCategory(updatedOptions[0] || "");
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const availableSubCategories = categoryOptions[newType] || [];
    setCategory(availableSubCategories[0] || "");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) return;

    if (category && category.trim() !== "") {
      const currentOptions = categoryOptions[type] || [];
      if (!currentOptions.includes(category)) {
        const updated = {
          ...categoryOptions,
          [type]: [...currentOptions, category]
        };
        setCategoryOptions(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem("categoryOptions", JSON.stringify(updated));
        }
      }
    }

    const newTx: Transaction = {
      id: Date.now().toString(),
      date,
      type,
      category: category,
      subCategory: note ? note : "-",
      amount: parsedAmount,
    };

    saveToStorage([newTx, ...transactions]);
    setNote("");
    setAmount("");
    alert("Data berhasil disimpan!");
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus catatan ini?")) {
      const filtered = transactions.filter((t) => t.id !== id);
      saveToStorage(filtered);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split("\n");
        const importedList: Transaction[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i].trim();
          if (!row) continue;

          const separator = row.includes(";") ? ";" : row.includes("\t") ? "\t" : ",";
          const cols = row.split(separator);

          if (cols.length >= 5) {
            let rawDate = cols[0]?.replace(/"/g, "").trim();
            const tType = cols[1]?.replace(/"/g, "").trim() || "PENGELUARAN";
            const tCategory = cols[2]?.replace(/"/g, "").trim() || "LAINNYA";
            const tSub = cols[3]?.replace(/"/g, "").trim() || "";
            
            const rawAmount = cols[4]?.replace(/"/g, "").replace(/Rp/gi, "").replace(/\./g, "").replace(/,/g, ".").trim();
            const tAmount = parseFloat(rawAmount);

            let formattedDate = rawDate;
            if (rawDate && rawDate.includes("/")) {
              const parts = rawDate.split("/");
              if (parts.length === 3 && parts[2].length === 4) {
                formattedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              }
            }

            if (formattedDate && !isNaN(tAmount)) {
              importedList.push({
                id: `${Date.now()}-${i}`,
                date: formattedDate,
                type: tType,
                category: tCategory,
                subCategory: tSub,
                amount: tAmount,
              });
            }
          }
        }

        if (importedList.length > 0) {
          const merged = [...importedList, ...transactions];
          saveToStorage(merged);
          setImportStatus(`Berhasil mengimpor ${importedList.length} data sekaligus!`);
          setTimeout(() => {
            setIsImportModalOpen(false);
            setImportStatus("");
          }, 1500);
        } else {
          setImportStatus("Format tidak terbaca. Pastikan file disimpan sebagai CSV.");
        }
      } catch {
        setImportStatus("Gagal membaca file.");
      }
    };
    reader.readAsText(file);
  };

  const totalPemasukan = transactions
    .filter((t) => t.type.toLowerCase().includes("pemasukan"))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalPengeluaran = transactions
    .filter((t) => t.type.toLowerCase().includes("pengeluaran"))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalAsetKekayaan = transactions
    .filter((t) => t.type.toLowerCase().includes("aset"))
    .reduce((acc, t) => acc + t.amount, 0);

  const netAsetTabungan = (totalPemasukan - totalPengeluaran) + totalAsetKekayaan;

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        
        {/* Tombol Atas */}
        <div className="flex justify-end gap-2">
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
            Buka Dashboard 📊
          </Link>
        </div>

        {/* Card Judul */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-xl space-y-1">
          <h1 className="text-lg font-bold text-white">Financial Planner</h1>
          <p className="text-[11px] text-slate-400">Catat keuangan harian langsung dari HP</p>
        </div>

        {/* Total Pemasukan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-emerald-400 font-medium">Total Pemasukan</p>
            <p className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">{formatRupiah(totalPemasukan)}</p>
          </div>
          <span className="text-xl">📥</span>
        </div>

        {/* Total Pengeluaran */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-rose-400 font-medium">Total Pengeluaran</p>
            <p className="text-lg font-extrabold text-rose-400 font-mono mt-0.5">{formatRupiah(totalPengeluaran)}</p>
          </div>
          <span className="text-xl">📤</span>
        </div>

        {/* Total Aset & Tabungan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[11px] text-amber-400 font-medium">Total Aset & Tabungan</p>
            <p className="text-lg font-extrabold text-amber-400 font-mono mt-0.5">{formatRupiah(netAsetTabungan)}</p>
          </div>
          <span className="text-xl">💰</span>
        </div>

        {/* Form Tambah Catatan Baru */}
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
                <option value="Aset">Aset & Kekayaan</option>
              </select>
            </div>

            <div>
               <label className="block text-slate-400 mb-1">3. Sub Kategori</label>
               {!isCustomSubCategory ? (
                 <select
                   value={category}
                   onChange={(e) => {
                     const val = e.target.value;
                     if (val === "__ADD_NEW__") {
                       setIsAddSubModalOpen(true);
                     } else if (val === "__DELETE_SUBCAT__") {
                       handleDeleteSubCategory();
                     } else {
                       setCategory(val);
                     }
                   }}
                   className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-slate-800 cursor-pointer"
                 >
                   <option value="" disabled>Pilih Sub Kategori</option>
                   {Array.isArray(categoryOptions[type]) && categoryOptions[type].map((subCat: string) => (
                     <option key={subCat} value={subCat}>
                       {subCat}
                     </option>
                   ))}
                   <option value="__ADD_NEW__" className="text-emerald-400 font-semibold">+ Tambah Sub Kategori Lain...</option>
                   <option value="__DELETE_SUBCAT__" className="text-red-400 font-semibold">- Hapus Sub Kategori Ini...</option>
                 </select>
               ) : (
                 <div className="space-y-2">
                   <input
                     type="text"
                     value={category}
                     onChange={(e) => setCategory(e.target.value)}
                     placeholder="Ketik sub kategori baru..."
                     autoFocus
                     className="w-full bg-slate-950 text-slate-200 px-3 py-2.5 rounded-xl border border-emerald-500 focus:outline-none"
                   />
                   <button
                     type="button"
                     onClick={() => {
                       setIsCustomSubCategory(false);
                       setCategory("");
                     }}
                     className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs"
                   >
                     Batal
                   </button>
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
              Simpan Data
            </button>
          </form>
        </div>

        {/* Riwayat Catatan */}
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
                
                const mainTitle = t.category;
                const subText = t.subCategory;
                return (
                  <div key={t.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-200">{mainTitle}</p>
                      <p className="text-[10px] text-slate-400">
                        {t.date} • <span className={colorClass}>{t.type}</span> {subText && subText !== "-" ? `• ${subText}` : ""}
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

      {/* Modal Impor Excel/CSV */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Impor Data Excel (Beberapa Bulan Sekaligus)</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Simpan file Excel Anda ke format <b className="text-emerald-400">CSV (Comma Delimited)</b>. Anda bisa mengimpor data 5 bulan sekaligus atau lebih tanpa batasan!
            </p>

            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 transition rounded-xl p-5 text-center cursor-pointer bg-slate-950 relative">
              <input
                type="file"
                accept=".csv, .txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="space-y-1">
                <span className="text-2xl">📂</span>
                <p className="text-xs font-semibold text-slate-300">Klik atau seret file ke sini</p>
              </div>
            </div>

            {importStatus && (
              <p className={`text-[11px] font-semibold text-center p-2 rounded-xl ${importStatus.includes("Berhasil") ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900" : "bg-rose-950/60 text-rose-400 border border-rose-900"}`}>
                {importStatus}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
                Simpan Sub Kategori
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}