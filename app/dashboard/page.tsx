"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

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

  // Load data transaksi langsung dari Supabase
  useEffect(() => {
    const fetchDashboardData = async () => {
      const currentYearMonth = new Date().toISOString().substring(0, 7);
      try {
        // 1. Ambil sesi pengguna yang sedang aktif
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Looping otomatis untuk mengambil semua data tanpa batas (unlimited)
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", session.user.id)
            .order("date", { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);        

if (error) {
            console.error("Gagal memuat transaksi dari Supabase:", error.message);
            break;
          }

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }

        if (allData.length > 0) {
          const mappedData: Transaction[] = allData.map((item: any) => ({
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

  const savingsRate = totalPemasukan > 0 ? (sisaSaldo / totalPemasukan) * 100 : 0;

  const getHealthStatus = () => {
    if (totalPemasukan === 0 && totalPengeluaran === 0) return { label: "Belum Ada Data", color: "text-gray-400", bg: "bg-gray-900/60 border-gray-800" };
    if (isDefisit) return { label: "Defisit (Waspada)", color: "text-red-400", bg: "bg-red-950/40 border-red-800/60" };
    if (savingsRate >= 30) return { label: "Sangat Sehat (Excellent)", color: "text-emerald-400", bg: "bg-emerald-950/40 border-emerald-800/60" };
    if (savingsRate >= 10) return { label: "Sehat & Stabil (Good)", color: "text-blue-400", bg: "bg-blue-950/40 border-blue-800/60" };
    return { label: "Perlu Perhatian (Fair)", color: "text-yellow-400", bg: "bg-yellow-950/40 border-yellow-800/60" };
  };

  const health = getHealthStatus();

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

    const exportData = periodTransactions.map((t, index) => ({
      "No": index + 1,
      "ID": t.id,
      "Tanggal": t.date,
      "Tipe": t.type,
      "Kategori Utama": getSubCat(t),
      "Keterangan / Sub": getMainCat(t),
      "Nominal": t.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Transaksi");

    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 8 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
    ];

    XLSX.writeFile(workbook, `Laporan_Keuangan_${selectedPeriod}.xlsx`);
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
        <header className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 p-4 sm:p-5 rounded-2xl shadow-2xl flex flex-col gap-4 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>

          {/* Baris Atas: Logo, Judul & Periode (Agar langsung terlihat di HP) */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-inner text-base flex-shrink-0">
                ❖
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white">
                  FINANCIAL PLANNER
                </h1>
                <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase mt-0.5">
                  Executive Dashboard • {selectedPeriod ? selectedPeriod.split("-")[0] : ""}
                </p>
              </div>
            </div>

            {/* Kotak Pilih Periode di HP / Kanan atas */}
            <div className="flex items-center justify-between sm:justify-end gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shadow-inner w-full sm:w-auto">
              <span className="text-[11px] text-slate-400 font-medium">Periode:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-emerald-400 font-bold text-xs outline-none cursor-pointer text-right"
              >
                {availablePeriods.map((p) => (
                  <option key={p} value={p} className="bg-slate-900 text-slate-100">
                    {formatPeriodLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Baris Bawah: Tombol Menu Navigasi (Grid 2 kolom di HP, Flex ke samping di Laptop) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            <Link
              href="/"
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition border border-slate-700/60 flex items-center justify-center sm:justify-start gap-1"
            >
              <span>←</span> Input
            </Link>

            <Link
              href="/budgeting"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center justify-center sm:justify-start gap-1"
            >
              <span>🎯</span> Budgeting
            </Link>

            <Link
              href="/annual"
              className="bg-violet-600 hover:bg-violet-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center justify-center sm:justify-start gap-1"
            >
              <span>📊</span> Laporan Tahunan
            </Link>

            <button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-md flex items-center justify-center sm:justify-start gap-1 col-span-2 sm:col-span-1"
            >
              <span>📥</span> Export Excel
            </button>
          </div>
        </header>

{/* Top Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">SALDO BULAN LALU</p>
            <p className="text-sm sm:text-xl font-bold text-blue-400 mt-1 sm:mt-2 truncate">{formatRupiah(saldoAwalBulanLalu)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">PEMASUKAN</p>
            <p className="text-sm sm:text-xl font-bold text-emerald-400 mt-1 sm:mt-2 truncate">{formatRupiah(totalPemasukan)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">PENGELUARAN</p>
            <p className="text-sm sm:text-xl font-bold text-rose-400 mt-1 sm:mt-2 truncate">{formatRupiah(totalPengeluaran)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">SISA BULAN INI</p>
            <p className={`text-sm sm:text-xl font-bold mt-1 sm:mt-2 truncate ${isDefisit ? "text-rose-400" : "text-emerald-400"}`}>
              {formatRupiah(sisaSaldo)}
            </p>
          </div>

          {/* Kartu Kelima (Total Akumulasi Saldo) otomatis melebar penuh di bawah pada HP, dan kembali normal di Laptop */}
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-4 rounded-2xl shadow-lg flex flex-row lg:flex-col justify-between items-center lg:items-start">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-amber-400 tracking-wider">TOTAL AKUMULASI SALDO</p>
              <p className="text-base sm:text-xl font-bold text-white mt-0.5 lg:mt-2 truncate">{formatRupiah(totalKeseluruhanSaldo)}</p>
            </div>
            {/* Indikator kecil tambahan opsional untuk mempermanis tampilan mobile */}
            <span className="hidden lg:block text-[10px] text-slate-400">Akumulasi keseluruhan</span>
          </div>
        </div>

        {/* Financial Health Score Banner */}
        <div className={`mb-6 p-4 sm:p-6 rounded-2xl border ${health.bg} shadow-xl backdrop-blur-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4`}>
          <div>
            <div className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Financial Health Score</div>
            <div className={`text-lg sm:text-xl font-extrabold mt-0.5 sm:mt-1 ${health.color}`}>{health.label}</div>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Berdasarkan rasio tabungan terhadap total pemasukan bulan berjalan.</p>
          </div>
          
          <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-6 bg-gray-900/60 px-4 sm:px-5 py-3 rounded-xl border border-gray-800 w-full lg:w-auto">
            <div>
              <div className="text-[11px] sm:text-xs text-gray-400">Rasio Tabungan</div>
              <div className="text-base sm:text-lg font-bold text-white">{savingsRate.toFixed(1)}%</div>
            </div>
            <div className="h-8 w-[1px] bg-gray-800"></div>
            <div>
              <div className="text-[11px] sm:text-xs text-gray-400">Sisa Saldo</div>
              <div className={`text-base sm:text-lg font-bold truncate ${sisaSaldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatRupiah(sisaSaldo)}
              </div>
            </div>
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
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className="text-sm shrink-0">{medals[index]}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-200 truncate">{subCat}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-400 shrink-0">{formatRupiah(amount)}</span>
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
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-950 rounded-full flex flex-col items-center justify-center border border-slate-800 shadow-inner px-1 text-center">
                    <span className="text-[9px] text-slate-400 font-semibold">TOTAL</span>
                    <span className="text-[10px] font-bold text-rose-400 truncate w-full">{formatRupiah(totalPengeluaran)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500 text-center p-4">
                  Belum ada data pengeluaran
                </div>
              )}
            </div>

            <div className="max-h-28 overflow-y-auto pr-1 space-y-1.5 mt-4 text-[11px] custom-scrollbar">
              {expenseChartData.map((item, idx) => {
                const percent = ((item.amount / totalPengeluaran) * 100).toFixed(1);
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <div key={item.subCat} className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="text-slate-300 font-medium truncate">{item.subCat}</span>
                    </div>
                    <span className="text-slate-400 font-bold shrink-0">{percent}%</span>
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

            <div className="py-4 max-h-56 overflow-y-auto pr-1 space-y-2 my-auto custom-scrollbar">
              {Object.entries(expenseSummaryMap).length > 0 ? (
                Object.entries(expenseSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3 py-2.5 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate flex-1 mr-2">{subCat}</span>
                    <span className="text-rose-400 font-bold font-mono shrink-0">{formatRupiah(amount)}</span>
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

{/* Baris 2 Pemasukan & Aset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-sm font-bold text-slate-300 tracking-wider">REKAP PEMASUKAN</h3>
                <span className="text-xs font-mono font-bold text-emerald-400">{formatRupiah(totalPemasukan)}</span>
              </div>
              <p className="text-xs text-slate-500">Sumber pemasukan bulan ini</p>
            </div>

            <div className="py-4 max-h-52 overflow-y-auto pr-1 space-y-2 my-auto custom-scrollbar">
              {Object.entries(incomeSummaryMap).length > 0 ? (
                Object.entries(incomeSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3.5 py-3 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate flex-1 mr-2">{subCat}</span>
                    <span className="text-emerald-400 font-bold font-mono shrink-0">{formatRupiah(amount)}</span>
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

            <div className="py-4 max-h-52 overflow-y-auto pr-1 space-y-2 my-auto custom-scrollbar">
              {Object.entries(assetSummaryMap).length > 0 ? (
                Object.entries(assetSummaryMap).map(([subCat, amount]) => (
                  <div key={subCat} className="flex justify-between items-center bg-slate-950 px-3.5 py-3 rounded-xl text-xs border border-slate-800/80">
                    <span className="text-slate-300 font-medium truncate flex-1 mr-2">{subCat}</span>
                    <span className="text-blue-400 font-bold font-mono shrink-0">{formatRupiah(amount)}</span>
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
            <p className="text-xs text-slate-400">Target dihitung dari rata-rata pengeluaran 3 bulan sebelumnya berdasarkan data kategori transaksi.</p>
          </div>
          
          {/* --- VERSİ DESKTOP (Tabel Asli - Sembunyi di HP) --- */}
          <div className="hidden md:block overflow-x-auto">
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
                {Array.from(
                  new Set(
                    transactions
                      .filter((t) => t.type?.toLowerCase().includes("pengeluaran") && t.category)
                      .map((t) => t.category)
                  )
                ).map((subCat: string) => {
                  const key = subCat.toUpperCase();
                  const targetVal = getTargetForSubCategory(subCat, selectedPeriod);
                  const actualVal = periodTransactions
                    .filter((t) => t.type?.toLowerCase().includes("pengeluaran") && getSubCat(t).toUpperCase() === key)
                    .reduce((sum, t) => sum + (t.amount || 0), 0);
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

          {/* --- VERSI HP (Tampilan Kartu Vertikal - Sembunyi di Laptop) --- */}
          <div className="block md:hidden space-y-3">
            {Array.from(
              new Set(
                transactions
                  .filter((t) => t.type?.toLowerCase().includes("pengeluaran") && t.category)
                  .map((t) => t.category)
              )
            ).map((subCat: string) => {
              const key = subCat.toUpperCase();
              const targetVal = getTargetForSubCategory(subCat, selectedPeriod);
              const actualVal = periodTransactions
                .filter((t) => t.type?.toLowerCase().includes("pengeluaran") && getSubCat(t).toUpperCase() === key)
                .reduce((sum, t) => sum + (t.amount || 0), 0);
              const isOver = actualVal > targetVal && targetVal > 0;

              return (
                <div key={subCat} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-200 font-bold text-xs">{subCat}</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${isOver ? "bg-rose-950 text-rose-400 border border-rose-900" : "bg-emerald-950 text-emerald-400 border border-emerald-900"}`}>
                      {isOver ? "OVER" : "TIDAK OVER"}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Target: {formatRupiah(targetVal)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400">Aktual:</span>
                    <span className="font-mono text-rose-400 font-bold text-xs">{formatRupiah(actualVal)}</span>
                  </div>
                </div>
              );
            })}
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
          
          {/* --- VERSI DESKTOP (Tabel Asli - Sembunyi di HP) --- */}
          <div className="hidden md:block overflow-x-auto">
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
                        <td className="p-3 text-slate-300">{t.date}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.type?.toLowerCase().includes("pemasukan") ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : t.type?.toLowerCase().includes("pengeluaran") ? "bg-rose-950 text-rose-400 border border-rose-900" : "bg-blue-950 text-blue-400 border border-blue-900"}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-200 font-bold">{getSubCat(t)}</td>
                        <td className="p-3 text-slate-400">{getMainCat(t)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-200">{formatRupiah(t.amount)}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* --- VERSI HP (Tampilan Kartu Vertikal - Sembunyi di Laptop) --- */}
          <div className="block md:hidden space-y-3">
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
                .map((t) => {
                  const isPemasukan = t.type?.toLowerCase().includes("pemasukan");
                  return (
                    <div key={t.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">{t.date}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isPemasukan ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : t.type?.toLowerCase().includes("pengeluaran") ? "bg-rose-950 text-rose-400 border border-rose-900" : "bg-blue-950 text-blue-400 border border-blue-900"}`}>
                          {t.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-slate-200 font-bold text-xs">{getSubCat(t)}</p>
                          <p className="text-[11px] text-slate-400">{getMainCat(t)}</p>
                        </div>
                        <span className={`font-mono font-bold text-xs ${isPemasukan ? "text-emerald-400" : "text-rose-400"}`}>
                          {isPemasukan ? "+ " : ""}{formatRupiah(t.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="p-6 text-center text-slate-500 text-xs">
                Tidak ada transaksi pada periode ini.
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}