import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchServicesWithSections, subscribeToServices, deleteService } from '../lib/supabase';
import type { ServiceFull, ServiceSection } from '../lib/supabase';
import { AddServiceModal } from './AddServiceModal';

interface ProductsProps {
  onProductSelect: (productName: string, productType?: string) => void;
}

// ── نافذة تأكيد الحذف ──────────────────────────────────────────────────────────
function DeleteConfirmDialog({
  name, onConfirm, onCancel, deleting,
}: {
  name: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:10000,
        background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div style={{
        background:'#fff', borderRadius:'20px', padding:'32px',
        maxWidth:'420px', width:'100%', direction:'rtl',
        fontFamily:'Tajawal,sans-serif', textAlign:'center',
        boxShadow:'0 32px 80px rgba(0,0,0,.25)',
      }}>
        <div style={{
          width:'64px', height:'64px', borderRadius:'50%',
          background:'#fee2e2', display:'flex', alignItems:'center',
          justifyContent:'center', margin:'0 auto 20px', fontSize:'1.8rem', color:'#dc2626',
        }}>
          <i className="fas fa-trash-alt" />
        </div>
        <h3 style={{ margin:'0 0 10px', fontSize:'1.2rem', fontWeight:900, color:'#0f172a' }}>
          تأكيد الحذف
        </h3>
        <p style={{ margin:'0 0 24px', color:'#64748b', fontSize:'.95rem', lineHeight:1.6 }}>
          هل أنت متأكد من حذف المنتج<br />
          <strong style={{ color:'#0f172a' }}>"{name}"</strong>؟<br />
          <span style={{ fontSize:'.82rem', color:'#ef4444' }}>لا يمكن التراجع عن هذا الإجراء.</span>
        </p>
        <div style={{ display:'flex', gap:'12px', justifyContent:'center' }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding:'10px 24px', borderRadius:'10px',
              border:'1px solid #e2e8f0', background:'#f8fafc',
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily:'Tajawal,sans-serif', fontWeight:700, color:'#64748b', fontSize:'.9rem',
            }}
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              padding:'10px 28px', borderRadius:'10px', border:'none',
              background: deleting ? '#94a3b8' : 'linear-gradient(135deg,#ef4444,#dc2626)',
              color:'#fff', cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily:'Tajawal,sans-serif', fontWeight:700, fontSize:'.9rem',
              display:'flex', alignItems:'center', gap:'8px',
            }}
          >
            {deleting
              ? <><i className="fas fa-spinner fa-spin" />جاري الحذف...</>
              : <><i className="fas fa-trash-alt" />نعم، احذف</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Products({ onProductSelect }: ProductsProps) {
  const { isAdminOrEmployee, isAdmin } = useAuth();
  const [products, setProducts]         = useState<ServiceFull[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editingProduct, setEditingProduct]   = useState<ServiceFull | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ServiceFull | null>(null);
  const [isDeleting, setIsDeleting]     = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchServicesWithSections();
      setProducts(all.filter(s => s.category === 'منتج'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const sub = subscribeToServices(() => load(), 'products-realtime');
    return () => { sub.unsubscribe(); };
  }, [load]);

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      await deleteService(deletingProduct.service_id);
      setDeletingProduct(null);
      await load();
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdminAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  if (loading) return (
    <section className="products-section" id="products">
      <div style={{ textAlign:'center', padding:'80px 0', color:'#c5a059', fontFamily:'Tajawal,sans-serif' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:'2rem', display:'block', marginBottom:'12px' }} />
        جاري تحميل المنتجات...
      </div>
    </section>
  );

  return (
    <>
      <style>{`
        .product-admin-actions{
          position:absolute; top:14px; left:14px;
          display:flex; gap:6px;
          opacity:0; transition:opacity .25s ease; z-index:10;
        }
        .product-item:hover .product-admin-actions,
        .clickable-card:hover .product-admin-actions { opacity:1; }
        .product-action-btn{
          width:34px; height:34px; border-radius:9px; border:none;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          font-size:.82rem; transition:all .2s ease;
        }
        .product-action-btn.edit{ background:rgba(197,160,89,.15); color:#c5a059; }
        .product-action-btn.edit:hover{ background:#c5a059; color:#fff; transform:scale(1.1); }
        .product-action-btn.del{ background:rgba(239,68,68,.1); color:#ef4444; }
        .product-action-btn.del:hover{ background:#ef4444; color:#fff; transform:scale(1.1); }
      `}</style>

      <section className="products-section" id="products" aria-labelledby="productsTitle">
        <div className="section-header" data-aos="fade-up">
          <h2 id="productsTitle">منتجاتنا النوعيّة</h2>
          <p>حلول متقدمة ومبتكرة… لتأمين الاستدامة وتعظيم التأثير</p>
        </div>

        <div className="products-grid" data-aos="fade-up">
          {products.map((product) => (
            <article
              key={product.service_id}
              className={`product-item clickable-card ${product.highlight ? 'highlight' : ''}`}
              style={{ position:'relative' }}
              onClick={() => onProductSelect(product.service_name, product.service_name)}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();onProductSelect(product.service_name, product.service_name)} }}
              role="button" tabIndex={0} aria-label={product.service_name} data-aos="fade-up"
            >
              {/* ── أزرار الأدمن (تعديل + حذف) ── */}
              {isAdmin && (
                <div className="product-admin-actions">
                  <button
                    className="product-action-btn edit"
                    title="تعديل المنتج"
                    onClick={e => handleAdminAction(e, () => setEditingProduct(product))}
                  >
                    <i className="fas fa-pen" />
                  </button>
                  <button
                    className="product-action-btn del"
                    title="حذف المنتج"
                    onClick={e => handleAdminAction(e, () => setDeletingProduct(product))}
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                </div>
              )}

              <div style={{ display:'flex', flexWrap:'wrap', gap:'40px', alignItems:'flex-start' }}>

                {/* ── العمود الأيمن ── */}
                <div style={{ flex:'1.2', minWidth:'280px' }}>

                  {/* العنوان + badge */}
                  <div style={{ marginBottom:'15px' }}>
                    <h3>
                      {product.emoji} {product.service_name}
                      {product.badge?.trim() && (
                        <><br />
                          <span className="gov-badge" style={{ fontSize:'.85rem', padding:'4px 10px', display:'inline-block', marginTop:'6px', borderRadius:'4px' }}>
                            {product.badge_icon && <i className={`fas ${product.badge_icon}`} style={{ marginLeft:'5px' }} />}
                            {product.badge}
                          </span>
                        </>
                      )}
                    </h3>
                  </div>

                  {/* الوصف */}
                  <p>{product.service_description}</p>

                  {/* ── الأقسام المرنة (sections) ── */}
                  {(product.sections ?? []).map((sec: ServiceSection, i: number) => (
                    <div key={i} style={{
                      marginTop: i === 0 ? '25px' : '12px',
                      padding: '12px',
                      borderRight: `4px solid ${sec.color ?? '#0891b2'}`,
                      background: `${sec.color ?? '#0891b2'}0d`,
                      borderRadius: '4px',
                    }}>
                      <p style={{ margin:0, fontSize:'.95rem', color: sec.color ?? '#0891b2' }}>
                        <strong>
                          {sec.icon && <i className={`fas ${sec.icon}`} style={{ marginLeft:'4px' }} />}
                          {' '}{sec.label}:
                        </strong>{' '}
                        {sec.value}
                      </p>
                      {sec.items && sec.items.length > 0 && (
                        <ul style={{ margin:'8px 0 0', paddingRight:'16px', color: sec.color ?? '#0891b2', fontSize:'.88rem' }}>
                          {sec.items.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}

          {/* بطاقة الإضافة — للأدمن والموظفين */}
          {isAdminOrEmployee && (
            <article
              className="product-item clickable-card"
              onClick={() => setShowModal(true)}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setShowModal(true)}}}
              role="button" tabIndex={0} aria-label="إضافة منتج جديد" data-aos="fade-up"
              style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                minHeight:'200px', flexDirection:'column', gap:'16px',
                border:'2px dashed rgba(197,160,89,.4)', background:'rgba(197,160,89,.02)',
              }}
            >
              <div style={{
                width:'64px', height:'64px', borderRadius:'50%',
                background:'rgba(197,160,89,.12)', border:'2px solid rgba(197,160,89,.3)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'1.8rem', color:'#c5a059', transition:'all .3s',
              }}>
                <i className="fas fa-plus" />
              </div>
              <span style={{ fontFamily:'Tajawal,sans-serif', fontWeight:800, color:'#c5a059', fontSize:'1rem' }}>
                إضافة منتج جديد
              </span>
            </article>
          )}
        </div>
      </section>

      {/* مودال الإضافة */}
      {showModal && (
        <AddServiceModal
          defaultCategory="منتج"
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {/* مودال التعديل — key يجبر React على إعادة تهيئة الحالة عند تغيير المنتج */}
      {editingProduct && (
        <AddServiceModal
          key={`edit-${editingProduct.service_id}`}
          defaultCategory="منتج"
          initialData={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); load(); }}
        />
      )}

      {/* نافذة تأكيد الحذف */}
      {deletingProduct && (
        <DeleteConfirmDialog
          name={deletingProduct.service_name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingProduct(null)}
          deleting={isDeleting}
        />
      )}
    </>
  );
}