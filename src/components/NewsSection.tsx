import { useEffect, useRef, useCallback, memo } from 'react';
import { News } from '../lib/supabase';

// ─── Security helpers ────────────────────────────────────────────────────────

/** منع XSS: قبول روابط HTTP/HTTPS فقط */
const isValidUrl = (url: unknown): url is string =>
  typeof url === 'string' && /^https?:\/\//i.test(url.trim());

/** تنظيف النص من رموز HTML الخطرة */
const sanitize = (str: unknown): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/** التحقق من صحة UUID لمنع حقن المعرفات */
const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_\-]{1,64}$/.test(id);

// ─── Types ───────────────────────────────────────────────────────────────────

interface NewsSectionProps {
  news: News[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDeleteNews: (id: string) => void;
  onEditNews?: (id: string) => void;
  isAdmin: boolean;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

const getInitials = (name: string): string => {
  if (!name) return '؟';
  return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('');
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="news-card news-card--skeleton" role="status" aria-label="جاري تحميل الخبر">
    <div className="news-img-wrapper news-img-wrapper--skeleton" />
    <div className="news-card__body">
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line--medium" />
      <div className="skeleton-line skeleton-line--short" />
    </div>
  </div>
);

// ─── Single Card ─────────────────────────────────────────────────────────────

interface NewsCardProps {
  item: News;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}

const NewsCard = memo(({ item, isAdmin, onDelete, onEdit }: NewsCardProps) => {
  const handleDelete = useCallback(() => {
    if (!isValidId(item.id)) return;
    if (window.confirm('هل أنت متأكد من حذف هذا الخبر؟')) {
      onDelete(item.id);
    }
  }, [item.id, onDelete]);

  const handleEdit = useCallback(() => {
    if (!isValidId(item.id)) return;
    onEdit?.(item.id);
  }, [item.id, onEdit]);

  const imgSrc = isValidUrl(item.image)
    ? item.image
    : '/img/default-news.jpg';

  const tweetLink = isValidUrl(item.tweet) ? item.tweet : null;
  const linkLabel =
    tweetLink?.includes('twitter') || tweetLink?.includes('x.com')
      ? 'عرض التغريدة'
      : 'المزيد من المعلومات';

  return (
    <article className="news-card" data-aos="fade-up" aria-label={sanitize(item.title)}>
      {/* ── الصورة ── */}
      <div className="news-img-wrapper">
        <span className="news-category-pill">{sanitize(item.category) || 'عام'}</span>
        <img
          src={imgSrc}
          alt={sanitize(item.title) || 'خبر'}
          className="news-img"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null; // منع حلقة لا نهائية
            target.src = '/img/default-news.jpg';
          }}
        />
        <span className="news-date-badge">
          {formatDate(item.date || item.created_at)}
        </span>
      </div>

      {/* ── المحتوى ── */}
      <div className="news-card__body">
        {item.author && (
          <div className="news-author-chip">
            <span className="news-author-avatar" aria-hidden="true">
              {getInitials(item.author)}
            </span>
            <span>{sanitize(item.author)}</span>
          </div>
        )}

        <h3 className="news-card__title">{sanitize(item.title) || 'عنوان الخبر'}</h3>

        {item.excerpt && (
          <p className="news-card__excerpt">{sanitize(item.excerpt)}</p>
        )}

        <div className="news-card__footer">
          {tweetLink ? (
            <a
              href={tweetLink}
              className="news-read-more"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${linkLabel}: ${sanitize(item.title)}`}
            >
              {linkLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
          ) : (
            <span />
          )}

          {isAdmin && (
            <div className="news-admin-actions">

              <button
                className="news-icon-btn news-icon-btn--delete"
                onClick={handleDelete}
                aria-label={`حذف: ${sanitize(item.title)}`}
                title="حذف الخبر"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

NewsCard.displayName = 'NewsCard';

// ─── Main Component ──────────────────────────────────────────────────────────

export function NewsSection({
  news,
  loading,
  hasMore,
  onLoadMore,
  onDeleteNews,
  onEditNews,
  isAdmin,
}: NewsSectionProps) {
  const loadMoreRef = useRef<HTMLButtonElement>(null);

  // إخفاء/إظهار زر التحميل
  useEffect(() => {
    if (loadMoreRef.current) {
      loadMoreRef.current.classList.toggle('news-load-more-btn--hidden', !(hasMore && !loading));
    }
  }, [hasMore, loading]);

  return (
    <section
      className="news-section"
      id="news"
      aria-labelledby="newsSectionTitle"
    >
      <div className="news-container">
        {/* ── Header ── */}
        <div className="section-header" data-aos="fade-up">
          <h2 id="newsSectionTitle" className="section-title">آخر الأخبار والإعلانات</h2>
          <p>تابع أحدث إنجازاتنا ومستجداتنا لحظة بلحظة</p>
        </div>

        {/* ── Grid ── */}
        <div
          className="news-grid"
          aria-label="قائمة الأخبار"
        >
          {loading && news.length === 0 ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : news.length === 0 ? (
            <p className="news-empty" aria-live="polite">
              لا توجد أخبار منشورة حالياً.
            </p>
          ) : (
            news.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onDelete={onDeleteNews}
                onEdit={onEditNews}
              />
            ))
          )}
        </div>

        {/* ── Load More ── */}
        <div className="news-load-more-wrap">
          <button
            ref={loadMoreRef}
            className="news-load-more-btn"
            onClick={onLoadMore}
            disabled={loading}
            aria-label="عرض المزيد من الأخبار"
            
          >
            {loading && (
              <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            <span>عرض المزيد من الأخبار</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}