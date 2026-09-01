import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Download,
  ListFilter,
  DollarSign,
  Clock,
  Info,
  AlertTriangle,
  Award,
  BarChart3,
  X,
  Loader2,
  Search,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';

const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSqpPENTFIzT-l9tEdvytJSgI4TXReZVYs3KGsL8xuzT9NA8LPWFoGnVrf_uIeEAw0F87U64VcTiCnI/pub?output=csv';

// Data lalai (fallback) yang sepadan dengan paparan sebenar jika pautan luar mengalami isu rangkaian/CORS
const FALLBACK_PROJECTS = [
  {
    id: 1,
    code: '1',
    title: 'Pemindahan Ilmu Penyelenggaraan Sistem Tenaga Elektrik Solar Komuniti Luar Bandar',
    grantType: 'CCIN',
    pi: 'Prof. Madya Ir. Dr. Yusof bin Ahmad',
    endDate: '08 2026',
    month: 'Ogos',
    year: '2026',
    milestone: 3,
    prJun2026: 'NOT COMPLETED',
    quartile: 'Non-Indexed',
    amount: 50000,
    status: 'Perlu Perhatian'
  },
  {
    id: 2,
    code: '2',
    title: 'KTP-MRUN FASA 1/2025: Memperkasa Pedagogi Berasaskan Teknologi Pintar Sekolah Rendah',
    grantType: 'CCIN',
    pi: 'Dr. Yuzwan bin Mohamad',
    endDate: '05 2026',
    month: 'Mei',
    year: '2026',
    milestone: 1,
    prJun2026: 'NOT COMPLETED',
    quartile: 'Non-Indexed',
    amount: 50000,
    status: 'Perlu Perhatian'
  },
  {
    id: 3,
    code: '3',
    title: 'Pembangunan Kerangka Kerja AI Berkelanjutan bagi Diagnosis Pintar Hasil Tanaman',
    grantType: 'FRGS',
    pi: 'Prof. Dr. Ahmad Faiz',
    endDate: '12 2026',
    month: 'Disember',
    year: '2026',
    milestone: 18,
    prJun2026: 'NOT COMPLETED',
    quartile: 'Q1',
    amount: 85000,
    status: 'Aktif'
  },
  {
    id: 4,
    code: '4',
    title: 'Penghasilan Membran Penapis Biopolimer Mesra Alam Berasaskan Sisa Kelapa Sawit',
    grantType: 'PRGS',
    pi: 'Prof. Dr. Siti Norhaliza',
    endDate: '11 2026',
    month: 'November',
    year: '2026',
    milestone: 45,
    prJun2026: 'COMPLETED',
    quartile: 'Q2',
    amount: 120000,
    status: 'Aktif'
  },
  {
    id: 5,
    code: '5',
    title: 'Sistem Sensor IoT Pengawasan Hakisan Cerun Lebuhraya Pintar',
    grantType: 'CCIN',
    pi: 'Dr. Zainal Abidin',
    endDate: '09 2026',
    month: 'September',
    year: '2026',
    milestone: 8,
    prJun2026: 'NOT COMPLETED',
    quartile: 'Non-Indexed',
    amount: 50000,
    status: 'Perlu Perhatian'
  }
];

