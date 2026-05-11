import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchServicesWithSections, subscribeToServices, deleteService } from '../lib/supabase';
import type { ServiceFull } from '../lib/supabase';
import { AddServiceModal } from './AddserviceModal';

interface ServicesProps {
  onServiceSelect: (serviceName: string, serviceType?: string) => void;
}

// ── نافذة تأكيد الحذف ──────────────────────────────────────────────────────────
function DeleteConfirmDialog({
  name, accent, onConfirm, onCancel, deleting,
}: {
  name: string; accent: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
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
          هل أنت متأكد من حذف الخدمة<br />
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

export function Services({ onServiceSelect }: ServicesProps) {
  const { isAdminOrEmployee, isAdmin } = useAuth();
  const [services, setServices]       = useState<ServiceFull[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingService, setEditingService] = useState<ServiceFull | null>(null);
  const [deletingService, setDeletingService] = useState<ServiceFull | null>(null);
  const [isDeleting, setIsDeleting]   = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchServicesWithSections();
      setServices(all.filter(s => s.category === 'خدمة'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const sub = subscribeToServices(() => load(), 'services-realtime');
    return () => { sub.unsubscribe(); };
  }, [load]);

  const handleDeleteConfirm = async () => {
    if (!deletingService) return;
    setIsDeleting(true);
    try {
      await deleteService(deletingService.service_id);
      setDeletingService(null);
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
    <section className="services-section-v2" id="services">
      <div style={{ textAlign:'center', padding:'80px 0', color:'#0ea5e9', fontFamily:'Tajawal,sans-serif' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:'2rem', display:'block', marginBottom:'12px' }} />
        جاري تحميل الخدمات...
      </div>
    </section>
  );

  return (
    <>
      <style>{`
        .services-section-v2{padding:100px 24px;direction:rtl;position:relative}
        .services-section-v2 .section-header-v2{text-align:center;margin-bottom:64px}
        .section-header-v2 h2{font-family:'Tajawal',sans-serif;font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;background:linear-gradient(135deg,#0c4a6e,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:12px}
        .section-header-v2 p{font-family:'Tajawal',sans-serif;font-size:1.1rem;color:#64748b;font-weight:500}
        .services-grid-v2{max-width:1300px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;list-style:none;padding:0}
        @keyframes icon-pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,.25)}50%{box-shadow:0 0 0 10px rgba(14,165,233,0)}}
        .service-card-v2{position:relative;background:rgba(255,255,255,.88);border:1px solid rgba(14,165,233,.12);border-radius:22px;padding:32px 28px 28px;cursor:pointer;overflow:hidden;backdrop-filter:blur(16px);transition:all .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 16px rgba(14,165,233,.06);text-align:right}
        .service-card-v2::before{content:'';position:absolute;top:0;left:20%;right:20%;height:2px;background:linear-gradient(90deg,transparent,#0ea5e9,transparent);opacity:0;transition:opacity .3s,left .3s,right .3s}
        .service-card-v2:hover{transform:translateY(-10px) scale(1.02);border-color:rgba(14,165,233,.35);box-shadow:0 24px 56px rgba(14,165,233,.18),0 4px 16px rgba(0,0,0,.05);background:rgba(255,255,255,.97)}
        .service-card-v2:hover::before{opacity:1;left:0;right:0}
        .service-card-v2:focus-visible{outline:2px solid #0ea5e9;outline-offset:3px}
        .sv2-icon{width:58px;height:58px;border-radius:18px;background:rgba(14,165,233,.08);border:1.5px solid rgba(14,165,233,.2);display:flex;align-items:center;justify-content:center;font-size:1.35rem;color:#0284c7;margin-bottom:20px;transition:all .3s ease}
        .service-card-v2:hover .sv2-icon{background:linear-gradient(135deg,rgba(14,165,233,.15),rgba(56,189,248,.1));border-color:rgba(14,165,233,.4);transform:rotate(-5deg) scale(1.1);color:#0ea5e9;animation:icon-pulse 1.5s ease infinite}
        .sv2-title{font-family:'Tajawal',sans-serif;font-size:1.05rem;font-weight:800;color:#0f172a;margin-bottom:10px;line-height:1.4;transition:color .3s}
        .service-card-v2:hover .sv2-title{color:#0284c7}
        .sv2-desc{font-family:'Tajawal',sans-serif;font-size:.88rem;color:#64748b;line-height:1.75;font-weight:400}
        .sv2-cta{display:flex;align-items:center;gap:6px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(14,165,233,.1);font-family:'Tajawal',sans-serif;font-size:.83rem;font-weight:800;color:#0284c7;opacity:0;transform:translateY(5px);transition:all .3s ease}
        .service-card-v2:hover .sv2-cta{opacity:1;transform:translateY(0)}
        .sv2-cta i{transition:transform .3s ease}
        .service-card-v2:hover .sv2-cta i{transform:translateX(-4px)}
        .sv2-number{position:absolute;top:18px;left:18px;font-family:'Courier New',monospace;font-size:.65rem;font-weight:700;color:rgba(14,165,233,.3);letter-spacing:.05em}
        .sv2-add-card{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;border:2px dashed rgba(14,165,233,.3);border-radius:22px;cursor:pointer;transition:all .3s ease;background:rgba(14,165,233,.02);gap:12px}
        .sv2-add-card:hover{border-color:#0ea5e9;background:rgba(14,165,233,.06);transform:translateY(-4px)}
        .sv2-add-icon{width:60px;height:60px;border-radius:50%;background:rgba(14,165,233,.1);border:2px solid rgba(14,165,233,.25);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#0284c7;transition:all .3s}
        .sv2-add-card:hover .sv2-add-icon{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border-color:transparent;transform:scale(1.1)}
        .sv2-add-label{font-family:'Tajawal',sans-serif;font-weight:800;color:#0284c7;font-size:.95rem}
        .sv2-admin-actions{position:absolute;top:14px;right:14px;display:flex;gap:6px;opacity:0;transition:opacity .25s ease;z-index:10}
        .service-card-v2:hover .sv2-admin-actions{opacity:1}
        .sv2-action-btn{width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;transition:all .2s ease}
        .sv2-action-btn.edit{background:rgba(14,165,233,.12);color:#0284c7}
        .sv2-action-btn.edit:hover{background:#0ea5e9;color:#fff;transform:scale(1.1)}
        .sv2-action-btn.del{background:rgba(239,68,68,.1);color:#ef4444}
        .sv2-action-btn.del:hover{background:#ef4444;color:#fff;transform:scale(1.1)}
      `}</style>

      <section className="services-section-v2" id="services" aria-labelledby="servicesTitle">
        <div className="section-header-v2" data-aos="fade-up">
          <h2 id="servicesTitle">خدماتنا</h2>
          <p>نمنح كيانك الجاهزية.. ليحصد التمكين</p>
        </div>

        <ul className="services-grid-v2">
          {services.map((service, index) => (
            <li
              key={service.service_id}
              className="service-card-v2"
              onClick={() => onServiceSelect(service.service_name, 'service')}
              onKeyDown={e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();onServiceSelect(service.service_name,'service')} }}
              tabIndex={0}
              aria-label={`طلب خدمة: ${service.service_name}`}
              data-aos="fade-up" data-aos-delay={Math.min(index*70,350)}
            >
              {/* ── أزرار الأدمن (تعديل + حذف) ── */}
              {isAdmin && (
                <div className="sv2-admin-actions">
                  <button
                    className="sv2-action-btn edit"
                    title="تعديل الخدمة"
                    onClick={e => handleAdminAction(e, () => setEditingService(service))}
                  >
                    <i className="fas fa-pen" />
                  </button>
                  <button
                    className="sv2-action-btn del"
                    title="حذف الخدمة"
                    onClick={e => handleAdminAction(e, () => setDeletingService(service))}
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                </div>
              )}

              <span className="sv2-number">{String(index+1).padStart(2,'0')}</span>
              <div className="sv2-icon" aria-hidden="true">
                <i className={`fas ${service.icon||'fa-star'}`} />
              </div>
              <h3 className="sv2-title">{service.service_name}</h3>
              <p className="sv2-desc">{service.service_description}</p>
              <div className="sv2-cta">
                <i className="fas fa-arrow-left" /> اطلب الخدمة الآن
              </div>
            </li>
          ))}

          {isAdminOrEmployee && (
            <li
              className="sv2-add-card"
              onClick={() => setShowModal(true)}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setShowModal(true)}}}
              tabIndex={0} aria-label="إضافة خدمة جديدة" data-aos="fade-up"
            >
              <div className="sv2-add-icon"><i className="fas fa-plus" /></div>
              <span className="sv2-add-label">إضافة خدمة جديدة</span>
            </li>
          )}
        </ul>
      </section>

      {/* مودال الإضافة */}
      {showModal && (
        <AddServiceModal
          defaultCategory="خدمة"
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}

      {/* مودال التعديل — key يجبر React على إعادة تهيئة الحالة عند تغيير الخدمة */}
      {editingService && (
        <AddServiceModal
          key={`edit-${editingService.service_id}`}
          defaultCategory="خدمة"
          initialData={editingService}
          onClose={() => setEditingService(null)}
          onSaved={() => { setEditingService(null); load(); }}
        />
      )}

      {/* نافذة تأكيد الحذف */}
      {deletingService && (
        <DeleteConfirmDialog
          name={deletingService.service_name}
          accent="#0ea5e9"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingService(null)}
          deleting={isDeleting}
        />
      )}
    </>
  );
}