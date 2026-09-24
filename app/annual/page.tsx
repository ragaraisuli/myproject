"use client";

import { supabase } from "@/app/lib/supabase";
import { useState, useEffect } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

type Transaction = {
  id: string;
  date: string;
  type: string;
  category?: string;
  subCategory?: string;
  description: string;
  amount: number;
};

const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DEFAULT_CATEGORY_OPTIONS: Record<string, string[]> = {
  Pemasukan: ["GAJI SUAMI", "GAJI ISTRI"],
  Pengeluaran: [],
};

export default function AnnualReportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [availableYears, setAvailableYears] = useState<string[]>(["2026"]);

// Ambil sub-kategori secara dinamis langsung dari data transaksi yang ada di Supabase
  const [categoryOptions, setCategoryOptions] = useState<Record<string, string[]>>({
    Pemasukan: [...DEFAULT_CATEGORY_OPTIONS.Pemasukan],
    Pengeluaran: [...DEFAULT_CATEGORY_OPTIONS.Pengeluaran],
  });

  // Di dalam fungsi fetch / useEffect saat data transaksi berhasil didapat dari Supabase, 
  // tambahkan logika ekstraksi ini:
  const dynamicIncomes = Array.from(
    new Set(
      transactions
        .filter((t) => t.type?.toLowerCase().includes("pemasukan") && t.category)
        .map((t) => t.category!.trim().toUpperCase())
    )
  );

  const dynamicExpenses = Array.from(
    new Set(
      transactions
        .filter((t) => t.type?.toLowerCase().includes("pengeluaran") && t.category)
        .map((t) => t.category!.trim().toUpperCase())
    )
  );

  const allIncomesSubCategories = Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS.Pemasukan, ...dynamicIncomes]));
  const allExpenseSubCategories = Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS.Pengeluaran, ...dynamicExpenses]));
  