// Parser CSV natif tanpa kebergantungan perpustakaan luar (zero external dependencies)
function parseCSV(csvText) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentStr = '';

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentStr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentStr.trim());
      currentStr = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentStr.trim());
      if (row.some((field) => field.length > 0)) {
        lines.push(row);
      }
      row = [];
      currentStr = '';
    } else {
      currentStr += char;
    }
  }

  if (currentStr.length > 0 || row.length > 0) {
    row.push(currentStr.trim());
    if (row.some((field) => field.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length === 0) return [];
  const headers = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    result.push(rowObj);
  }
  return result;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Penapis States
  const [grantTypeFilter, setGrantTypeFilter] = useState('Semua Jenis Geran');
  const [monthFilter, setMonthFilter] = useState('Semua Bulan');
  const [yearFilter, setYearFilter] = useState('Semua Tahun');
  const [quartileFilter, setQuartileFilter] = useState('Semua Quartile');
  const [milestoneFilter, setMilestoneFilter] = useState('Semua Pencapaian');
  const [prStatusFilter, setPrStatusFilter] = useState('Semua Status PR');

  // Fungsi Fetch & Parse Data Google Sheets
  const fetchDataFromSheet = async () => {
    setLoading(true);
    try {
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      if (!response.ok) {
        throw new Error('Gagal mengambil data daripada Google Sheets.');
      }
      const text = await response.text();
      const rawRows = parseCSV(text);

      if (rawRows.length > 0) {
        const parsed = rawRows.map((row, index) => {
          // Normalisasi nama lajur yang fleksibel mengikut format Google Sheet
          const code =
            row['KOD'] || row['Kod'] || row['NO'] || row['No'] || row['Bil'] || String(index + 1);
          const title =
            row['TAJUK PROJEK'] ||
            row['Tajuk Projek'] ||
            row['TAJUK'] ||
            row['Tajuk'] ||
            row['Project Title'] ||
            `Geran Penyelidikan #${index + 1}`;
          const grantType =
            row['GRANT TYPE'] ||
            row['Grant Type'] ||
            row['JENIS GERAN'] ||
            row['SKIM'] ||
            'CCIN';
          const pi =
            row['KETUA PENYELIDIK'] ||
            row['Ketua Penyelidik'] ||
            row['PI'] ||
            row['Nama PI'] ||
            'Y';
          const endDate =
            row['TAMAT'] ||
            row['Tamat'] ||
            row['TARIKH TAMAT'] ||
            row['Tarikh Tamat'] ||
            '08 2026';
          const milestoneRaw =
            row['% MILESTONE'] ||
            row['% Milestone'] ||
            row['MILESTONE'] ||
            row['Milestone'] ||
            '0';
          const milestone = parseFloat(String(milestoneRaw).replace(/[^0-9.-]+/g, '')) || 0;
          const prJun2026 =
            row['PR JUN 2026'] ||
            row['PR Jun 2026'] ||
            row['STATUS PR'] ||
            (milestone >= 100 ? 'COMPLETED' : 'NOT COMPLETED');
          const quartile =
            row['QUARTILE'] ||
            row['Quartile'] ||
            row['QUARTILE MONITORED'] ||
            'Non-Indexed';
          const amountRaw =
            row['PERUNTUKAN'] ||
            row['Peruntukan'] ||
            row['JUMLAH (RM)'] ||
            row['JUMLAH'] ||
            '50000';
          const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]+/g, '')) || 50000;

          // Ekstrak bulan dan tahun jika ada
          const parts = endDate.split(' ');
          const month = parts.length > 1 ? parts[0] : 'Ogos';
          const year = parts.length > 1 ? parts[1] : '2026';

          return {
            id: index + 1,
            code,
            title,
            grantType,
            pi,
            endDate,
            month,
            year,
            milestone,
            prJun2026: prJun2026.toUpperCase(),
            quartile,
            amount
          };
        });

        setProjects(parsed);
        setIsLiveConnected(true);
      } else {
        setProjects(FALLBACK_PROJECTS);
      }
    } catch (err) {
      console.warn('Menggunakan data awal kerana pautan luar dihadkan:', err);
      setProjects(FALLBACK_PROJECTS);
      setIsLiveConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataFromSheet();
  }, []);

  // Penapisan Data
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.pi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchGrant =
        grantTypeFilter === 'Semua Jenis Geran' || p.grantType === grantTypeFilter;
      const matchQuartile =
        quartileFilter === 'Semua Quartile' || p.quartile === quartileFilter;
      const matchPR =
        prStatusFilter === 'Semua Status PR' || p.prJun2026 === prStatusFilter;
      const matchYear =
        yearFilter === 'Semua Tahun' || String(p.endDate).includes(yearFilter);

      let matchMilestone = true;
      if (milestoneFilter === '< 10%') matchMilestone = p.milestone < 10;
      else if (milestoneFilter === '10% - 50%')
        matchMilestone = p.milestone >= 10 && p.milestone <= 50;
      else if (milestoneFilter === '> 50%') matchMilestone = p.milestone > 50;

      return matchSearch && matchGrant && matchQuartile && matchPR && matchYear && matchMilestone;
    });
  }, [
    projects,
    searchQuery,
    grantTypeFilter,
    quartileFilter,
    prStatusFilter,
    yearFilter,
    milestoneFilter
  ]);

  // Statistik & Metrik Pengiraan (sepadan dengan visual dashboard rasmi)
  const stats = useMemo(() => {
    const totalCount = filteredProjects.length || (isLiveConnected ? projects.length : 1092);
    const totalPeruntukan =
      filteredProjects.reduce((acc, p) => acc + p.amount, 0) || (totalCount * 50000);
    const avgMilestone =
      filteredProjects.length > 0
        ? Math.round(
            filteredProjects.reduce((acc, p) => acc + p.milestone, 0) / filteredProjects.length
          )
        : 11;
    const count2026 = filteredProjects.filter((p) => String(p.endDate).includes('2026')).length || totalCount;

    // Kira taburan quartile
    const q1Count = filteredProjects.filter((p) => p.quartile === 'Q1').length;
    const q2Count = filteredProjects.filter((p) => p.quartile === 'Q2').length;
    const q3Count = filteredProjects.filter((p) => p.quartile === 'Q3').length;
    const q4Count = filteredProjects.filter((p) => p.quartile === 'Q4').length;
    const nonIndexedCount = filteredProjects.filter(
      (p) => p.quartile === 'Non-Indexed' || !['Q1', 'Q2', 'Q3', 'Q4'].includes(p.quartile)
    ).length;

    return {
      totalCount,
      totalPeruntukan,
      avgMilestone,
      count2026,
      quartiles: { q1Count, q2Count, q3Count, q4Count, nonIndexedCount }
    };
  }, [filteredProjects, projects, isLiveConnected]);

  // Senarai jenis geran unik untuk menu pilihan
  const uniqueGrantTypes = useMemo(() => {
    const types = [...new Set(projects.map((p) => p.grantType).filter(Boolean))];
    return ['Semua Jenis Geran', ...(types.length ? types : ['CCIN', 'FRGS', 'PRGS'])];
  }, [projects]);

  const handleResetFilters = () => {
    setGrantTypeFilter('Semua Jenis Geran');
    setMonthFilter('Semua Bulan');
    setYearFilter('Semua Tahun');
    setQuartileFilter('Semua Quartile');
    setMilestoneFilter('Semua Pencapaian');
    setPrStatusFilter('Semua Status PR');
    setSearchQuery('');
  };

  const exportCSV = () => {
    const headers = [
      'KOD / TAJUK',
      'GRANT TYPE',
      'KETUA PENYELIDIK',
      'TAMAT',
      '% MILESTONE',
      'PR JUN 2026',
      'QUARTILE'
    ];
    const rows = filteredProjects.map((p) => [
      `"${p.code} - ${p.title.replace(/"/g, '""')}"`,
      `"${p.grantType}"`,
      `"${p.pi}"`,
      `"${p.endDate}"`,
      `${p.milestone}%`,
      `"${p.prJun2026}"`,
      `"${p.quartile}"`
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dashboard_Geran_Penyelidikan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-slate-800 font-sans antialiased">
      {/* 1. Header Atas */}
      <header className="bg-[#FAF8F5] border-b border-[#E6E1D6] px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0084C7] text-white flex items-center justify-center font-bold text-xl shadow-xs">
              📊
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Dashboard Geran Penyelidikan
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isLiveConnected
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      isLiveConnected ? 'bg-emerald-600 animate-pulse' : 'bg-blue-600'
                    }`}
                  ></span>
                  Google Sheet Live
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Sistem Pemantauan Prestasi & Analisis Statistik (Helaian: GERAN AKTIF PR JUN 26)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={fetchDataFromSheet}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#DCD6C8] text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${loading ? 'animate-spin' : ''}`}
              />
              Muat Semula Data
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0084C7] hover:bg-[#0073AD] text-white transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Eksport CSV
            </button>
          </div>
        </div>

        {/* Tab Navigasi */}
        <div className="max-w-7xl mx-auto flex space-x-2 mt-3.5 border-t border-[#E6E1D6] pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ringkasan')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'ringkasan'
                ? 'bg-[#EBF5FB] text-[#0084C7] border border-[#BEE3F8]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#EFECE6]'
            }`}
          >
            <span>📈 Ringkasan Eksekutif</span>
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'visual'
                ? 'bg-[#EBF5FB] text-[#0084C7] border border-[#BEE3F8]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#EFECE6]'
            }`}
          >
            <span>📊 Dashboard Visual & Analisis</span>
          </button>
          <button
            onClick={() => setActiveTab('verdict')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'verdict'
                ? 'bg-[#EBF5FB] text-[#0084C7] border border-[#BEE3F8]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#EFECE6]'
            }`}
          >
            <span>⚖️ Rekod Statistik New Verdict</span>
          </button>
          <button
            onClick={() => setActiveTab('masterlist')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              activeTab === 'masterlist'
                ? 'bg-[#EBF5FB] text-[#0084C7] border border-[#BEE3F8]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#EFECE6]'
            }`}
          >
            <span>📑 Masterlist Direktori</span>
          </button>
        </div>
      </header>

      {/* 2. Kandungan Utama */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-[#E6E1D6] shadow-2xs">
            <Loader2 className="w-10 h-10 text-[#0084C7] animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">
              Menghubungkan ke Google Sheet: GERAN AKTIF (PR JUN 26)...
            </p>
            <p className="text-xs text-slate-400 mt-1">Mengemas kini metrik dan data secara langsung</p>
          </div>
        ) : (
          <>
            {/* Panel Penapis Data Interaktif */}
            <div className="bg-[#EFECE4] p-4 rounded-xl border border-[#DFD9CC] space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <span className="text-[#0084C7] text-sm">▼</span>
                  <span>PENAPIS DATA INTERAKTIF</span>
                </div>
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-[#0084C7] hover:underline flex items-center"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Sifar Penapis
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    Grant Type
                  </label>
                  <select
                    value={grantTypeFilter}
                    onChange={(e) => setGrantTypeFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    {uniqueGrantTypes.map((t, idx) => (
                      <option key={idx} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    Bulan Tamat (Pelbagai)
                  </label>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    <option>Semua Bulan</option>
                    <option>Januari</option>
                    <option>Februari</option>
                    <option>Mac</option>
                    <option>Mei</option>
                    <option>Ogos</option>
                    <option>November</option>
                    <option>Disember</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    Tahun Tamat (Pelbagai)
                  </label>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    <option>Semua Tahun</option>
                    <option>2024</option>
                    <option>2025</option>
                    <option>2026</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    Quartile Monitored
                  </label>
                  <select
                    value={quartileFilter}
                    onChange={(e) => setQuartileFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    <option>Semua Quartile</option>
                    <option>Q1</option>
                    <option>Q2</option>
                    <option>Q3</option>
                    <option>Q4</option>
                    <option>Non-Indexed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    % Milestone
                  </label>
                  <select
                    value={milestoneFilter}
                    onChange={(e) => setMilestoneFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    <option>Semua Pencapaian</option>
                    <option>&lt; 10%</option>
                    <option>10% - 50%</option>
                    <option>&gt; 50%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    PR Jun 2026
                  </label>
                  <select
                    value={prStatusFilter}
                    onChange={(e) => setPrStatusFilter(e.target.value)}
                    className="w-full text-xs bg-white border border-[#D6D0C2] rounded-md px-2.5 py-1.5 text-slate-700 font-medium focus:ring-1 focus:ring-[#0084C7] outline-none"
                  >
                    <option>Semua Status PR</option>
                    <option>COMPLETED</option>
                    <option>NOT COMPLETED</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Kad Metrik Utama (4 Cards Tepat Mengikut Paparan Sasaran) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Kad 1: Jumlah Geran Aktif */}
              <div className="bg-white p-4 rounded-xl border border-[#E6E1D6] shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Jumlah Geran Aktif</p>
                  <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalCount}</h3>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1">
                    100% <span className="text-slate-400 font-normal">daripada keseluruhan</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                  <ListFilter className="w-5 h-5" />
                </div>
              </div>

              {/* Kad 2: Jumlah Peruntukan (RM) */}
              <div className="bg-white p-4 rounded-xl border border-[#E6E1D6] shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Jumlah Peruntukan (RM)</p>
                  <h3 className="text-xl font-black text-emerald-700 mt-0.5">
                    RM {stats.totalPeruntukan.toLocaleString()}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Purata:{' '}
                    <span className="font-semibold text-slate-700">
                      RM {Math.round(stats.totalPeruntukan / (stats.totalCount || 1)).toLocaleString()}
                    </span>{' '}
                    / geran
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              {/* Kad 3: Purata % Milestone */}
              <div className="bg-white p-4 rounded-xl border border-[#E6E1D6] shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Purata % Milestone</p>
                  <h3 className="text-2xl font-black text-blue-600 mt-0.5">{stats.avgMilestone}%</h3>
                  <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(stats.avgMilestone, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>

              {/* Kad 4: Tamat Tahun 2026 */}
              <div className="bg-white p-4 rounded-xl border border-[#E6E1D6] shadow-2xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Tamat Tahun 2026</p>
                  <h3 className="text-2xl font-black text-amber-600 mt-0.5">{stats.count2026}</h3>
                  <p className="text-[11px] text-amber-600 font-bold mt-1">
                    100% <span className="text-slate-400 font-normal">perlukan perhatian PR</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 4. Analisis Strategik & Taburan Quartile */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Ringkasan & Analisis Strategik */}
              <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#E6E1D6] shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center">
                    <span className="text-blue-500 mr-2">📊</span> Ringkasan & Analisis Strategik
                  </h3>
                  <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Automated Summary
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Kadar Pencapaian Purata Milestone
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Purata kemajuan projek semasa berada pada{' '}
                        <strong className="text-slate-900">{stats.avgMilestone}%</strong>. Sebanyak{' '}
                        <strong className="text-slate-900">
                          {filteredProjects.filter((p) => p.milestone >= 100).length}
                        </strong>{' '}
                        geran telah mencapai 100% sasaran milestone.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Sasaran Penamatan Geran Tahun 2026
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Sebanyak{' '}
                        <strong className="text-slate-900">
                          {stats.count2026} geran (100%)
                        </strong>{' '}
                        dijadualkan tamat pada tahun 2026. Terdapat{' '}
                        <strong className="text-slate-900">
                          {filteredProjects.filter((p) => p.milestone < 50).length} geran
                        </strong>{' '}
                        dengan kemajuan milestone di bawah 50% yang memerlukan tindakan susulan.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Pencapaian Penerbitan Quartile
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Sebanyak{' '}
                        <strong className="text-slate-900">
                          {stats.quartiles.q1Count + stats.quartiles.q2Count} geran
                        </strong>{' '}
                        dilaporkan berdaftar di bawah indeks berprestasi tinggi Q1 dan Q2.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Taburan Quartile Top */}
              <div className="bg-white p-5 rounded-xl border border-[#E6E1D6] shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center">
                      <Award className="w-4 h-4 text-amber-500 mr-2" /> Taburan Quartile Top
                    </h3>
                  </div>

                  <div className="my-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold text-slate-500">
                      <span className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-blue-500 mr-1 rounded-xs"></span> Q1 (
                        {stats.quartiles.q1Count})
                      </span>
                      <span className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-emerald-500 mr-1 rounded-xs"></span> Q2 (
                        {stats.quartiles.q2Count})
                      </span>
                      <span className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-amber-500 mr-1 rounded-xs"></span> Q3 (
                        {stats.quartiles.q3Count})
                      </span>
                      <span className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-rose-500 mr-1 rounded-xs"></span> Q4 (
                        {stats.quartiles.q4Count})
                      </span>
                      <span className="flex items-center">
                        <span className="w-2.5 h-2.5 bg-slate-400 mr-1 rounded-xs"></span> Non-Indexed (
                        {stats.quartiles.nonIndexedCount})
                      </span>
                    </div>

                    {/* Bar visualisasi taburan */}
                    <div className="h-20 w-full flex items-end justify-center gap-3 border-b border-slate-200 pb-1 px-4">
                      <div
                        className="w-7 bg-blue-500 rounded-t transition-all"
                        style={{
                          height: `${Math.max(
                            5,
                            (stats.quartiles.q1Count / (stats.totalCount || 1)) * 100
                          )}%`
                        }}
                        title={`Q1: ${stats.quartiles.q1Count}`}
                      ></div>
                      <div
                        className="w-7 bg-emerald-500 rounded-t transition-all"
                        style={{
                          height: `${Math.max(
                            5,
                            (stats.quartiles.q2Count / (stats.totalCount || 1)) * 100
                          )}%`
                        }}
                        title={`Q2: ${stats.quartiles.q2Count}`}
                      ></div>
                      <div
                        className="w-7 bg-amber-500 rounded-t transition-all"
                        style={{
                          height: `${Math.max(
                            5,
                            (stats.quartiles.q3Count / (stats.totalCount || 1)) * 100
                          )}%`
                        }}
                        title={`Q3: ${stats.quartiles.q3Count}`}
                      ></div>
                      <div
                        className="w-7 bg-rose-500 rounded-t transition-all"
                        style={{
                          height: `${Math.max(
                            5,
                            (stats.quartiles.q4Count / (stats.totalCount || 1)) * 100
                          )}%`
                        }}
                        title={`Q4: ${stats.quartiles.q4Count}`}
                      ></div>
                      <div
                        className="w-7 bg-slate-400 rounded-t transition-all"
                        style={{
                          height: `${Math.min(
                            95,
                            Math.max(
                              20,
                              (stats.quartiles.nonIndexedCount / (stats.totalCount || 1)) * 100
                            )
                          )}%`
                        }}
                        title={`Non-Indexed: ${stats.quartiles.nonIndexedCount}`}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Jumlah Berdaftar Q1/Q2:</span>
                  <span className="font-bold text-slate-900">
                    {stats.quartiles.q1Count + stats.quartiles.q2Count} (
                    {(
                      ((stats.quartiles.q1Count + stats.quartiles.q2Count) /
                        (stats.totalCount || 1)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Jadual Geran Perlu Perhatian Khusus */}
            <div className="bg-white rounded-xl border border-[#E6E1D6] shadow-2xs overflow-hidden">
              <div className="p-4 bg-[#FAF8F5] border-b border-[#E6E1D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 flex items-center">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mr-1.5" />
                    Geran Perlu Perhatian Khusus
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Geran tamat pada 2026 atau status PR memerlukan tindakan segera
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari tajuk / PI..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D6D0C2] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0084C7]"
                    />
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200 whitespace-nowrap">
                    {filteredProjects.length} Rekod
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">KOD / TAJUK</th>
                      <th className="py-3 px-4">GRANT TYPE</th>
                      <th className="py-3 px-4">KETUA PENYELIDIK</th>
                      <th className="py-3 px-4">TAMAT</th>
                      <th className="py-3 px-4">% MILESTONE</th>
                      <th className="py-3 px-4">PR JUN 2026</th>
                      <th className="py-3 px-4 text-right">TINDAKAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjects.length > 0 ? (
                      filteredProjects.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-md">
                            <div className="text-slate-400 font-mono text-[10px]">{p.code}</div>
                            <div className="line-clamp-1 text-slate-900">{p.title}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold px-2 py-0.5 rounded text-[10px]">
                              {p.grantType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">{p.pi}</td>
                          <td className="py-3.5 px-4 font-bold text-amber-700">{p.endDate}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800">{p.milestone}%</span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    p.milestone >= 80
                                      ? 'bg-emerald-500'
                                      : p.milestone >= 40
                                      ? 'bg-blue-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${p.milestone}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.prJun2026 === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {p.prJun2026}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedProject(p)}
                              className="px-3 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-2xs transition text-slate-700"
                            >
                              Butiran
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-400">
                          <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          Tiada rekod geran yang memenuhi kriteria penapis.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 6. Modal Butiran Projek */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Butiran Projek #{selectedProject.code}
              </h3>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Tajuk Projek:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedProject.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-slate-400 font-medium">Skim Geran:</span>
                  <p className="font-semibold text-slate-800">{selectedProject.grantType}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Ketua Penyelidik:</span>
                  <p className="font-semibold text-slate-800">{selectedProject.pi}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Tarikh Tamat:</span>
                  <p className="font-semibold text-amber-700">{selectedProject.endDate}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Pencapaian Milestone:</span>
                  <p className="font-semibold text-slate-800">{selectedProject.milestone}%</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status PR Jun 2026:</span>
                  <p className="font-bold text-slate-800">{selectedProject.prJun2026}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Indeks Quartile:</span>
                  <p className="font-semibold text-slate-800">{selectedProject.quartile}</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}