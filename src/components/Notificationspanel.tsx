// components/NotificationsPanel.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────────
interface Notification {
  id: string
  type: string
  title: string
  body?: string
  data?: Record<string, any>
  is_read: boolean
  created_at: string
}

// ─── Icon + Color Config ────────────────────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  // للأدمن
  new_service_request: { icon: '📋', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  new_event: { icon: '📅', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  new_job: { icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  new_review: { icon: '✍️', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  new_project: { icon: '📁', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  // للعميل
  request_assigned: { icon: '👤', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  request_status_changed: { icon: '🔄', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  request_rejected: { icon: '❌', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  request_approved: { icon: '✅', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  item_approved: { icon: '✅', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  item_rejected: { icon: '❌', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  // للموظف
  task_assigned: { icon: '📋', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  client_note: { icon: '📝', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  // عام
  event_reminder: { icon: '📅', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  badge_earned: { icon: '🏅', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  event_completed: { icon: '🎉', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  system: { icon: '⚙️', color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
}

const DEFAULT_CONFIG = { icon: '📌', color: '#64748b', bg: 'rgba(100,116,139,0.10)' }

// ─── Styles ─────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&display=swap');

@keyframes np-spin { to { transform: rotate(360deg) } }
@keyframes np-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6) }
  50% { box-shadow: 0 0 0 5px rgba(239,68,68,0) }
}
@keyframes panelSlide {
  from { opacity:0; transform:translateY(-8px) scale(.97) }
  to { opacity:1; transform:translateY(0) scale(1) }
}
@keyframes notifIn {
  from { opacity:0; transform:translateX(8px) }
  to { opacity:1; transform:translateX(0) }
}

.np-wrap { position:relative; display:flex; align-items:center; }

.np-trigger {
  position: relative;
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 1.5px solid #e2e8f0;
  background: #f1f5f9;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  transition: all .2s;
  flex-shrink: 0;
}
.np-trigger:hover {
  border-color: #0891b2;
  background: rgba(8,145,178,.08);
  transform: scale(1.05);
}

.np-badge {
  position: absolute;
  top: -5px; right: -5px;
  min-width: 18px; height: 18px;
  border-radius: 9px;
  background: #ef4444;
  color: white;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  padding: 0 4px;
  font-family: 'Tajawal', sans-serif;
  border: 2px solid white;
  animation: np-pulse 2s infinite;
}

.np-panel {
  position: fixed;
  top: 76px;
  left: 60px;
  width: min(360px, calc(100vw - 32px));
  max-height: 520px;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.08);
  direction: rtl;
  font-family: 'Tajawal', sans-serif;
  overflow: hidden;
  z-index: 999999;
  animation: panelSlide .25s cubic-bezier(.22,.68,0,1.2) both;
}

@media (max-width: 480px) {
  .np-panel {
    right: 8px;
    left: 8px;
    width: calc(100vw - 16px);
    transform: none;
    top: 70px;
  }
}

.np-panel-hdr {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  position: sticky;
  top: 0;
  z-index: 2;
}
.np-panel-title {
  font-size: 14px; font-weight: 800;
  color: #0f172a;
  margin: 0;
  display: flex; align-items: center; gap: 6px;
}
.np-panel-actions { display: flex; align-items: center; gap: 8px; }
.np-mark-all {
  background: none; border: none;
  color: #0891b2;
  font-family: 'Tajawal', sans-serif;
  font-size: 12px; font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background .15s;
}
.np-mark-all:hover { background: rgba(8,145,178,.08); }
.np-refresh-btn {
  background: none; border: none;
  color: #94a3b8; cursor: pointer;
  padding: 4px 6px; border-radius: 8px;
  font-size: 13px;
  transition: all .15s;
  display: flex; align-items: center;
}
.np-refresh-btn:hover { color: #0891b2; background: rgba(8,145,178,.08); }
.np-refresh-btn.spinning i { animation: np-spin .7s linear infinite; }

.np-list { overflow-y: auto; max-height: 420px; }
.np-list::-webkit-scrollbar { width: 3px; }
.np-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

.np-date-group {
  padding: 8px 16px 4px;
  font-size: 11px; font-weight: 800;
  color: #94a3b8;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: white;
  position: sticky;
  top: 0;
  z-index: 1;
}

.np-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background .15s;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  animation: notifIn .2s ease both;
  position: relative;
}
.np-item:last-child { border-bottom: none; }
.np-item:hover { background: #f8fafc; }
.np-item.unread { background: rgba(8,145,178,.03); }

.np-item-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}
.np-item-body { flex: 1; min-width: 0; }
.np-item-title {
  font-size: 13px; font-weight: 800;
  color: #0f172a;
  margin: 0 0 3px;
  line-height: 1.35;
  word-break: break-word;
}
.np-item-body-text {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 4px;
  line-height: 1.45;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-item-time { font-size: 11px; color: #94a3b8; }
.np-unread-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #0891b2;
  flex-shrink: 0;
  margin-top: 6px;
}

.np-item-delete {
  position: absolute;
  top: 8px; left: 10px;
  background: none; border: none;
  color: #cbd5e1; cursor: pointer;
  font-size: 12px;
  padding: 4px;
  border-radius: 6px;
  opacity: 0;
  transition: all .15s;
}
.np-item:hover .np-item-delete { opacity: 1; }
.np-item-delete:hover { color: #ef4444; background: #fee2e2; }

.np-empty {
  padding: 40px 24px;
  text-align: center;
  color: #94a3b8;
}
.np-empty-icon { font-size: 36px; margin-bottom: 10px; opacity: .6; }
.np-empty-text { font-size: 13px; font-weight: 700; margin: 0; }
.np-empty-sub { font-size: 12px; margin: 4px 0 0; opacity: .7; }

.np-footer {
  border-top: 1px solid #e2e8f0;
  padding: 10px 16px;
  text-align: center;
  background: white;
}
.np-footer-btn {
  background: none; border: none;
  color: #ef4444;
  font-family: 'Tajawal', sans-serif;
  font-size: 12px; font-weight: 700;
  cursor: pointer;
  padding: 4px 10px; border-radius: 8px;
  transition: background .15s;
}
.np-footer-btn:hover { background: #fee2e2; }
`

// ─── Helpers ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'الآن'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} دقيقة`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ساعة`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} يوم`
  return new Date(dateStr).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

function dateLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 86_400_000) return 'اليوم'
  if (diff < 172_800_000) return 'أمس'
  if (diff < 604_800_000) return 'هذا الأسبوع'
  return 'أقدم'
}

function groupNotifications(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {}
  for (const n of notifs) {
    const label = dateLabel(n.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  }
  const order = ['اليوم', 'أمس', 'هذا الأسبوع', 'أقدم']
  return order.filter(l => groups[l]?.length).map(label => ({ label, items: groups[label] }))
}

// ─── Component ───────────────────────────────────────────────────────────
interface NotificationsPanelProps {
  onNavigate?: (path: string) => void
  userId?: string
}

export function NotificationsPanel({ onNavigate, userId }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // Inject styles
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement('style')
      el.setAttribute('data-np', '1')
      document.head.appendChild(el)
      styleRef.current = el
    }
    styleRef.current.textContent = STYLES
    return () => { styleRef.current?.remove(); styleRef.current = null }
  }, [])

  // Close on outside click - works with portal
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const panel = document.querySelector('.np-panel')
      const wrap = panelRef.current
      if (wrap && !wrap.contains(target) && panel && !panel.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Load notifications
  const loadNotifs = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    const list = data || []
    setNotifs(list)
    setUnread(list.filter((n: Notification) => !n.is_read).length)
  }, [userId])

  useEffect(() => { loadNotifs() }, [loadNotifs])

  // Real-time subscription
  useEffect(() => {
    if (!userId) return

    const channelName = 'notifs_' + userId
    supabase.getChannels().forEach(ch => {
      if (ch.topic === `realtime:${channelName}`) {
        supabase.removeChannel(ch)
      }
    })

    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(({ data }) => {
            const list = data || []
            setNotifs(list)
            setUnread(list.filter((n: Notification) => !n.is_read).length)
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [userId])

  // Actions
  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(p => Math.max(0, p - 1))
  }

  const markAllRead = async () => {
    if (!userId) return
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotifs(p => p.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  const deleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(p => {
      const removed = p.find(n => n.id === id)
      if (removed && !removed.is_read) setUnread(u => Math.max(0, u - 1))
      return p.filter(n => n.id !== id)
    })
  }

  const clearAll = async () => {
    if (!userId) return
    if (!window.confirm('هل تريد مسح جميع الإشعارات؟')) return
    await supabase.from('notifications').delete().eq('user_id', userId)
    setNotifs([])
    setUnread(0)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadNotifs()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleItemClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.id)
    if (onNavigate) {
      const d = notif.data || {}
      if (d.request_id) onNavigate('/dashboard')
      else if (d.event_id) onNavigate('/events')
      else if (d.job_id) onNavigate('/jobs')
      else if (d.review_id) onNavigate('/reviews')
      else if (d.project_id) onNavigate('/projects')
    }
    setOpen(false)
  }

  const groups = groupNotifications(notifs)

  if (!userId) return null

  return (
    <div className="np-wrap" ref={panelRef}>
      {/* Bell Button */}
      <button
        className="np-trigger"
        onClick={() => setOpen(p => !p)}
        aria-label={`الإشعارات${unread > 0 ? ` — ${unread} غير مقروءة` : ''}`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && (
          <span className="np-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Panel — via Portal to escape stacking context */}
      {open && createPortal(
        <div className="np-panel" role="dialog" aria-label="الإشعارات">
          {/* Header */}
          <div className="np-panel-hdr">
            <p className="np-panel-title">
              🔔 الإشعارات
              {unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>
                  {unread} جديد
                </span>
              )}
            </p>
            <div className="np-panel-actions">
              <button
                className={`np-refresh-btn${refreshing ? ' spinning' : ''}`}
                onClick={handleRefresh}
                title="تحديث"
              >
                <i className="fas fa-sync-alt" />
              </button>
              {unread > 0 && (
                <button className="np-mark-all" onClick={markAllRead}>
                  تعليم الكل مقروء
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="np-list">
            {notifs.length === 0 ? (
              <div className="np-empty">
                <div className="np-empty-icon">🔕</div>
                <p className="np-empty-text">لا توجد إشعارات</p>
                <p className="np-empty-sub">ستظهر هنا عند وجود تحديثات</p>
              </div>
            ) : (
              groups.map(group => (
                <div key={group.label}>
                  <div className="np-date-group">{group.label}</div>
                  {group.items.map((n, i) => {
                    const cfg = NOTIF_CONFIG[n.type] || DEFAULT_CONFIG
                    return (
                      <div
                        key={n.id}
                        className={`np-item${!n.is_read ? ' unread' : ''}`}
                        style={{ animationDelay: `${i * 0.03}s` }}
                        onClick={() => handleItemClick(n)}
                      >
                        {/* Icon */}
                        <div className="np-item-icon" style={{ background: cfg.bg }}>
                          {cfg.icon}
                        </div>

                        {/* Body */}
                        <div className="np-item-body">
                          <p className="np-item-title">{n.title}</p>
                          {n.body && (
                            <p className="np-item-body-text">{n.body}</p>
                          )}
                          <p className="np-item-time">{timeAgo(n.created_at)}</p>
                        </div>

                        {/* Unread dot */}
                        {!n.is_read && (
                          <div className="np-unread-dot" style={{ background: cfg.color }} />
                        )}

                        {/* Delete button */}
                        <button
                          className="np-item-delete"
                          onClick={(e) => deleteNotif(e, n.id)}
                          title="حذف"
                        >
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer — Clear All */}
          {notifs.length > 0 && (
            <div className="np-footer">
              <button className="np-footer-btn" onClick={clearAll}>
                <i className="fas fa-trash-alt" style={{ marginLeft: 4 }} />
                مسح جميع الإشعارات
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}