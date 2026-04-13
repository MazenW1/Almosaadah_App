import { useEffect, useRef } from 'react';
import { News } from '../lib/supabase';

interface NewsSectionProps {
  news: News[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onDeleteNews: (id: string) => void;
  onEditNews?: (id: string) => void;
  isAdmin: boolean;
}

export function NewsSection({
  news,
  loading,
  hasMore,
  onLoadMore,
  onDeleteNews,
  onEditNews,
  isAdmin,
}: NewsSectionProps) {
  const loadMoreBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (loadMoreBtnRef.current) {
      if (hasMore && !loading) {
        loadMoreBtnRef.current.style.display = 'flex';
      } else {
        loadMoreBtnRef.current.style.display = 'none';
      }
    }
  }, [hasMore, loading]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTimestamp = (timestamp: number | null | undefined) => {
    if (!timestamp) return null;
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('ar-SA');
  };

  const isValidUrl = (url: string) => /^https?:\/\//i.test(url);

  return (
    <section className="news-section" id="news" aria-labelledby="newsSectionTitle">
      <div className="news-container">
        <div className="section-header" data-aos="fade-up">
          <h2 id="newsSectionTitle">آخر الأخبار والإعلانات</h2>
          <p>تابع أحدث إنجازاتنا ومستجداتنا لحظة بلحظة</p>
        </div>

        <div className="news-grid" id="newsGrid" aria-label="قائمة الأخبار">
          {loading && news.length === 0 ? (
            <>
              <div className="skeleton" style={{ height: '450px', borderRadius: '20px' }} role="status" aria-label="جاري تحميل الأخبار" />
              <div className="skeleton" style={{ height: '450px', borderRadius: '20px' }} role="status" aria-label="جاري تحميل الأخبار" />
              <div className="skeleton" style={{ height: '450px', borderRadius: '20px' }} role="status" aria-label="جاري تحميل الأخبار" />
            </>
          ) : news.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#475569', gridColumn: '1 / -1' }}>
              لا توجد أخبار منشورة حالياً.
            </p>
          ) : (
            news.map((item) => (
              <article key={item.id} className="news-card" role="listitem" data-aos="fade-up">
                <div className="news-image-container">
                  <span className="news-date-badge">
                    {formatDate(item.date || item.created_at)}
                  </span>
                  <img
                    src={isValidUrl(item.image) ? item.image : 'img/default-news.jpg'}
                    alt={item.title || 'خبر'}
                    className="news-image"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://via.placeholder.com/500x300/0891b2/ffffff?text=News';
                    }}
                  />
                </div>
                <div className="news-content">
                  <div className="news-meta">
                    <span className="news-category">{item.category || 'عام'}</span>
                    {item.author && (
                      <span className="news-author">
                        <i className="fas fa-user-edit"></i>
                        {item.author}
                      </span>
                    )}
                  </div>
                  <h3 className="news-title">{item.title || 'عنوان الخبر'}</h3>
                  <p className="news-excerpt">{item.excerpt || ''}</p>

                  {/* معلومات إضافية */}
                  <div className="news-extra-info">
                    {item.city_info && (
                      <span className="news-info-item" title="المدينة">
                        <i className="fas fa-map-marker-alt"></i>
                        {item.city_info}
                      </span>
                    )}
                    {item.device_info && (
                      <span className="news-info-item" title="الجهاز">
                        <i className="fas fa-mobile-alt"></i>
                        {item.device_info}
                      </span>
                    )}
                    {item.timestamp && (
                      <span className="news-info-item" title="الوقت">
                        <i className="fas fa-clock"></i>
                        {formatTimestamp(item.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="news-footer">
                    <a
                      href={isValidUrl(item.tweet || '') ? item.tweet : '#'}
                      className="read-more"
                      target={isValidUrl(item.tweet || '') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                    >
                      اقرأ المزيد <i className="fas fa-arrow-left"></i>
                    </a>
                    {isAdmin && (
                      <div className="admin-actions">
                        {onEditNews && (
                          <button
                            className="news-action-btn admin-edit"
                            onClick={() => onEditNews(item.id)}
                            title="تعديل الخبر"
                            aria-label="تعديل الخبر"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        )}
                        <button
                          className="news-action-btn admin-delete"
                          onClick={() => onDeleteNews(item.id)}
                          title="حذف الخبر"
                          aria-label="حذف الخبر"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="load-more-container">
          <button
            ref={loadMoreBtnRef}
            className="btn-load-more"
            onClick={onLoadMore}
            disabled={loading}
            aria-label="عرض المزيد من الأخبار"
          >
            <i className="fas fa-spinner fa-spin" style={{ display: loading ? 'inline' : 'none' }}></i>
            <span>عرض المزيد من الأخبار</span>
            <i className="fas fa-chevron-down"></i>
          </button>
        </div>
      </div>
    </section>
  );
}
