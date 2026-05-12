// hooks/useDarkMode.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hook مشترك لإدارة الـ Dark Mode في جميع الصفحات
// يقرأ الحالة من document.documentElement ويتابع تغييرها بـ MutationObserver
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    // أولاً: تحقق من الـ class الحالي على <html>
    if (document.documentElement.classList.contains('dark')) return true;
    // ثانياً: fallback من localStorage (مهم لأول تحميل صفحات فرعية)
    return localStorage.getItem('darkMode') === 'true';
  });

  // طبّق الـ class فوراً عند أول mount (يحل مشكلة الصفحات الفرعية)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // تابع تغييرات الـ class على <html> من أي مكان
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // دالة التبديل — تحدث localStorage + الـ class معاً
  const toggleDarkMode = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('darkMode', String(next));
    setIsDarkMode(next);
  }, []);

  return { isDarkMode, toggleDarkMode };
}