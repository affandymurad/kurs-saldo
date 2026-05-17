import { useState, useEffect, useRef } from 'react';
import { Search, Calendar, ChevronDown, Download, Copy, Check, Sun, Moon, X, RefreshCw, TrendingUp, Newspaper, Globe, FileJson, ArrowUp } from 'lucide-react';

// Asset imports — letakkan di frontend/src/assets/
import cnbcLogo from './assets/cnbc_indonesia.svg';
import detikLogo from './assets/detikcom.png';
import tempoLogo from './assets/tempo.png';
import androidIcon from './assets/android.svg';

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  image?: string;
  source: string;
  logo: string;
  logoUrl: string;
  language: string;
}

interface KursBIItem {
  mataUang: string;
  nilai: string;
  kursJual: string;
  kursBeli: string;
  kursTengah: string;
}

interface KursPajakItem {
  mataUang: string;
  mataUangName: string;
  nilai: string;
  kurs: string;
  perubahan: string;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_KEY = 'kurs-saldo-secret-key-2026';
const PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=kurs.valuta.kurvasi';

const IC_KURS_SALDO = '/media/ic_kurs_saldo.png';
const IC_AFFANDY = '/media/ic_affandy.svg';
const IC_KURS_BI = '/media/ic_kurs_bi.png';
const IC_KURS_PAJAK = '/media/ic_kurs_pajak.ico';

// Map nama sumber → asset lokal
const SOURCE_LOGOS: Record<string, string> = {
  'Detik': detikLogo,
  'Tempo': tempoLogo,
  'CNBC Indonesia': cnbcLogo,
};

function getSourceLogo(source: string, fallbackUrl: string): string {
  return SOURCE_LOGOS[source] || fallbackUrl;
}

export default function KursSaldo() {
  const [items, setItems] = useState<RSSItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RSSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [topKeywords, setTopKeywords] = useState<{ word: string; count: number }[]>([]);

  const [showKursBI, setShowKursBI] = useState(false);
  const [kursBIData, setKursBIData] = useState<KursBIItem[] | null>(null);
  const [kursBITanggal, setKursBITanggal] = useState('');
  const [kursBILoading, setKursBILoading] = useState(false);
  const [kursBIError, setKursBIError] = useState('');
  const [kursBISearch, setKursBISearch] = useState('');

  const [showKursPajak, setShowKursPajak] = useState(false);
  const [kursPajakData, setKursPajakData] = useState<KursPajakItem[] | null>(null);
  const [kursPajakTanggal, setKursPajakTanggal] = useState('');
  const [kursPajakLoading, setKursPajakLoading] = useState(false);
  const [kursPajakError, setKursPajakError] = useState('');
  const [kursPajakSearch, setKursPajakSearch] = useState('');

  const [showList, setShowList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [listCopied, setListCopied] = useState(false);
  const [listJson, setListJson] = useState<string>('');

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => { fetchFeeds(); }, []);
  useEffect(() => { filterItems(); }, [items, selectedSource, searchQuery, startDate, endDate]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    if (items.length > 0) extractTopKeywords();
  }, [items]);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/feeds`, { headers: { 'X-API-Key': API_KEY } });
      if (!response.ok) throw new Error('Failed to fetch feeds');
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
        const dates = data.data.map((item: RSSItem) => new Date(item.pubDate).getTime());
        const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
        setDateRange({ min: minDate, max: maxDate });
        setStartDate(minDate);
        setEndDate(maxDate);
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKursBI = async () => {
    setKursBILoading(true);
    setKursBIError('');
    try {
      const response = await fetch(`${API_URL}/kurs-bi`, { headers: { 'X-API-Key': API_KEY } });
      const data = await response.json();
      if (data.success) { setKursBIData(data.data); setKursBITanggal(data.tanggal); }
      else setKursBIError(data.error || 'Gagal memuat data');
    } catch { setKursBIError('Tidak dapat terhubung ke server'); }
    finally { setKursBILoading(false); }
  };

  const fetchKursPajak = async () => {
    setKursPajakLoading(true);
    setKursPajakError('');
    try {
      const response = await fetch(`${API_URL}/kurs-pajak`, { headers: { 'X-API-Key': API_KEY } });
      const data = await response.json();
      if (data.success) { setKursPajakData(data.data); setKursPajakTanggal(data.tanggal); }
      else setKursPajakError(data.error || 'Gagal memuat data');
    } catch { setKursPajakError('Tidak dapat terhubung ke server'); }
    finally { setKursPajakLoading(false); }
  };

  const fetchList = async () => {
    setListLoading(true);
    setListError('');
    setListJson('');
    try {
      const response = await fetch(`${API_URL}/list`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await response.json();
      if (data.success) {
        setListJson(JSON.stringify(data, null, 2));
      } else {
        setListError(data.error || 'Gagal memuat data');
      }
    } catch {
      setListError('Tidak dapat terhubung ke server');
    } finally {
      setListLoading(false);
    }
  };

  const handleCopyList = async () => {
    try {
      await navigator.clipboard.writeText(listJson);
      setListCopied(true);
      setTimeout(() => setListCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleDownloadList = () => {
    const blob = new Blob([listJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `berita-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const extractTopKeywords = () => {
    const stopWords = new Set([
      'gara','juta','video','jadi','tembus','harga','yang','dan','di','ke','dari','ini','itu','dengan','untuk','pada',
      'adalah','akan','telah','atau','bisa','dapat','sudah','juga','oleh','dalam','tidak','ada','hal','saat','lebih',
      'seperti','antara','karena','the','and','for','are','but','not','you','all','can','her','was','one','our','out',
      'day','get','has','him','his','how','man','new','now','old','see','two','way','who','boy','did','its','let','put',
      'say','she','too','use','sebagai','tersebut','bahwa','saya','kami','soal','buka','suara','kata','beri','usai',
      'kali','per','hingga','agar','atas','bagi','pun','kini','masih','sekitar','bila','meski'
    ]);

    const documentNgrams: { [key: string]: Set<string> }[] = [];
    const ngramData: { [key: string]: { tf: number; timeWeight: number; type: 'unigram' | 'bigram' } } = {};
    const now = Date.now();

    items.forEach(item => {
      const itemTime = new Date(item.pubDate).getTime();
      const hoursDiff = (now - itemTime) / (1000 * 60 * 60);
      let timeWeight = hoursDiff > 24 ? 0.2 : hoursDiff > 12 ? 0.4 : hoursDiff > 6 ? 0.7 : 1.0;

      const titleWords = item.title.toLowerCase()
        .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/[^\w\s]/g, ' ').split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

      const docNgrams = new Set<string>();

      titleWords.forEach(word => {
        if (word.length >= 4 && word.length <= 15) {
          docNgrams.add(word);
          if (!ngramData[word]) ngramData[word] = { tf: 0, timeWeight: 0, type: 'unigram' };
          ngramData[word].tf += 1.0 * timeWeight;
          ngramData[word].timeWeight += timeWeight;
        }
      });

      for (let i = 0; i < titleWords.length - 1; i++) {
        if (!stopWords.has(titleWords[i]) && !stopWords.has(titleWords[i + 1])) {
          const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
          const words = bigram.split(' ');
          if (words.every(w => w.length >= 3 && w.length <= 15)) {
            docNgrams.add(bigram);
            if (!ngramData[bigram]) ngramData[bigram] = { tf: 0, timeWeight: 0, type: 'bigram' };
            ngramData[bigram].tf += 1.3 * timeWeight;
            ngramData[bigram].timeWeight += timeWeight;
          }
        }
      }
      documentNgrams.push({ [item.title]: docNgrams });
    });

