"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Priority = "HIGH" | "MEDIUM" | "LOW";

type BudgetGoal = {
  id: string;
  description: string;
  amount: number;
  startMonth: number; // 1 - 12
  startYear: number;  // cth: 2026
  targetMonth: number; // 1 - 12
  targetYear: number;  // cth: 2027
  priority: Priority;  // Prioritas target
  savedAmount?: number; // Akumulasi dana yang sudah terkumpul (opsional)
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function BudgetingPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1 - 12

  const [goals, setGoals] = useState<BudgetGoal[]>([
    { id: "1", description: "BAYAR KONTRAKAN", amount: 20000000, startMonth: 4, startYear: currentYear, targetMonth: 12, targetYear: currentYear, priority: "HIGH", savedAmount: 5000000 },
    { id: "2", description: "QURBAN", amount: 3000000, startMonth: 2, startYear: currentYear, targetMonth: 11, targetYear: currentYear, priority: "MEDIUM", savedAmount: 1000000 },
  ]);

  const [activeYear, setActiveYear] = useState<number>(currentYear);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [startMonthInput, setStartMonthInput] = useState(`${currentYear}-01`);
  const [targetMonthInput, setTargetMonthInput] = useState(`${currentYear}-12`);
  const [descInput, setDescInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [savedInput, setSavedInput] = useState("");
  const [priorityInput, setPriorityInput] = useState<Priority>("MEDIUM");

  useEffect(() => {
    const saved = localStorage.getItem("family_budget_goals_v4");
    if (saved) {
      try {
        setGoals(JSON.parse(saved));
      } catch {}
    } else {
      const oldSaved = localStorage.getItem("family_budget_goals_v3") || localStorage.getItem("family_budget_goals");
      if (oldSaved) {
        try {
          const parsedOld = JSON.parse(oldSaved);
          const migrated = parsedOld.map((g: any) => ({
            ...g,
            startYear: g.startYear || currentYear,
            targetYear: g.targetYear || currentYear,
            priority: g.priority || "MEDIUM",
            savedAmount: g.savedAmount || 0,
          }));
          setGoals(migrated);
        } catch {}
      }
    }
  }, [currentYear]);

  const saveToStorage = (newGoals: BudgetGoal[]) => {
    setGoals(newGoals);
    localStorage.setItem("family_budget_goals_v4", JSON.stringify(newGoals));
  };

  const formatRupiah = (val: number) => {
    if (isNaN(val) || val === 0) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const calculateTotalMonthsSpan = (goal: BudgetGoal) => {
    const startTotalMonths = goal.startYear * 12 + (goal.startMonth - 1);
    const targetTotalMonths = goal.targetYear * 12 + (goal.targetMonth - 1);
    const diff = targetTotalMonths - startTotalMonths + 1;
    return diff > 0 ? diff : 1;
  };

  // Hitung berapa bulan yang sudah terlewat dari start sampai bulan/tahun saat ini
  const calculateProgressPercentage = (goal: BudgetGoal) => {
    const startTotal = goal.startYear * 12 + goal.startMonth;
    const targetTotal = goal.targetYear * 12 + goal.targetMonth;
    const nowTotal = currentYear * 12 + currentMonth;

    if (nowTotal < startTotal) return 0;
    if (nowTotal >= targetTotal) return 100;

    const totalSpan = targetTotal - startTotal + 1;
    const elapsed = nowTotal - startTotal + 1;
    const percentage = (elapsed / totalSpan) * 100;
    return Math.min(Math.max(percentage, 0), 100);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setDescInput("");
    setAmountInput("");
    setSavedInput("0");
    setPriorityInput("MEDIUM");
    setStartMonthInput(`${activeYear}-01`);
    setTargetMonthInput(`${activeYear}-12`);
    setIsModalOpen(true);
  };

  const handleEdit = (goal: BudgetGoal) => {
    setEditingId(goal.id);
    setDescInput(goal.description);
    setAmountInput(goal.amount.toString());
    setSavedInput((goal.savedAmount || 0).toString());
    setPriorityInput(goal.priority || "MEDIUM");
    
    const formattedStartMonth = String(goal.startMonth).padStart(2, "0");
    const formattedTargetMonth = String(goal.targetMonth).padStart(2, "0");
    setStartMonthInput(`${goal.startYear}-${formattedStartMonth}`);
    setTargetMonthInput(`${goal.targetYear}-${formattedTargetMonth}`);
    
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Hapus target budgeting ini?")) {
      const filtered = goals.filter((g) => g.id !== id);
      saveToStorage(filtered);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descInput.trim() || !amountInput || !startMonthInput || !targetMonthInput) return;

    const numAmount = parseFloat(amountInput);
    const numSaved = savedInput ? parseFloat(savedInput) : 0;
    if (isNaN(numAmount)) return;

    const [sYear, sMonth] = startMonthInput.split("-").map(Number);
    const [tYear, tMonth] = targetMonthInput.split("-").map(Number);

    const startVal = sYear * 12 + sMonth;
    const targetVal = tYear * 12 + tMonth;

    if (targetVal < startVal) {
      alert("Bulan/Tahun target tidak boleh lebih awal dari bulan/tahun mulai!");
      return;
    }

    if (editingId) {
      const updated = goals.map((g) =>
        g.id === editingId
          ? {
              ...g,
              description: descInput.toUpperCase(),
              amount: numAmount,
              savedAmount: numSaved,
              startMonth: sMonth,
              startYear: sYear,
              targetMonth: tMonth,
              targetYear: tYear,
              priority: priorityInput,
            }
          : g
      );
      saveToStorage(updated);
    } else {
      const newGoal: BudgetGoal = {
        id: Date.now().toString(),
        description: descInput.toUpperCase(),
        amount: numAmount,
        savedAmount: numSaved,
        startMonth: sMonth,
        startYear: sYear,
        targetMonth: tMonth,
        targetYear: tYear,
        priority: priorityInput,
      };
      saveToStorage([...goals, newGoal]);
    }
    setIsModalOpen(false);
  };

  // Fungsi Ekspor Data ke CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Keterangan,Prioritas,Total Target (Rp),Sudah Terkumpul (Rp),Mulai,Target Jatuh Tempo\n";
    
    goals.forEach((g) => {
      const row = [
        `"${g.description}"`,
        g.priority,
        g.amount,
        g.savedAmount || 0,
        `"${MONTH_NAMES[g.startMonth - 1]} ${g.startYear}"`,
        `"${MONTH_NAMES[g.targetMonth - 1]} ${g.targetYear}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Target_Budgeting_${activeYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthlyTotals = MONTH_NAMES.map((_, index) => {
    const monthIndex = index + 1;
    const currentCellTime = activeYear * 12 + monthIndex;

    let totalForMonth = 0;
    goals.forEach((goal) => {
      const totalSpan = calculateTotalMonthsSpan(goal);
      const monthlyAlloc = goal.amount / totalSpan;

      const startTime = goal.startYear * 12 + goal.startMonth;
      const targetTime = goal.targetYear * 12 + goal.targetMonth;

      if (currentCellTime >= startTime && currentCellTime <= targetTime) {
        totalForMonth += monthlyAlloc;
      }
    });
    return totalForMonth;
  });

  const grandTotalNominal = goals.reduce((sum, g) => sum + g.amount, 0);
  const totalSavedNominal = goals.reduce((sum, g) => sum + (g.savedAmount || 0), 0);
  const availableYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4, currentYear + 5];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 selection:bg-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Navigasi */}
        <header className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 px-6 py-5 rounded-2xl shadow-2xl flex flex-col xl:flex-row justify-between items-center gap-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>

          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/25 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner text-lg">
              🎯
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                TARGET BUDGETING JANGKA PANJANG
              </h1>
              <p className="text-[11px] font-bold tracking-[0.2em] text-indigo-400 uppercase mt-0.5">
                Sinking Funds & Progres Tabungan Keluarga
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end w-full xl:w-auto">
            <Link
              href="/dashboard"
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition border border-slate-700/60 shadow-sm flex items-center gap-1.5"
            >
              <span>←</span> Dashboard
            </Link>

            <button
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-900/50 px-4 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <span>📥</span> Ekspor CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-950/50 flex items-center gap-1.5"
            >
              <span>+</span> Tambah Target Baru
            </button>
          </div>
        </header>

        {/* Ringkasan Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Total Seluruh Target</p>
            <p className="text-lg font-extrabold text-emerald-400 mt-1 font-mono">{formatRupiah(grandTotalNominal)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Akumulasi Terkumpul</p>
            <p className="text-lg font-extrabold text-indigo-400 mt-1 font-mono">{formatRupiah(totalSavedNominal)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <p className="text-xs text-slate-400 font-medium">Sisa Kekurangan Target</p>
            <p className="text-lg font-extrabold text-amber-400 mt-1 font-mono">{formatRupiah(grandTotalNominal - totalSavedNominal)}</p>
          </div>
        </div>

        {/* Tabel Utama Budgeting */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/50">
            <div>
              <h2 className="text-sm font-bold text-slate-200">MATRIKS ALOKASI & PROGRES TABUNGAN</h2>
              <p className="text-xs text-slate-400">Menampilkan alokasi bulanan dan status progres target untuk tahun {activeYear}.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Tahun Tabel:</span>
                <select
                  value={activeYear}
                  onChange={(e) => setActiveYear(Number(e.target.value))}
                  className="bg-transparent text-indigo-400 font-bold text-xs outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-900 text-slate-100">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3 font-semibold sticky left-0 bg-slate-950 z-10">KETERANGAN</th>
                  <th className="p-3 font-semibold text-center">PRIORITAS</th>
                  <th className="p-3 font-semibold text-right">TOTAL TARGET</th>
                  <th className="p-3 font-semibold text-right">TERKUMPUL</th>
                  <th className="p-3 font-semibold text-center w-36">PROGRES WAKTU</th>
                  <th className="p-3 font-semibold text-center">MULAI s.d. TARGET</th>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className="p-3 font-semibold text-right border-l border-slate-800/80">
                      {m.toUpperCase()} {activeYear}
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {goals.map((g) => {
                  const totalSpan = calculateTotalMonthsSpan(g);
                  const monthlyAlloc = g.amount / totalSpan;
                  const progressPct = calculateProgressPercentage(g);

                  const startTime = g.startYear * 12 + g.startMonth;
                  const targetTime = g.targetYear * 12 + g.targetMonth;

                  const priorityColors = {
                    HIGH: "bg-rose-950/60 text-rose-400 border-rose-900/50",
                    MEDIUM: "bg-amber-950/60 text-amber-400 border-amber-900/50",
                    LOW: "bg-emerald-950/60 text-emerald-400 border-emerald-900/50",
                  };

                  return (
                    <tr key={g.id} className="hover:bg-slate-950/40 transition">
                      <td className="p-3 font-bold text-slate-200 sticky left-0 bg-slate-900 z-10 shadow-r">{g.description}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${priorityColors[g.priority || "MEDIUM"]}`}>
                          {g.priority || "MEDIUM"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatRupiah(g.amount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-400">{formatRupiah(g.savedAmount || 0)}</td>
                      
                      {/* Progress Bar Mini */}
                      <td className="p-3 text-center">
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full" style={{ width: `${progressPct}%` }}></div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{progressPct.toFixed(0)}% Sesuai Jadwal</span>
                      </td>

                      <td className="p-3 text-center text-slate-300 font-medium">
                        {MONTH_NAMES[g.startMonth - 1]} {g.startYear} — {MONTH_NAMES[g.targetMonth - 1]} {g.targetYear}
                      </td>

                      {MONTH_NAMES.map((_, idx) => {
                        const monthIndex = idx + 1;
                        const currentCellTime = activeYear * 12 + monthIndex;
                        const isActive = currentCellTime >= startTime && currentCellTime <= targetTime;

                        return (
                          <td key={idx} className={`p-3 text-right font-mono border-l border-slate-800/80 ${isActive ? "text-indigo-300 font-bold bg-indigo-950/20" : "text-slate-600"}`}>
                            {isActive ? formatRupiah(monthlyAlloc) : "#N/A"}
                          </td>
                        );
                      })}

                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEdit(g)} className="text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 bg-indigo-950/60 rounded border border-indigo-900/50">Edit</button>
                        <button onClick={() => handleDelete(g.id)} className="text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 bg-rose-950/60 rounded border border-rose-900/50">Hapus</button>
                      </td>
                    </tr>
                  );
                })}

                {goals.length === 0 && (
                  <tr>
                    <td colSpan={18} className="text-center text-slate-500 py-12">
                      Belum ada target budgeting. Silakan tambahkan target baru.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 font-bold border-t-2 border-slate-800 text-slate-200">
                  <td className="p-3 sticky left-0 bg-slate-950 z-10">TOTAL ALOKASI BULANAN ({activeYear})</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right font-mono text-emerald-400">{formatRupiah(grandTotalNominal)}</td>
                  <td className="p-3 text-right font-mono text-indigo-400">{formatRupiah(totalSavedNominal)}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">-</td>
                  {monthlyTotals.map((tot, idx) => (
                    <td key={idx} className="p-3 text-right font-mono text-indigo-400 border-l border-slate-800/80">
                      {tot > 0 ? formatRupiah(tot) : "#N/A"}
                    </td>
                  ))}
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal Tambah / Edit Target */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-white">
                {editingId ? "Edit Target Budgeting" : "Tambah Target Budgeting Baru"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Keterangan / Nama Kebutuhan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: DP RUMAH / QURBAN"
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Total Target Nominal (Rp)</label>
                    <input
                      type="number"
                      required
                      placeholder="50000000"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Sudah Terkumpul Saat Ini (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={savedInput}
                      onChange={(e) => setSavedInput(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioritas Target</label>
                  <select
                    value={priorityInput}
                    onChange={(e) => setPriorityInput(e.target.value as Priority)}
                    className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="HIGH">HIGH (Prioritas Tinggi / Wajib)</option>
                    <option value="MEDIUM">MEDIUM (Prioritas Sedang)</option>
                    <option value="LOW">LOW (Prioritas Rendah / Opsional)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Mulai Menabung (Bulan & Tahun)</label>
                    <input
                      type="month"
                      required
                      value={startMonthInput}
                      onChange={(e) => setStartMonthInput(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none cursor-pointer scheme-dark"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Target Jatuh Tempo (Bulan & Tahun)</label>
                    <input
                      type="month"
                      required
                      value={targetMonthInput}
                      onChange={(e) => setTargetMonthInput(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:border-indigo-500 outline-none cursor-pointer scheme-dark"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-950"
                  >
                    Simpan Target
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}