useEffect(() => {
const fetchAnnualData = async () => {
      try {
        // 1. Ambil sesi pengguna yang sedang aktif
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 2. Mengambil data transaksi tahunan dengan filter user_id
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", session.user.id) // <-- Tambahkan filter ini!
          .order("date", { ascending: false });

        if (error) {
          console.error("Gagal memuat transaksi tahunan dari Supabase:", error.message);
          return;
        }

        if (data && data.length > 0) {
          const parsed = data.map((item: any) => ({
            id: item.id.toString(),
            date: item.date,
            type: item.type,
            category: item.category || "",
            subCategory: item.sub_category || "-",
            description: item.description || "",
            amount: Number(item.amount),
          }));

          setTransactions(parsed);

          const yearsSet = new Set<string>();
          parsed.forEach((t) => {
            if (t.date) {
              const d = new Date(t.date);
              if (!isNaN(d.getTime())) {
                yearsSet.add(d.getFullYear().toString());
              } else {
                const year = String(t.date).substring(0, 4);
                if (year) yearsSet.add(year);
              }
            }
          });

          const years = Array.from(yearsSet).sort().reverse();
          if (years.length > 0) {
            setAvailableYears(years);
            setSelectedYear(years[0]);
          }
        } else {
          setTransactions([]);
        }
      } catch (e) {
        console.error("Gagal memuat data dari Supabase", e);
      }
    };

    fetchAnnualData();
  }, []);

  const formatRupiah = (val: number) => {
    if (val === 0) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getIncomeByMonthAndSub = (monthIndex: number, subCat: string | undefined) => {
    const targetMonth = monthIndex + 1;
    return transactions
      .filter((t) => {
        if (!t.date || !t.type) return false;
        
        const isIncome = t.type.trim().toLowerCase() === "pemasukan";
        if (!isIncome) return false;

        const d = new Date(t.date);
        const isYearMonthMatch = !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear && (d.getMonth() + 1) === targetMonth;
        if (!isYearMonthMatch) return false;
    const itemSubCat = (t.subCategory || "").trim().toLowerCase();
    const itemMainCat = (t.category || "").trim().toLowerCase();
    const target = (subCat || "").trim().toLowerCase();

    if (target === "gaji suami") {
      return itemSubCat === "gaji suami" || itemMainCat === "gaji suami" || itemSubCat === "gaji_suami" || itemMainCat === "gaji_suami";
    } else if (target === "gaji istri") {
      return itemSubCat === "gaji istri" || itemMainCat === "gaji istri" || itemSubCat === "gaji_istri" || itemMainCat === "gaji_istri";
    } else {
      return itemSubCat !== "gaji suami" && itemMainCat !== "gaji suami" && itemSubCat !== "gaji istri" && itemMainCat !== "gaji istri" && itemSubCat !== "gaji_suami" && itemMainCat !== "gaji_suami" && itemSubCat !== "gaji_istri" && itemMainCat !== "gaji_istri";
    }
  })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const getTotalIncomeByMonth = (monthIndex: number) => {
    const targetMonth = monthIndex + 1;
    return transactions
      .filter((t) => {
        if (!t.date || !t.type) return false;
        const isIncome = t.type.trim().toLowerCase() === "pemasukan";
        if (!isIncome) return false;

        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear && (d.getMonth() + 1) === targetMonth;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const getExpenseByMonthAndSub = (monthIndex: number, subCat: string) => {
    const targetMonth = monthIndex + 1;
    return transactions
      .filter((t) => {
        if (!t.date || !t.type) return false;
        const isExpense = t.type.trim().toLowerCase() === "pengeluaran";
        if (!isExpense) return false;

        const itemCat = (t.category || t.subCategory || "").trim().toLowerCase();
        const target = subCat.trim().toLowerCase();
        if (itemCat !== target) return false;

        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear && (d.getMonth() + 1) === targetMonth;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const getTotalExpenseByMonth = (monthIndex: number) => {
    const targetMonth = monthIndex + 1;
    return transactions
      .filter((t) => {
        if (!t.date || !t.type) return false;
        const isExpense = t.type.trim().toLowerCase() === "pengeluaran";
        if (!isExpense) return false;

        const d = new Date(t.date);
        return !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear && (d.getMonth() + 1) === targetMonth;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const monthlyIncomes = monthNames.map((_, i) => getTotalIncomeByMonth(i));
  const monthlyExpenses = monthNames.map((_, i) => getTotalExpenseByMonth(i));

  const grandTotalIncome = monthlyIncomes.reduce((a, b) => a + b, 0);
  const grandTotalExpense = monthlyExpenses.reduce((a, b) => a + b, 0);

  // Data yang disiapkan untuk Grafik Recharts
  const chartData = monthNames.map((m, idx) => ({
    bulan: m.toUpperCase(),
    Pendapatan: monthlyIncomes[idx],
    Pengeluaran: monthlyExpenses[idx],
  }));

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const incomeRows = allIncomesSubCategories.map((sub) => {
      const rowData: Record<string, any> = { Kategori: sub };
      monthNames.forEach((m, idx) => {
        rowData[m] = getIncomeByMonthAndSub(idx, sub);
      });
      rowData["TOTAL"] = monthNames.reduce((acc, _, idx) => acc + getIncomeByMonthAndSub(idx, sub), 0);
      return rowData;
    });

    const totalIncomeRow: Record<string, any> = { Kategori: "TOTAL PENDAPATAN" };
    monthNames.forEach((m, idx) => {
      totalIncomeRow[m] = getTotalIncomeByMonth(idx);
    });
    totalIncomeRow["TOTAL"] = grandTotalIncome;
    incomeRows.push(totalIncomeRow);

    const wsIncome = XLSX.utils.json_to_sheet(incomeRows);
    XLSX.utils.book_append_sheet(wb, wsIncome, "Pendapatan");

    const expenseRows = allExpenseSubCategories
      .filter((sub): sub is string => typeof sub === "string")
      .map((sub) => {
        const rowTotal = monthNames.reduce((acc, _, idx) => acc + getExpenseByMonthAndSub(idx, sub), 0);
        if (rowTotal === 0) return null;

        const rowData: Record<string, any> = { Kategori: sub };
        monthNames.forEach((m, idx) => {
          rowData[m] = getExpenseByMonthAndSub(idx, sub);
        });
        rowData["TOTAL"] = rowTotal;
        return rowData;
      })
      .filter(Boolean);

    const totalExpenseRow: Record<string, any> = { Kategori: "TOTAL PENGELUARAN" };
    monthNames.forEach((m, idx) => {
      totalExpenseRow[m] = getTotalExpenseByMonth(idx);
    });
    totalExpenseRow["TOTAL"] = grandTotalExpense;
    expenseRows.push(totalExpenseRow);

    const wsExpense = XLSX.utils.json_to_sheet(expenseRows as any[]);
    XLSX.utils.book_append_sheet(wb, wsExpense, "Pengeluaran");

    XLSX.writeFile(wb, `Laporan_Keuangan_${selectedYear}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 selection:bg-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-indigo-400">
              LAPORAN & GRAFIK TAHUNAN {selectedYear}
            </h1>
            <p className="text-xs text-slate-400 mt-1">Ringkasan Pendapatan dan Pengeluaran Bulanan secara Menyeluruh</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition border border-emerald-500 flex items-center gap-2 shadow-lg"
            >
              📊 Export ke Excel
            </button>

            <Link
              href="/dashboard"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition border border-slate-700"
            >
              Kembali ke Dashboard Bulanan
            </Link>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-900 text-indigo-400 font-bold text-sm border border-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* TABEL 1: PENDAPATAN PER BULAN */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
          <h2 className="text-sm font-bold tracking-wider text-emerald-400">SUMMARY PENDAPATAN PER BULAN</h2>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3 font-semibold sticky left-0 bg-slate-950 z-10">KATEGORI</th>
                  {monthNames.map((m) => (
                    <th key={m} className="p-3 font-semibold text-right">{m.toUpperCase()}</th>
                  ))}
                  <th className="p-3 font-semibold text-right text-emerald-400">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allIncomesSubCategories.map((sub) => {
                  const rowTotal = monthNames.reduce((acc, _, idx) => acc + getIncomeByMonthAndSub(idx, sub), 0);
                  return (
                    <tr key={sub} className="hover:bg-slate-950/40 transition">
                      <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900 z-10">{sub}</td>
                      {monthNames.map((_, idx) => (
                        <td key={idx} className="p-3 text-right font-mono text-slate-300">
                          {formatRupiah(getIncomeByMonthAndSub(idx, sub))}
                        </td>
                      ))}
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatRupiah(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-700 font-bold">
                  <td className="p-3 text-emerald-400 sticky left-0 bg-slate-950 z-10">TOTAL PENDAPATAN</td>
                  {monthNames.map((_, idx) => (
                    <td key={idx} className="p-3 text-right font-mono text-emerald-400">
                      {formatRupiah(getTotalIncomeByMonth(idx))}
                    </td>
                  ))}
                  <td className="p-3 text-right font-mono text-emerald-400 text-sm">{formatRupiah(grandTotalIncome)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* TABEL 2: PENGELUARAN PER BULAN */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
          <h2 className="text-sm font-bold tracking-wider text-rose-400">SUMMARY PENGELUARAN PER BULAN</h2>
          <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 z-20">
                <tr>
                  <th className="p-3 font-semibold sticky left-0 bg-slate-950 z-30">KATEGORI</th>
                  {monthNames.map((m) => (
                    <th key={m} className="p-3 font-semibold text-right">{m.toUpperCase()}</th>
                  ))}
                  <th className="p-3 font-semibold text-right text-rose-400">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allExpenseSubCategories.map((sub) => {
                  const rowTotal = monthNames.reduce((acc, _, idx) => acc + getExpenseByMonthAndSub(idx, sub), 0);
                  if (rowTotal === 0) return null;
                  return (
                    <tr key={sub} className="hover:bg-slate-950/40 transition">
                      <td className="p-3 font-medium text-slate-300 sticky left-0 bg-slate-900 z-10">{sub}</td>
                      {monthNames.map((_, idx) => (
                        <td key={idx} className="p-3 text-right font-mono text-slate-300">
                          {formatRupiah(getExpenseByMonthAndSub(idx, sub))}
                        </td>
                      ))}
                      <td className="p-3 text-right font-mono font-bold text-rose-400">{formatRupiah(rowTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-700 font-bold sticky bottom-0 z-20">
                  <td className="p-3 text-rose-400 sticky left-0 bg-slate-950 z-30">TOTAL PENGELUARAN</td>
                  {monthNames.map((_, idx) => (
                    <td key={idx} className="p-3 text-right font-mono text-rose-400">
                      {formatRupiah(getTotalExpenseByMonth(idx))}
                    </td>
                  ))}
                  <td className="p-3 text-right font-mono text-rose-400 text-sm">{formatRupiah(grandTotalExpense)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* GRAFIK 1: BAR CHART PENDAPATAN & PENGELUARAN */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
          <h2 className="text-sm font-bold tracking-wider text-indigo-400 text-center uppercase">
            PENDAPATAN & PENGELUARAN PERBULAN ({selectedYear})
          </h2>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bulan" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `Rp ${val / 1000000}jt`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                  formatter={(value: any) => formatRupiah(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pendapatan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* GRAFIK 2: LINE CHART PENDAPATAN & PENGELUARAN */}
        <section className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-4">
          <h2 className="text-sm font-bold tracking-wider text-indigo-400 text-center uppercase">
            TREN PENDAPATAN & PENGELUARAN PERBULAN ({selectedYear})
          </h2>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="bulan" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `Rp ${val / 1000000}jt`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                  formatter={(value: any) => formatRupiah(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Line type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Pendapatan" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>
    </main>
  );
}