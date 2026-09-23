"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Transaction = {
  id: string;
  date: string;
  type: string;
  category: string;
  subCategory: string;
  amount: number;
};

const CHART_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#e84393", "#00cec9",
  "#fdcb6e", "#6c5ce7", "#ffeaa7", "#fab1a0", "#55efc4"
];

export default function DashboardPage() {
  const [searchTerm, setSearchTitle] = useState<string>("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Record<string, string[]>>({ "Pengeluaran": [] });

// Load data aman langsung dari Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      const currentYearMonth = new Date().toISOString().substring(0, 7);
      try {
        const savedCategory = localStorage.getItem("categoryOptions");
        if (savedCategory) {
          setCategoryOptions(JSON.parse(savedCategory));
        }

        // Mengambil data transaksi dari database Supabase
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });

        if (error) {
          console.error("Gagal memuat transaksi dari Supabase:", error.message);
          setAvailablePeriods([currentYearMonth]);
          setSelectedPeriod(currentYearMonth);
          return;
        }

        if (data && data.length > 0) {
          const mappedData: Transaction[] = data.map((item: any) => ({
            id: item.id.toString(),
            date: item.date,
            type: item.type,
            category: item.category || "",
            subCategory: item.sub_category || "-",
            amount: Number(item.amount),
          }));

          setTransactions(mappedData);

          const periodsSet = new Set<string>();
          mappedData.forEach((t) => {
            if (t.date && t.date.length >= 7) {
              periodsSet.add(t.date.substring(0, 7));
            }
          });

          let periods = Array.from(periodsSet).sort().reverse();
          if (periods.length === 0) {
            periods = [currentYearMonth];
          }

          setAvailablePeriods(periods);
          setSelectedPeriod(periods.includes(currentYearMonth) ? currentYearMonth : periods[0]);
        } else {
          setTransactions([]);
          setAvailablePeriods([currentYearMonth]);
          setSelectedPeriod(currentYearMonth);
        }
      } catch (e) {
        console.error("Gagal memuat data:", e);
        setAvailablePeriods([currentYearMonth]);
        setSelectedPeriod(currentYearMonth);
      }
    };

    fetchDashboardData();
  }, []);
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatPeriodLabel = (yearMonth: string) => {
    if (!yearMonth) return "";
    try {
      const [year, month] = yearMonth.split("-");
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    } catch {
      return yearMonth;
    }
  };

  const periodTransactions = transactions.filter((t) => {
    if (!t.date || !selectedPeriod) return false;
    return t.date.startsWith(selectedPeriod);
  });

  const totalPemasukan = periodTransactions
    .filter((t) => t.type?.toLowerCase().includes("pemasukan"))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalPengeluaran = periodTransactions
    .filter((t) => t.type?.toLowerCase().includes("pengeluaran"))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalAset = periodTransactions
    .filter((t) => t.type?.toLowerCase().includes("aset"))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const sisaSaldo = totalPemasukan - totalPengeluaran;
  const isDefisit = sisaSaldo < 0;

  const getPreviousAccumulatedBalance = () => {
    if (!selectedPeriod) return 0;
    const pastTransactions = transactions.filter((t) => {
      if (!t.date) return false;
      return t.date.substring(0, 7) < selectedPeriod;
    });

    const pastPemasukan = pastTransactions
      .filter((t) => t.type?.toLowerCase().includes("pemasukan"))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const pastPengeluaran = pastTransactions
      .filter((t) => t.type?.toLowerCase().includes("pengeluaran"))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return pastPemasukan - pastPengeluaran;
  };

  const saldoAwalBulanLalu = getPreviousAccumulatedBalance();
  const totalKeseluruhanSaldo = saldoAwalBulanLalu + sisaSaldo;

  const getMainCat = (t: Transaction) => t.subCategory || "";
  const getSubCat = (t: Transaction) => t.category || "";

  const expenseSummaryMap: Record<string, number> = {};
  periodTransactions
    .filter((t) => t.type?.toLowerCase().includes("pengeluaran"))
    .forEach((t) => {
      const sub = t.category || t.subCategory || "Lainnya";
      expenseSummaryMap[sub] = (expenseSummaryMap[sub] || 0) + (t.amount || 0);
    });

  const top3Expenses = Object.entries(expenseSummaryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const expenseChartData = Object.entries(expenseSummaryMap)
    .map(([subCat, amount]) => ({ subCat, amount }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const incomeSummaryMap: Record<string, number> = {};
  periodTransactions
    .filter((t) => t.type?.toLowerCase().includes("pemasukan"))
    .forEach((t) => {
      const sub = (t.subCategory && t.subCategory !== "-") ? t.subCategory : (t.category || "Lainnya");
      incomeSummaryMap[sub] = (incomeSummaryMap[sub] || 0) + (t.amount || 0);
    });

  const assetSummaryMap: Record<string, number> = {};
  transactions
    .filter((t) => {
      if (!t.date || !selectedPeriod) return false;
      return t.type?.toLowerCase().includes("aset") && t.date.substring(0, 7) <= selectedPeriod;
    })
    .forEach((t) => {
      const sub = (t.subCategory && t.subCategory !== "-") ? t.subCategory : (t.category || "Lainnya");
      assetSummaryMap[sub] = (assetSummaryMap[sub] || 0) + (t.amount || 0);
    });

  const exportToExcel = () => {
    if (periodTransactions.length === 0) {
      alert("Tidak ada data transaksi pada periode ini untuk diexport.");
      return;
    }

    const headers = ["ID", "Tanggal", "Tipe", "Sub Kategori", "Keterangan Bebas", "Nominal"];
    const rows = periodTransactions.map((t) => [
      t.id,
      t.date,
      t.type,
      `"${getMainCat(t)}"`,
      `"${getSubCat(t)}"`,
      t.amount,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_keuangan_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

    function getTargetForSubCategory(subCat: string, selectedPeriod: string) {
      if (!subCat || !/^\d{4}-\d{2}$/.test(selectedPeriod)) return 0;

      const [year, month] = selectedPeriod.split("-").map(Number);
      const category = subCat.trim().toUpperCase();
      const totals = [0, 0, 0];

      transactions.forEach((t) => {
        if (
          !t.date ||
          !t.type?.toLowerCase().includes("pengeluaran") ||
          getSubCat(t).trim().toUpperCase() !== category
        ) {
          return;
        }

        const [transactionYear, transactionMonth] = t.date
          .substring(0, 7)
          .split("-")
          .map(Number);
        const monthsAgo = (year - transactionYear) * 12 + (month - transactionMonth);

        if (monthsAgo >= 1 && monthsAgo <= 3) {
          totals[monthsAgo - 1] += t.amount || 0;
        }
      });

      return totals.reduce((sum, amount) => sum + amount, 0) / 3;
    }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 selection:bg-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header & Navigation */}
        <header className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 p-4 sm:px-6 sm:py-5 rounded-2xl shadow-2xl flex flex-col xl:flex-row justify-between items-center gap-4 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>

          <div className="flex items-center gap-3 w-full xl:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-inner text-base">
              ❖
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                FINANCIAL PLANNER
              </h1>
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase mt-0.5">
                Executive Dashboard • {selectedPeriod ? selectedPeriod.split("-")[0] : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-start xl:justify-end w-full xl:w-auto">
            <Link
              href="/"
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition border border-slate-700/60 flex items-center gap-1"
            >
              <span>←</span> Input
            </Link>

            <Link
              href="/budgeting"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center gap-1"
            >
              <span>🎯</span> Budgeting
            </Link>

            <Link
              href="/annual"
              className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center gap-1"
            >
              <span>📊</span> Laporan Tahunan
            </Link>

            <button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center gap-1"
            >
              <span>📥</span> Export Excel
            </button>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
              <span className="text-[10px] text-slate-400 font-medium">Periode:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p} className="bg-slate-900 text-slate-100">
                    {formatPeriodLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">SALDO BULAN LALU</p>
            <p className="text-base sm:text-xl font-bold text-blue-400 mt-1 sm:mt-2 truncate">{formatRupiah(saldoAwalBulanLalu)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">PEMASUKAN</p>
            <p className="text-base sm:text-xl font-bold text-emerald-400 mt-1 sm:mt-2 truncate">{formatRupiah(totalPemasukan)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">PENGELUARAN</p>
            <p className="text-base sm:text-xl font-bold text-rose-400 mt-1 sm:mt-2 truncate">{formatRupiah(totalPengeluaran)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">SISA BULAN INI</p>
            <p className={`text-base sm:text-xl font-bold mt-1 sm:mt-2 truncate ${isDefisit ? "text-rose-400" : "text-emerald-400"}`}>
              {formatRupiah(sisaSaldo)}
            </p>
          </div>

          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-amber-400 tracking-wider">TOTAL AKUMULASI SALDO</p>
            <p className="text-base sm:text-xl font-bold text-white mt-1 sm:mt-2 truncate">{formatRupiah(totalKeseluruhanSaldo)}</p>
          </div>
        </div>

        {/* Baris 1: Top 3, Grafik, Rekap Pengeluaran */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top 3 Pengeluaran */}
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-300 tracking-wider mb-1">TOP 3 PENGELUARAN</h3>
              <p className="text-xs text-slate-500">Peringkat sub-kategori tertinggi bulan ini</p>
            </div>
            
            <div className="py-4 space-y-3">
              {top3Expenses.length > 0 ? (
                top3Expenses.map(([subCat, amount], index) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={subCat} className="flex items-center justify-between bg-slate-950 px-3.5 py-3 rounded-xl border border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">{medals[index]}</span>
                        <div className="max-w-[140px] sm:max-w-[180px]">
                          <p className="text-xs font-bold text-slate-200 truncate">{subCat}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-400">{formatRupiah(amount)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  Belum ada data pengeluaran.
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <p className="flex justify-between"><span>Transaksi Tercatat:</span> <span className="text-slate-200 font-bold">{periodTransactions.length} baris</span></p>
            </div>
          </div>

          {/* Grafik Donut */}
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-300 tracking-wider mb-1 text-center">DISTRIBUSI PENGELUARAN</h3>
              <p className="text-[11px] text-slate-500 text-center mb-4">Persentase berdasarkan sub-kategori</p>
            </div>

            <div className="flex flex-col items-center justify-center my-auto">
              {totalPengeluaran > 0 && expenseChartData.length > 0 ? (
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center shadow-inner border border-slate-800" style={{
                  background: `conic-gradient(${(() => {
                    let cumulativePercent = 0;
                    return expenseChartData.map((item, idx) => {
                      const percent = (item.amount / totalPengeluaran) * 100;
                      const start = cumulativePercent;
                      cumulativePercent += percent;
                      const color = CHART_COLORS[idx % CHART_COLORS.length];
                      return `${color} ${start}\%${cumulativePercent}%`;
                    }).join(", ");
                  })()})`
                }}>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950 rounded-full flex flex-col items-center justify-center border border-slate-800 shadow-inner">
                    <span className="text-[9px] text-slate-400 font-semibold">TOTAL</span>
                    <span className="text-[10px] font-bold text-rose-400 truncate max-w-[60px]">{formatRupiah(totalPengeluaran)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500 text-center p-4">
                  Belum ada data pengeluaran
                </div>
              )}
            </div>

            <div className="max-h-28 overflow-y-auto pr-1 space-y-1.5 mt-4 text-[11px]">
              {expenseChartData.map((item, idx) => {
                const percent = ((item.amount / totalPengeluaran) * 100).toFixed(1);
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <div key={item.subCat} className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="text-slate-300 font-medium truncate max-w-[150px] sm:max-w-[180px]">{item.subCat}</span>
                    </div>
                    <span className="text-slate-400 font-bold">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rekap Pengeluaran */}
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-slate-300 tracking-wider">REKAP PENGELUARAN</h3>
                <span className="text-xs font-mono font-bold text-rose-400">{formatRupiah(totalPengeluaran)}</span>
              </div>
              <p className="text-xs text-slate-500">Rincian per sub-kategori bulan ini</p>
            </div>

            <div className="py-4 max-h-56 overflow-y-auto pr-1 space-y-2 my-auto">
              {Object.entries(expenseSummaryMap).length > 0 ? (
                Object.entries(expenseSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3 py-2.5 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[180px]">{subCat}</span>
                    <span className="text-rose-400 font-bold font-mono">{formatRupiah(amount)}</span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">
                  Belum ada pengeluaran di bulan ini.
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span>Total Kategori:</span>
              <span className="text-slate-200 font-bold">{Object.keys(expenseSummaryMap).length} kategori</span>
            </div>
          </div>

        </div>

        {/* Baris 2: Pemasukan & Aset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-slate-300 tracking-wider">REKAP PEMASUKAN</h3>
                <span className="text-xs font-mono font-bold text-emerald-400">{formatRupiah(totalPemasukan)}</span>
              </div>
              <p className="text-xs text-slate-500">Sumber pemasukan bulan ini</p>
            </div>

            <div className="py-4 max-h-52 overflow-y-auto pr-1 space-y-2 my-auto">
              {Object.entries(incomeSummaryMap).length > 0 ? (
                Object.entries(incomeSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3.5 py-3 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate max-w-[150px]">{subCat}</span>
                    <span className="text-emerald-400 font-bold font-mono">{formatRupiah(amount)}</span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">
                  Belum ada data pemasukan.
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span>Total Kategori:</span>
              <span className="text-slate-200 font-bold">{Object.keys(incomeSummaryMap).length} kategori</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-slate-300 tracking-wider">REKAP ASET & INVESTASI</h3>
                <span className="text-xs font-mono font-bold text-blue-400">{formatRupiah(totalAset)}</span>
              </div>
              <p className="text-xs text-slate-500">Akumulasi aset hingga bulan ini</p>
            </div>

            <div className="py-4 max-h-52 overflow-y-auto pr-1 space-y-2 my-auto">
              {Object.entries(assetSummaryMap).length > 0 ? (
                Object.entries(assetSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3.5 py-3 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate max-w-[150px]">{subCat}</span>
                    <span className="text-blue-400 font-bold font-mono">{formatRupiah(amount)}</span>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">
                  Belum ada data aset.
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
              <span>Total Kategori:</span>
              <span className="text-slate-200 font-bold">{Object.keys(assetSummaryMap).length} kategori</span>
            </div>
          </div>

        </div>
        {/* PROGRESS BUDGET TABLE */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-200">PROGRESS BUDGET (TARGET VS AKTUAL)</h2>
            <p className="text-xs text-slate-400">Target dihitung dari rata-rata pengeluaran 3 bulan sebelumnya berdasarkan master data resmi.</p>
          </div>
          
<div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3 font-semibold">SUB KATEGORI</th>
                  <th className="p-3 font-semibold text-right">TARGET (AVG 3 BLN)</th>
                  <th className="p-3 font-semibold text-right">AKTUAL (BULAN INI)</th>
                  <th className="p-3 font-semibold text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {categoryOptions["Pengeluaran"]?.map((subCat: string) => {
                  const key = subCat.toUpperCase();

                  const targetVal = getTargetForSubCategory(subCat, selectedPeriod);
                  const actualVal = periodTransactions
                    .filter((t) => t.type.toLowerCase().includes("pengeluaran") && getSubCat(t) === key)
                    .reduce((sum, t) => sum + t.amount, 0);

                  const isOver = actualVal > targetVal && targetVal > 0;

                  return (
                    <tr key={subCat} className="hover:bg-slate-950/50 transition">
                      <td className="p-3 text-slate-200 font-bold">{subCat}</td>
                      <td className="p-3 text-right font-mono text-slate-300">{formatRupiah(targetVal)}</td>
                      <td className="p-3 text-right font-mono text-rose-400 font-bold">{formatRupiah(actualVal)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${isOver ? "bg-rose-950 text-rose-400 border border-rose-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                          {isOver ? "OVER" : "TIDAK OVER"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* DAFTAR TRANSAKSI PERIODE INI */}
        <section className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-200">DAFTAR TRANSAKSI ({formatPeriodLabel(selectedPeriod).toUpperCase()})</h2>
              <p className="text-xs text-slate-400">Semua transaksi tercatat pada periode ini.</p>
            </div>
            
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 px-3 py-2 rounded-xl text-xs outline-none transition shadow-inner"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[600px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3 font-semibold">TANGGAL</th>
                  <th className="p-3 font-semibold">TIPE</th>
                  <th className="p-3 font-semibold">SUB KATEGORI</th>
                  <th className="p-3 font-semibold">KETERANGAN</th>
                  <th className="p-3 font-semibold text-right">NOMINAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {periodTransactions.length > 0 ? (
                  periodTransactions
                    .filter((t) => {
                      const query = searchTerm.toLowerCase();
                      const subCat = getMainCat(t).toLowerCase();
                      const freeDesc = getSubCat(t).toLowerCase();
                      const type = (t.type || "").toLowerCase();
                      const date = (t.date || "").toLowerCase();
                      
                      return (
                        subCat.includes(query) ||
                        freeDesc.includes(query) ||
                        type.includes(query) ||
                        date.includes(query)
                      );
                    })
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-slate-950/50 transition">
                        <td className="p-3 text-slate-300 whitespace-nowrap">{t.date}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type?.toLowerCase().includes("pemasukan") ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                            t.type?.toLowerCase().includes("aset") ? "bg-blue-950 text-blue-400 border border-blue-900" :
                            "bg-rose-950 text-rose-400 border border-rose-900"
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-200">{getSubCat(t) || "-"}</td>
                        <td className="p-3 text-slate-400">{getMainCat(t)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-100 whitespace-nowrap">{formatRupiah(t.amount)}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Tidak ada transaksi tercatat pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}