    const totalDocs = items.length;
    const ngramScores: { [key: string]: { score: number; type: string } } = {};

    Object.entries(ngramData).forEach(([ngram, data]) => {
      let docsWithNgram = 0;
      documentNgrams.forEach(doc => {
        Object.values(doc).forEach(ngramSet => { if (ngramSet.has(ngram)) docsWithNgram++; });
      });
      const idf = Math.log(totalDocs / (docsWithNgram + 1));
      const tfidf = data.tf * idf;
      const recencyBonus = data.timeWeight / Math.max(data.tf, 1);
      const typeBonus = data.type === 'bigram' ? 1.3 : 1.0;
      ngramScores[ngram] = { score: tfidf * (1 + recencyBonus) * typeBonus, type: data.type };
    });

    const sortedAll = Object.entries(ngramScores).sort(([, a], [, b]) => b.score - a.score);
    const hasOverlap = (n1: string, n2: string) => {
      const w1 = new Set(n1.split(' ')), w2 = new Set(n2.split(' '));
      for (const w of w1) if (w2.has(w)) return true;
      return false;
    };

    const selected: string[] = [];
    for (const [ngram] of sortedAll) {
      if (selected.length >= 10) break;
      if (!selected.some(e => hasOverlap(e, ngram))) selected.push(ngram);
    }

