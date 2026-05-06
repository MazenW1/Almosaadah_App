// components/SmartSearch.tsx
import { useState, useTransition, useCallback } from 'react';

interface SmartSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  suggestions?: string[];
}

export interface SearchFilters {
  dateRange?: 'today' | 'week' | 'month' | 'all';
  status?: string;
  type?: string;
}

export default function SmartSearch({ onSearch, suggestions = [] }: SmartSearchProps) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ dateRange: 'all' });

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    startTransition(() => {
      onSearch(value, filters);
    });
  }, [filters, onSearch]);

  const quickFilters = [
    { key: 'today', label: 'اليوم', icon: 'fa-calendar-day' },
    { key: 'week', label: 'هذا الأسبوع', icon: 'fa-calendar-week' },
    { key: 'month', label: 'هذا الشهر', icon: 'fa-calendar-alt' },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
      {/* Main Search Input */}
      <div className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all ${
        isPending ? 'border-cyan-300 bg-cyan-50/30' : 'border-slate-200 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100'
      }`}>
        <i className="fas fa-search text-slate-400" />
        <input
          type="text"
          aria-label="بحث"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="ابحث باستخدام اللغة الطبيعية... (مثال: طلبات اليوم، رقم هاتف معين، خدمة استشارية)"
          className="flex-1 bg-transparent outline-none text-sm font-tajawal"
        />
        {isPending && <i className="fas fa-spinner fa-spin text-cyan-500" />}
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          title={showAdvanced ? "إخفاء الفلاتر المتقدمة" : "إظهار الفلاتر المتقدمة"}
          className="text-slate-400 hover:text-cyan-500 transition-colors"
        >
          <i className={`fas fa-sliders-h ${showAdvanced ? 'text-cyan-500' : ''}`} />
        </button>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {quickFilters.map(f => (
          <button
            key={f.key}
            onClick={() => {
              const newFilters = { ...filters, dateRange: f.key as any };
              setFilters(newFilters);
              onSearch(query, newFilters);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filters.dateRange === f.key 
                ? 'bg-cyan-100 text-cyan-700' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <i className={`fas ${f.icon}`} /> {f.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-100 grid md:grid-cols-3 gap-4 animate-fade-in">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">الحالة</label>
            <select 
              aria-label="فلتر الحالة"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              onChange={(e) => {
                const newFilters = { ...filters, status: e.target.value };
                setFilters(newFilters);
                onSearch(query, newFilters);
              }}
            >
              <option value="">الكل</option>
              <option value="pending_review">بانتظار المراجعة</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="completed">مكتمل</option>
              <option value="rejected">مرفوض</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">نوع الخدمة</label>
            <select 
              aria-label="فلتر نوع الخدمة"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              onChange={(e) => {
                const newFilters = { ...filters, type: e.target.value };
                setFilters(newFilters);
                onSearch(query, newFilters);
              }}
            >
              <option value="">الكل</option>
              <option value="consultation">استشارة</option>
              <option value="training">تدريب</option>
              <option value="audit">تدقيق</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => {
                setFilters({ dateRange: 'all' });
                setQuery('');
                onSearch('', { dateRange: 'all' });
              }}
              className="text-sm text-slate-500 hover:text-red-500 transition-colors"
            >
              <i className="fas fa-times-circle mr-1" /> إعادة ضبط
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && query.length === 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <span className="text-xs text-slate-400">اقتراحات:</span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSearch(s)}
              className="text-xs text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease;
        }
      `}</style>
    </div>
  );
}