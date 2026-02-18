import { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, Download, Smartphone, Copy, Check, Sun, Moon, X } from 'lucide-react';

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

// Import images
const IC_KURS_SALDO = '/media/ic_kurs_saldo.png';
const IC_AFFANDY = '/media/ic_affandy.svg';
const IC_KURS_BI = '/media/ic_kurs_bi.png';
const IC_KURS_PAJAK = '/media/ic_kurs_pajak.ico';

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

  useEffect(() => {
    fetchFeeds();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, selectedSource, searchQuery, startDate, endDate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (items.length > 0) {
      extractTopKeywords();
    }
  }, [items]);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/feeds`, {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feeds');
      }

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
      const response = await fetch(`${API_URL}/kurs-bi`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await response.json();
      if (data.success) {
        setKursBIData(data.data);
        setKursBITanggal(data.tanggal);
      } else {
        setKursBIError(data.error || 'Gagal memuat data');
      }
    } catch {
      setKursBIError('Tidak dapat terhubung ke server');
    } finally {
      setKursBILoading(false);
    }
  };

  const fetchKursPajak = async () => {
    setKursPajakLoading(true);
    setKursPajakError('');
    try {
      const response = await fetch(`${API_URL}/kurs-pajak`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await response.json();
      if (data.success) {
        setKursPajakData(data.data);
        setKursPajakTanggal(data.tanggal);
      } else {
        setKursPajakError(data.error || 'Gagal memuat data');
      }
    } catch {
      setKursPajakError('Tidak dapat terhubung ke server');
    } finally {
      setKursPajakLoading(false);
    }
  };

  const extractTopKeywords = () => {
    const stopWords = new Set([
      'gara', 'juta', 'video', 'jadi', 'tembus', 'harga', 'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada',
      'adalah', 'akan', 'telah', 'atau', 'bisa', 'dapat', 'sudah', 'juga', 'oleh',
      'dalam', 'tidak', 'ada', 'hal', 'saat', 'lebih', 'seperti', 'antara', 'karena',
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
      'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new',
      'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put',
      'say', 'she', 'too', 'use', 'sebagai', 'tersebut', 'bahwa', 'saya', 'kami',
      'soal', 'buka', 'suara', 'kata', 'beri', 'usai', 'kali', 'per', 'hingga',
      'agar', 'atas', 'bagi', 'pun', 'kini', 'masih', 'sekitar', 'bila', 'meski'
    ]);

    const documentNgrams: { [key: string]: Set<string> }[] = [];
    const ngramData: {
      [key: string]: {
        tf: number;
        timeWeight: number;
        type: 'unigram' | 'bigram'
      }
    } = {};

    const now = Date.now();

    items.forEach(item => {
      const itemTime = new Date(item.pubDate).getTime();
      const hoursDiff = (now - itemTime) / (1000 * 60 * 60);

      let timeWeight = 1.0;
      if (hoursDiff > 24) timeWeight = 0.2;
      else if (hoursDiff > 12) timeWeight = 0.4;
      else if (hoursDiff > 6) timeWeight = 0.7;

      const titleWords = item.title
        .toLowerCase()
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));

      const docNgrams = new Set<string>();

      // UNIGRAM (kata tunggal)
      titleWords.forEach(word => {
        if (word.length >= 4 && word.length <= 15) {
          docNgrams.add(word);

          if (!ngramData[word]) {
            ngramData[word] = { tf: 0, timeWeight: 0, type: 'unigram' };
          }

          ngramData[word].tf += 1.0 * timeWeight;
          ngramData[word].timeWeight += timeWeight;
        }
      });

      // BIGRAM (2 kata berurutan)
      for (let i = 0; i < titleWords.length - 1; i++) {
        if (!stopWords.has(titleWords[i]) && !stopWords.has(titleWords[i + 1])) {
          const bigram = `${titleWords[i]} ${titleWords[i + 1]}`;
          const words = bigram.split(' ');

          if (words.every(w => w.length >= 3 && w.length <= 15)) {
            docNgrams.add(bigram);

            if (!ngramData[bigram]) {
              ngramData[bigram] = { tf: 0, timeWeight: 0, type: 'bigram' };
            }

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
        Object.values(doc).forEach(ngramSet => {
          if (ngramSet.has(ngram)) docsWithNgram++;
        });
      });

      const idf = Math.log(totalDocs / (docsWithNgram + 1));
      const tfidf = data.tf * idf;
      const recencyBonus = data.timeWeight / Math.max(data.tf, 1);

      // Type bonus (bigram > unigram)
      const typeBonus = data.type === 'bigram' ? 1.3 : 1.0;

      ngramScores[ngram] = {
        score: tfidf * (1 + recencyBonus) * typeBonus,
        type: data.type
      };
    });

    const sortedAll = Object.entries(ngramScores)
      .sort(([, a], [, b]) => b.score - a.score);

    const hasOverlap = (ngram1: string, ngram2: string): boolean => {
      const words1 = new Set(ngram1.split(' '));
      const words2 = new Set(ngram2.split(' '));

      for (const word of words1) {
        if (words2.has(word)) return true;
      }
      return false;
    };

    // Filter duplikat dan ambil maksimal 10 keywords
    const selected: string[] = [];
    for (const [ngram] of sortedAll) {
      if (selected.length >= 10) break;

      const hasConflict = selected.some(existing => hasOverlap(existing, ngram));

      if (!hasConflict) {
        selected.push(ngram);
      }
    }

    // Pastikan tepat 10 item
    const finalKeywords = selected.slice(0, 10).map(word => ({
      word,
      count: Math.round(ngramData[word].tf)
    }));

    setTopKeywords(finalKeywords);
  };

  const filterItems = () => {
    let filtered = [...items];

    if (selectedSource !== 'Semua') {
      filtered = filtered.filter(item => item.source === selectedSource);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }

    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.pubDate).getTime();
        return itemDate >= start && itemDate < end;
      });
    }

    setFilteredItems(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('id-ID', options);
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
    } catch (err) {
      console.error('Gagal menyalin URL', err);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    setSearchQuery(keyword);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-slate-800' : 'bg-rose-100'} ${darkMode ? 'text-white' : 'text-slate-800'} shadow-xl`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 ${darkMode ? 'bg-slate-700' : 'bg-white'} rounded-xl flex items-center justify-center shadow-lg overflow-hidden`}>
                <img src={IC_KURS_SALDO} alt="Kurs Saldo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Kurs Saldo</h1>
                <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm`}>Berita Ekonomi & Kurs Terkini</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <a
                href="https://affandymurad.github.io"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center space-x-1.5 ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-700'} px-3 py-2 rounded-lg text-sm font-medium transition-all shadow hover:shadow-md`}
                title="Affandy Murad"
              >
                <img src={IC_AFFANDY} alt="Affandy" className="w-5 h-5 object-contain" />
                <span className="hidden lg:inline">Affandy Murad</span>
              </a>

              <button
                onClick={() => { setShowKursBI(true); setKursBISearch(''); fetchKursBI(); }}
                className={`flex items-center space-x-1.5 ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-700'} px-3 py-2 rounded-lg text-sm font-medium transition-all shadow hover:shadow-md`}
                title="Kurs BI"
              >
                <img src={IC_KURS_BI} alt="BI" className="w-5 h-5 object-contain" />
                <span className="hidden lg:inline">Kurs BI</span>
              </button>

              <button
                onClick={() => { setShowKursPajak(true); setKursPajakSearch(''); fetchKursPajak(); }}
                className={`flex items-center space-x-1.5 ${darkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white hover:bg-slate-50 text-slate-700'} px-3 py-2 rounded-lg text-sm font-medium transition-all shadow hover:shadow-md`}
                title="Kurs Pajak"
              >
                <img src={IC_KURS_PAJAK} alt="Pajak" className="w-5 h-5 object-contain" />
                <span className="hidden lg:inline">Kurs Pajak</span>
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-slate-50'} transition-all shadow hover:shadow-md`}
                title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <a
                href={PLAYSTORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center space-x-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} px-4 py-2.5 rounded-lg font-semibold transition-all shadow hover:shadow-md`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="hidden sm:inline">Install di Android</span>
                <span className="sm:hidden">Install</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className={`${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'} rounded-2xl shadow-lg p-6 mb-8`}>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-slate-500' : 'text-slate-400'} w-5 h-5`} />
              <input
                type="text"
                placeholder="Cari berita berdasarkan judul atau konten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-12 pr-12 py-3 border-2 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500' : 'bg-white border-slate-200 focus:border-blue-500'} rounded-xl focus:outline-none transition-colors`}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                  title="Hapus pencarian"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Top Keywords */}
          {topKeywords.length > 0 && (
            <div className="mb-6">
              <h3 className={`text-sm font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-3`}>
                🔥 Topik Populer ({topKeywords.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {topKeywords.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => handleKeywordClick(keyword.word)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${darkMode
                      ? 'bg-slate-700 hover:bg-blue-600 text-slate-200'
                      : 'bg-slate-100 hover:bg-blue-500 hover:text-white text-slate-700'
                      }`}
                  >
                    #{keyword.word} <span className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} text-xs ml-1`}>({keyword.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Source Filter */}
            <div className="relative">
              <button
                onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                className={`px-6 py-3 rounded-xl font-medium flex items-center space-x-2 transition-all ${selectedSource !== 'Semua'
                  ? darkMode
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-blue-500 text-white shadow-md'
                  : darkMode
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                <span>Sumber: {selectedSource}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showSourceDropdown && (
                <div className={`absolute top-full mt-2 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white'} rounded-xl shadow-xl border ${darkMode ? '' : 'border-slate-200'} z-10 min-w-full`}>
                  {sources.map(source => (
                    <button
                      key={source}
                      onClick={() => {
                        setSelectedSource(source);
                        setShowSourceDropdown(false);
                      }}
                      className={`block w-full text-left px-4 py-2 ${darkMode ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-slate-100'} first:rounded-t-xl last:rounded-b-xl transition-colors`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className={`flex items-center space-x-3 ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} px-4 py-2 rounded-xl`}>
              <Calendar className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
              <input
                type="date"
                value={startDate}
                min={dateRange.min}
                max={dateRange.max}
                onChange={(e) => setStartDate(e.target.value)}
                className={`bg-transparent border-none focus:outline-none text-sm ${darkMode ? 'text-slate-200' : ''}`}
              />
              <span className={darkMode ? 'text-slate-500' : 'text-slate-500'}>—</span>
              <input
                type="date"
                value={endDate}
                min={dateRange.min}
                max={dateRange.max}
                onChange={(e) => setEndDate(e.target.value)}
                className={`bg-transparent border-none focus:outline-none text-sm ${darkMode ? 'text-slate-200' : ''}`}
              />
            </div>
          </div>

          {/* Results Count */}
          <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Menampilkan <span className={`font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{filteredItems.length}</span> dari {items.length} berita
          </div>
        </div>

        {/* News Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className={`inline-block w-12 h-12 border-4 ${darkMode ? 'border-blue-500 border-t-transparent' : 'border-blue-500 border-t-transparent'} rounded-full animate-spin`}></div>
            <p className={`mt-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Memuat berita...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item, index) => (
              <article
                key={index}
                className={`${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'} rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col`}
              >
                {/* Image */}
                {item.image && (
                  <div className={`relative h-48 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'} overflow-hidden`}>
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className={`absolute top-3 left-3 ${darkMode ? 'bg-slate-800/90' : 'bg-white/90'} backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2`}>
                      <img
                        src={item.logoUrl}
                        alt={item.source}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className={darkMode ? 'text-slate-200' : ''}>{item.source}</span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center space-x-2 text-xs mb-3">
                    {!item.image && (
                      <span className={`${darkMode ? 'bg-slate-700' : 'bg-slate-100'} px-2 py-1 rounded-full font-semibold flex items-center space-x-1.5`}>
                        <img
                          src={item.logoUrl}
                          alt={item.source}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <span className={darkMode ? 'text-slate-200' : ''}>{item.source}</span>
                      </span>
                    )}
                    <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{formatDate(item.pubDate)}</span>
                  </div>

                  <h2 className={`text-lg font-bold ${darkMode ? 'text-slate-100 hover:text-blue-400' : 'text-slate-800 hover:text-blue-600'} mb-3 line-clamp-2 transition-colors`}>
                    {item.title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()}
                  </h2>

                  <p className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm line-clamp-3 mb-4 flex-1`}>
                    {stripHtml(item.description.replace(/<!\[CDATA\[|\]\]>/g, '')).trim()}
                  </p>

                  <div className="flex items-center justify-between">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} font-semibold text-sm transition-colors`}
                    >
                      Baca selengkapnya →
                    </a>

                    <button
                      onClick={() => handleCopy(item.link)}
                      className={`inline-flex items-center space-x-1 ${darkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'} transition-colors text-sm`}
                      title="Salin link"
                    >
                      {copiedLink === item.link ? (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-green-500">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-2`}>
              Tidak ada berita ditemukan
            </h3>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
              Coba ubah filter atau kata kunci pencarian Anda
            </p>
          </div>
        )}
      </div>

      {/* ── Modal Kurs BI ─────────────────────────────────────────────────────── */}
      {showKursBI && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto pt-6 pb-10">
          <div className={`w-full max-w-4xl mx-4 ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'} rounded-2xl shadow-2xl`}>
            {/* Header modal */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <h2 className="text-xl font-bold">Kurs Transaksi Bank Indonesia</h2>
                {kursBITanggal && (
                  <p className={`text-sm mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Update Terakhir: {kursBITanggal}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowKursBI(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search dalam modal */}
            <div className="px-6 py-3">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Cari mata uang..."
                  value={kursBISearch}
                  onChange={e => setKursBISearch(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-500 focus:border-blue-500' : 'border-slate-200 focus:border-blue-400'} focus:outline-none text-sm`}
                />
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-6">
              {kursBILoading && (
                <div className="text-center py-16">
                  <div className={`inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin`} />
                  <p className={`mt-3 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Mengambil data dari Bank Indonesia...</p>
                </div>
              )}

              {kursBIError && !kursBILoading && (
                <div className="text-center py-10">
                  <p className="text-red-500 font-medium">{kursBIError}</p>
                  <button
                    onClick={fetchKursBI}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {!kursBILoading && !kursBIError && kursBIData && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} text-right`}>
                        <th className="text-left px-3 py-2.5 rounded-tl-lg font-semibold">Mata Uang</th>
                        <th className="px-3 py-2.5 font-semibold">Nilai</th>
                        <th className="px-3 py-2.5 font-semibold">Kurs Jual</th>
                        <th className="px-3 py-2.5 font-semibold">Kurs Tengah</th>
                        <th className="px-3 py-2.5 rounded-tr-lg font-semibold">Kurs Beli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kursBIData
                        .filter(row => row.mataUang.toLowerCase().includes(kursBISearch.toLowerCase()))
                        .map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b ${darkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'} transition-colors`}
                          >
                            <td className="px-3 py-2.5 font-semibold">{row.mataUang}</td>
                            <td className="px-3 py-2.5 text-right">{row.nilai}</td>
                            <td className="px-3 py-2.5 text-right text-red-500 font-medium">{row.kursJual}</td>
                            <td className={`px-3 py-2.5 text-right font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{row.kursTengah}</td>
                            <td className="px-3 py-2.5 text-right text-green-500 font-medium">{row.kursBeli}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kurs Pajak ──────────────────────────────────────────────────── */}
      {showKursPajak && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto pt-6 pb-10">
          <div className={`w-full max-w-5xl mx-4 ${darkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'} rounded-2xl shadow-2xl`}>
            {/* Header modal */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <h2 className="text-xl font-bold">Kurs Pajak Kemenkeu</h2>
                {kursPajakTanggal && (
                  <p className={`text-sm mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Periode Berlaku: {kursPajakTanggal}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowKursPajak(false)}
                className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search dalam modal */}
            <div className="px-6 py-3">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Cari mata uang..."
                  value={kursPajakSearch}
                  onChange={e => setKursPajakSearch(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 placeholder-slate-500 focus:border-blue-500' : 'border-slate-200 focus:border-blue-400'} focus:outline-none text-sm`}
                />
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-6">
              {kursPajakLoading && (
                <div className="text-center py-16">
                  <div className={`inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin`} />
                  <p className={`mt-3 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Mengambil data dari Kemenkeu...</p>
                </div>
              )}

              {kursPajakError && !kursPajakLoading && (
                <div className="text-center py-10">
                  <p className="text-red-500 font-medium">{kursPajakError}</p>
                  <button
                    onClick={fetchKursPajak}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {!kursPajakLoading && !kursPajakError && kursPajakData && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'} text-right`}>
                        <th className="text-left px-3 py-2.5 rounded-tl-lg font-semibold">Mata Uang</th>
                        <th className="text-left px-3 py-2.5 font-semibold">Kode</th>
                        <th className="px-3 py-2.5 font-semibold">Nilai</th>
                        <th className="px-3 py-2.5 font-semibold">Kurs</th>
                        <th className="px-3 py-2.5 rounded-tr-lg font-semibold">Perubahan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kursPajakData
                        .filter(row =>
                          row.mataUang.toLowerCase().includes(kursPajakSearch.toLowerCase()) ||
                          row.mataUangName.toLowerCase().includes(kursPajakSearch.toLowerCase())
                        )
                        .map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b ${darkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'} transition-colors`}
                          >
                            <td className="px-3 py-2.5">{row.mataUangName}</td>
                            <td className="px-3 py-2.5 font-semibold">{row.mataUang}</td>
                            <td className="px-3 py-2.5 text-right text-slate-500">{row.nilai}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {row.kurs}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-medium ${row.perubahan.startsWith('-')
                              ? 'text-red-500'
                              : row.perubahan === '0,00' || row.perubahan === '0'
                                ? 'text-slate-400'
                                : 'text-green-500'
                              }`}>
                              {row.perubahan.startsWith('-') ? '' : row.perubahan !== '0,00' && row.perubahan !== '0' ? '+' : ''}{row.perubahan}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`${darkMode ? 'bg-slate-800 border-t border-slate-700' : 'bg-slate-800'} text-white py-8 mt-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className={darkMode ? 'text-slate-400' : 'text-slate-400'}>© 2026 Kurs Saldo. All rights reserved.</p>
          <div className="mt-4">
            <a
              href={PLAYSTORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center space-x-2 ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-400 hover:text-blue-300'} transition-colors`}
            >
              <Download className="w-4 h-4" />
              <span>Download Aplikasi Android</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}