    setTopKeywords(selected.slice(0, 10).map(word => ({ word, count: Math.round(ngramData[word].tf) })));
  };

  const filterItems = () => {
    let filtered = [...items];
    if (selectedSource !== 'Semua') filtered = filtered.filter(item => item.source === selectedSource);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
      );
    }
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter(item => {
        const d = new Date(item.pubDate).getTime();
        return d >= start && d < end;
      });
    }
    setFilteredItems(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const sources = ['Semua', 'Detik', 'Tempo', 'CNBC Indonesia'];

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 1500);
    } catch (err) { console.error('Gagal menyalin URL', err); }
  };

  // ─── Source badge colors ───────────────────────────────────────────────────
  const sourceAccent: Record<string, string> = {
    'Detik': 'bg-rose-500',
    'Tempo': 'bg-emerald-500',
    'CNBC Indonesia': 'bg-sky-500',
  };

  const dm = darkMode;

  // ─── Reusable class helpers ────────────────────────────────────────────────
  const card = `${dm ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-white border border-slate-200/80'} rounded-2xl shadow-sm`;
  const inputCls = `w-full rounded-xl border text-sm focus:outline-none transition-colors
    ${dm ? 'bg-slate-700/70 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'}`;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${dm ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 ${dm ? 'bg-slate-900/95 border-b border-slate-700/60' : 'bg-white/95 border-b border-slate-200'} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Row 1: Brand + dark toggle + install */}
          <div className="flex items-center justify-between h-14 gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden shadow ${dm ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                <img src={IC_KURS_SALDO} alt="Kurs Saldo" className="w-6 h-6 object-contain" />
              </div>
              <div className="leading-tight">
                <p className="font-bold text-sm tracking-tight">Kurs Saldo</p>
                <p className={`text-[11px] ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Berita Ekonomi & Kurs</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Affandy — icon only on mobile, full label on lg+ */}
              <a
                href="https://affandymurad.github.io"
                target="_blank"
                rel="noopener noreferrer"
                title="Affandy Murad"
                className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1.5 rounded-lg transition-colors
                  ${dm ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                <img src={IC_AFFANDY} alt="Affandy" className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline">Affandy Murad</span>
              </a>

              <button
                onClick={() => setDarkMode(!dm)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors
                  ${dm ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                title={dm ? 'Mode Terang' : 'Mode Gelap'}
              >
                {dm ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>

              <a
                href={PLAYSTORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Install di Android"
                className="flex items-center gap-1.5 bg-indigo-600 active:bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors shadow-sm"
              >
                {/* Android icon from assets */}
                <img src={androidIcon} alt="" className="w-3.5 h-3.5" />
                <span>Install</span>
              </a>
            </div>
          </div>

          {/* Row 2: Kurs action buttons — full-width pill row on mobile */}
          <div className={`flex items-center gap-2 pb-2.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0`}>
            <button
              onClick={() => { setShowKursBI(true); setKursBISearch(''); fetchKursBI(); }}
              className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-xl border transition-colors shrink-0
                ${dm ? 'bg-slate-800 border-slate-700 text-slate-200 active:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 active:bg-slate-100'}`}
            >
              <img src={IC_KURS_BI} alt="BI" className="w-4 h-4 object-contain" />
              Kurs BI
            </button>

            <button
              onClick={() => { setShowKursPajak(true); setKursPajakSearch(''); fetchKursPajak(); }}
              className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-xl border transition-colors shrink-0
                ${dm ? 'bg-slate-800 border-slate-700 text-slate-200 active:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 active:bg-slate-100'}`}
            >
              <img src={IC_KURS_PAJAK} alt="Pajak" className="w-4 h-4 object-contain" />
              Kurs Pajak
            </button>

            <button
              onClick={() => { setShowList(true); fetchList(); }}
              className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-xl border transition-colors shrink-0
                ${dm ? 'bg-slate-800 border-slate-700 text-emerald-400 active:bg-slate-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700 active:bg-emerald-100'}`}
            >
              <FileJson className="w-4 h-4" />
              Ekspor JSON
            </button>

            {/* Spacer to push count to the right */}
            <span className="flex-1" />

            <span className={`text-[11px] font-medium whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-lg
              ${dm ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {filteredItems.length}/{items.length} berita
            </span>
          </div>

        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* Filter Card */}
        <div className={`${card} p-4 sm:p-5 space-y-4 sm:space-y-5`}>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${dm ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Cari judul atau konten berita..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-10 pr-10 py-2.5`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Top Keywords */}
          {topKeywords.length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                <TrendingUp className="w-3.5 h-3.5" /> Topik Populer
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topKeywords.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => setSearchQuery(kw.word)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border
                      ${searchQuery === kw.word
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : dm
                          ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-indigo-300'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                  >
                    #{kw.word}
                    <span className={`ml-1 ${searchQuery === kw.word ? 'text-indigo-200' : dm ? 'text-slate-500' : 'text-slate-400'}`}>
                      {kw.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">

            {/* Source Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors
                  ${selectedSource !== 'Semua'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : dm
                      ? 'bg-slate-700 border-slate-600 text-slate-200'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {selectedSource === 'Semua' ? 'Semua Sumber' : selectedSource}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSourceDropdown && (
                <div className={`absolute top-full mt-1.5 left-0 z-20 w-full sm:min-w-[180px] rounded-xl shadow-xl border overflow-hidden
                  ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {sources.map(source => (
                    <button
                      key={source}
                      onClick={() => { setSelectedSource(source); setShowSourceDropdown(false); }}
                      className={`flex items-center gap-2.5 w-full text-left px-4 py-3 text-sm transition-colors
                        ${selectedSource === source
                          ? dm ? 'bg-indigo-600/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                          : dm ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      {SOURCE_LOGOS[source] ? (
                        <img src={SOURCE_LOGOS[source]} alt={source} className="w-4 h-4 object-contain" />
                      ) : (
                        <Newspaper className="w-4 h-4 opacity-50" />
                      )}
                      {source}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range — stacks on mobile */}
            <div className={`flex flex-col sm:flex-row sm:items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm
              ${dm ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 shrink-0 ${dm ? 'text-slate-400' : 'text-slate-500'}`} />
                <input
                  type="date"
                  value={startDate}
                  min={dateRange.min}
                  max={dateRange.max}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-sm flex-1 min-w-0"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`hidden sm:inline ${dm ? 'text-slate-500' : 'text-slate-400'}`}>—</span>
                <span className={`sm:hidden text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>s/d</span>
                <input
                  type="date"
                  value={endDate}
                  min={dateRange.min}
                  max={dateRange.max}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-sm flex-1 min-w-0"
                />
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchFeeds}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 text-sm font-medium px-3.5 py-2.5 rounded-xl border transition-colors disabled:opacity-50
                ${dm ? 'bg-slate-700 border-slate-600 text-slate-200 active:bg-slate-600' : 'bg-white border-slate-200 text-slate-700 active:bg-slate-50'}`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

          </div>
        </div>

        {/* ── News Grid ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-24">
            <div className="inline-block w-10 h-10 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className={`mt-4 text-sm ${dm ? 'text-slate-400' : 'text-slate-500'}`}>Memuat berita terkini…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className={`text-lg font-semibold mb-1 ${dm ? 'text-slate-300' : 'text-slate-700'}`}>Tidak ada berita ditemukan</h3>
            <p className={`text-sm ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
            {filteredItems.map((item, index) => {
              const logoSrc = getSourceLogo(item.source, item.logoUrl);
              const accent = sourceAccent[item.source] || 'bg-slate-500';
              return (
                <article
                  key={index}
                  className={`${card} overflow-hidden flex sm:flex-col hover:shadow-md active:scale-[0.99] transition-all duration-200`}
                >
                  {/* ── Mobile: horizontal layout (image left) ── */}
                  {item.image ? (
                    <>
                      {/* Thumbnail — small square on mobile, full-width on sm+ */}
                      <div className={`relative sm:h-44 h-[88px] w-[88px] sm:w-full overflow-hidden shrink-0 ${dm ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }}
                        />
                        {/* Source badge — only visible on sm+ */}
                        <div className={`hidden sm:flex absolute bottom-2.5 left-2.5 items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold
                          ${dm ? 'bg-slate-900/80 text-slate-100' : 'bg-white/90 text-slate-700'} backdrop-blur-sm shadow`}>
                          <img src={logoSrc} alt={item.source} className="w-3.5 h-3.5 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          {item.source}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Accent bar — top on desktop, left strip on mobile */
                    <div className={`sm:h-1 sm:w-full w-1 h-auto shrink-0 ${accent}`} />
                  )}

                  {/* Body */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
                    {/* Meta */}
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs flex-wrap">
                      <span className={`sm:hidden flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold
                        ${dm ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        <img src={logoSrc} alt={item.source} className="w-3 h-3 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        {item.source}
                      </span>
                      <span className={dm ? 'text-slate-500' : 'text-slate-400'}>{formatDate(item.pubDate)}</span>
                    </div>

                    {/* Title */}
                    <h2 className={`font-semibold text-sm leading-snug line-clamp-2 sm:line-clamp-2 ${dm ? 'text-slate-100' : 'text-slate-800'}`}>
                      {item.title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()}
                    </h2>

                    {/* Description — hidden on mobile to save space */}
                    <p className={`hidden sm:block text-xs leading-relaxed line-clamp-3 flex-1 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                      {stripHtml(item.description.replace(/<!\[CDATA\[|\]\]>/g, '')).trim()}
                    </p>

                    {/* Footer */}
                    <div className={`flex items-center justify-between pt-2 border-t ${dm ? 'border-slate-700/60' : 'border-slate-100'}`}>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 active:text-indigo-300 transition-colors"
                      >
                        Baca →
                      </a>
                      <button
                        onClick={() => handleCopy(item.link)}
                        className={`flex items-center gap-1 text-xs transition-colors p-1 -mr-1 rounded
                          ${copiedLink === item.link
                            ? 'text-emerald-500'
                            : dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Salin link"
                      >
                        {copiedLink === item.link ? (
                          <><Check className="w-3.5 h-3.5" /><span className="hidden sm:inline">Tersalin</span></>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Salin</span></>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal Kurs BI ───────────────────────────────────────────────────── */}
      {showKursBI && (
        <ModalOverlay onClose={() => setShowKursBI(false)} dm={dm}>
          <ModalHeader title="Kurs Transaksi Bank Indonesia" subtitle={kursBITanggal ? `Update: ${kursBITanggal}` : ''} onClose={() => setShowKursBI(false)} dm={dm} />
          <ModalSearch value={kursBISearch} onChange={setKursBISearch} placeholder="Cari mata uang..." dm={dm} />
          <div className="px-4 sm:px-6 pb-6">
            {kursBILoading && <ModalSpinner label="Mengambil data dari Bank Indonesia…" dm={dm} />}
            {kursBIError && !kursBILoading && (
              <ModalError message={kursBIError} onRetry={fetchKursBI} />
            )}
            {!kursBILoading && !kursBIError && kursBIData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${dm ? 'bg-slate-700/70 text-slate-300' : 'bg-slate-50 text-slate-500'} text-right text-xs uppercase tracking-wide`}>
                      <th className="text-left px-2 sm:px-3 py-2.5 rounded-tl-lg">Mata Uang</th>
                      <th className="px-2 sm:px-3 py-2.5">Nilai</th>
                      <th className="px-2 sm:px-3 py-2.5 text-rose-400">Jual</th>
                      <th className={`px-2 sm:px-3 py-2.5 ${dm ? 'text-indigo-400' : 'text-indigo-500'}`}>Tengah</th>
                      <th className="px-2 sm:px-3 py-2.5 rounded-tr-lg text-emerald-500">Beli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kursBIData
                      .filter(row => row.mataUang.toLowerCase().includes(kursBISearch.toLowerCase()))
                      .map((row, i) => (
                        <tr key={i} className={`border-b text-sm transition-colors
                          ${dm ? 'border-slate-700/40 hover:bg-slate-700/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                          <td className="px-2 sm:px-3 py-2.5 font-semibold">{row.mataUang}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-right">{row.nilai}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-right text-rose-500 font-medium">{row.kursJual}</td>
                          <td className={`px-2 sm:px-3 py-2.5 text-right font-medium ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>{row.kursTengah}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-right text-emerald-500 font-medium">{row.kursBeli}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal Kurs Pajak ────────────────────────────────────────────────── */}
      {showKursPajak && (
        <ModalOverlay onClose={() => setShowKursPajak(false)} dm={dm}>
          <ModalHeader title="Kurs Pajak Kemenkeu" subtitle={kursPajakTanggal ? `Periode: ${kursPajakTanggal}` : ''} onClose={() => setShowKursPajak(false)} dm={dm} />
          <ModalSearch value={kursPajakSearch} onChange={setKursPajakSearch} placeholder="Cari mata uang atau kode…" dm={dm} />
          <div className="px-4 sm:px-6 pb-6">
            {kursPajakLoading && <ModalSpinner label="Mengambil data dari Kemenkeu…" dm={dm} />}
            {kursPajakError && !kursPajakLoading && (
              <ModalError message={kursPajakError} onRetry={fetchKursPajak} />
            )}
            {!kursPajakLoading && !kursPajakError && kursPajakData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${dm ? 'bg-slate-700/70 text-slate-300' : 'bg-slate-50 text-slate-500'} text-xs uppercase tracking-wide`}>
                      <th className="text-left px-3 py-2.5 rounded-tl-lg">Mata Uang</th>
                      <th className="text-left px-3 py-2.5">Kode</th>
                      <th className="text-right px-3 py-2.5">Nilai</th>
                      <th className={`text-right px-3 py-2.5 ${dm ? 'text-indigo-400' : 'text-indigo-500'}`}>Kurs</th>
                      <th className="text-right px-3 py-2.5 rounded-tr-lg">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kursPajakData
                      .filter(row =>
                        row.mataUang.toLowerCase().includes(kursPajakSearch.toLowerCase()) ||
                        row.mataUangName.toLowerCase().includes(kursPajakSearch.toLowerCase())
                      )
                      .map((row, i) => {
                        const isNeg = row.perubahan.startsWith('-');
                        const isZero = row.perubahan === '0,00' || row.perubahan === '0';
                        return (
                          <tr key={i} className={`border-b transition-colors
                            ${dm ? 'border-slate-700/40 hover:bg-slate-700/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                            <td className="px-3 py-2.5">{row.mataUangName}</td>
                            <td className="px-3 py-2.5 font-semibold">{row.mataUang}</td>
                            <td className={`px-3 py-2.5 text-right text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{row.nilai}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${dm ? 'text-indigo-400' : 'text-indigo-600'}`}>{row.kurs}</td>
                            <td className={`px-3 py-2.5 text-right font-medium text-xs
                              ${isNeg ? 'text-rose-500' : isZero ? dm ? 'text-slate-500' : 'text-slate-400' : 'text-emerald-500'}`}>
                              {isNeg ? '' : isZero ? '' : '+'}{row.perubahan}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal List JSON ─────────────────────────────────────────────────── */}
      {showList && (
        <ModalOverlay onClose={() => setShowList(false)} dm={dm}>
          <ModalHeader
            title="Ekspor Berita sebagai JSON"
            subtitle="Format ringkas: title, description, link, pubDate, source"
            onClose={() => setShowList(false)}
            dm={dm}
          />

          <div className="px-4 sm:px-6 pb-6 pt-3 space-y-3">
            {listLoading && <ModalSpinner label="Mengambil data berita…" dm={dm} />}

            {listError && !listLoading && (
              <ModalError message={listError} onRetry={fetchList} />
            )}

            {!listLoading && !listError && listJson && (
              <>
                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyList}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors
                      ${listCopied
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : dm
                          ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    {listCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {listCopied ? 'Tersalin!' : 'Salin JSON'}
                  </button>

                  <button
                    onClick={handleDownloadList}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors
                      ${dm
                        ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh .json
                  </button>

                  <span className={`ml-auto text-[11px] px-2.5 py-1.5 rounded-lg font-medium
                    ${dm ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {JSON.parse(listJson).count} item
                  </span>
                </div>

                {/* JSON preview */}
                <div className={`rounded-xl border overflow-auto max-h-[55dvh] sm:max-h-[60vh]
                  ${dm ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <pre className={`text-[11px] sm:text-xs leading-relaxed p-4 font-mono
                    ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
                    {listJson}
                  </pre>
                </div>
              </>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* Footer */}
      <footer className={`${dm ? 'border-t border-slate-800' : 'border-t border-slate-200'} mt-12 py-8 text-center`}>
        <p className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>© 2026 Kurs Saldo. All rights reserved.</p>
        <a
          href={PLAYSTORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download Aplikasi Android
        </a>
      </footer>

      {/* ── Scroll-to-top FAB — mobile only ─────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Kembali ke atas"
        className={`sm:hidden fixed bottom-5 right-4 z-40 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-300
          ${showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
          ${dm ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white'}`}
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── Modal sub-components ──────────────────────────────────────────────────

function ModalOverlay({ children, onClose, dm }: { children: React.ReactNode; onClose: () => void; dm: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-center bg-black/60 backdrop-blur-sm overflow-y-auto sm:pt-8 sm:pb-12 sm:px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full sm:max-w-4xl ${dm ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'}
        rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden
        max-h-[92dvh] sm:max-h-none overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose, dm }: { title: string; subtitle: string; onClose: () => void; dm: boolean }) {
  return (
    <div className={`border-b ${dm ? 'border-slate-700' : 'border-slate-200'}`}>
      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1">
        <div className={`w-10 h-1 rounded-full ${dm ? 'bg-slate-600' : 'bg-slate-300'}`} />
      </div>
      <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold">{title}</h2>
          {subtitle && <p className={`text-xs mt-0.5 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>}
        </div>
        <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${dm ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <X className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}

function ModalSearch({ value, onChange, placeholder, dm }: { value: string; onChange: (v: string) => void; placeholder: string; dm: boolean }) {
  return (
    <div className="px-4 sm:px-6 py-3">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${dm ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none
            ${dm ? 'bg-slate-700 border-slate-600 placeholder-slate-500 focus:border-indigo-500 text-slate-100' : 'border-slate-200 focus:border-indigo-400'}`}
        />
      </div>
    </div>
  );
}

function ModalSpinner({ label, dm }: { label: string; dm: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="inline-block w-9 h-9 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className={`mt-3 text-xs ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
    </div>
  );
}

function ModalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-rose-500 text-sm font-medium">{message}</p>
      <button onClick={onRetry} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors">
        Coba Lagi
      </button>
    </div>
  );
}