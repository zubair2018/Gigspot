import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSiteSettings } from '../firebase/db'
import {
  deleteListing,
  deleteUserProfile,
  getAdminPrefs,
  getOverview,
  getUserStats,
  listAudit,
  listListings,
  listUsers,
  moderateListings,
  saveAdminPrefs,
  saveSiteSettings,
  saveUserNote,
  sendUserPasswordReset,
  setUserBanned,
} from '../admin/adminService'
import { CATEGORIES } from '../shared/constants'
import '../admin/admin.css'

const NAV = [
  { id: 'overview', label: 'Overview', icon: '◧' },
  { id: 'services', label: 'Services', icon: '✦' },
  { id: 'jobs', label: 'Hiring requests', icon: '▤' },
  { id: 'users', label: 'Users', icon: '☺' },
  { id: 'activity', label: 'Activity log', icon: '≡' },
  { id: 'settings', label: 'Site settings', icon: '⚙' },
  { id: 'customize', label: 'Customize', icon: '◐' },
]

const DEFAULT_PREFS = {
  accent: '#0b6b4a',
  theme: 'light',
  density: 'comfortable',
  defaultTab: 'overview',
  pageSize: 25,
  widgets: { stats: true, signups: true, categories: true, queue: true, activity: true },
}

const ACCENTS = ['#0b6b4a', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#334155']

// ───────────── helpers ─────────────
const toDate = value => (value?.toDate ? value.toDate() : value ? new Date(value) : null)
const fmtDate = value => {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
const fmtDateTime = value => {
  const d = toDate(value)
  return d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
const label = s => String(s || '').replace(/_/g, ' ')

function downloadCSV(filename, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function errText(error) {
  if (error?.code === 'permission-denied') return 'Permission denied. Deploy the latest firestore.rules and confirm you are an admin.'
  if (error?.code === 'failed-precondition') return 'A Firestore index is missing. Run: firebase deploy --only firestore:indexes'
  return error?.message || 'Something went wrong.'
}

// ───────────── root ─────────────
export default function Admin() {
  const { user, isAdmin, adminChecked, logout } = useAuth()
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [tab, setTab] = useState(() => window.location.hash.slice(1) || null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [pendingCount, setPendingCount] = useState(0)

  const notify = useCallback((message, isError = false) => {
    const id = Math.random()
    setToasts(t => [...t, { id, message, isError }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), isError ? 6000 : 3000)
  }, [])

  useEffect(() => {
    if (!isAdmin || !user) return
    getAdminPrefs(user.uid).then(saved => {
      const merged = { ...DEFAULT_PREFS, ...(saved || {}), widgets: { ...DEFAULT_PREFS.widgets, ...(saved?.widgets || {}) } }
      setPrefs(merged)
      setTab(current => current || merged.defaultTab)
    })
  }, [isAdmin, user])

  function go(id) {
    setTab(id)
    setMenuOpen(false)
    window.history.replaceState(null, '', `#${id}`)
  }

  async function updatePrefs(patch) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    try {
      await saveAdminPrefs(user.uid, next)
    } catch (error) {
      notify(errText(error), true)
    }
  }

  if (!adminChecked) return <div className="adm-gate"><p>Checking permissions…</p></div>

  if (!isAdmin) {
    return (
      <div className="adm-gate">
        <div className="adm-card">
          <h2 style={{ margin: 0 }}>Admin access required</h2>
          <p style={{ margin: 0 }}>
            You are signed in as <b>{user?.email}</b>, but this account is not an administrator.
          </p>
          <p style={{ margin: 0 }}>To grant access: open the Firebase Console → Firestore Database → create a collection
            <b> admins</b> with a document whose ID is exactly your UID:</p>
          <code>{user?.uid}</code>
          <p style={{ margin: 0 }}>Add any field (e.g. <i>role: "owner"</i>), then refresh this page.</p>
          <Link to="/">← Back to Gigspot.in</Link>
        </div>
      </div>
    )
  }

  const active = tab || prefs.defaultTab
  const title = NAV.find(n => n.id === active)?.label || 'Overview'

  return (
    <div
      className="adm"
      data-theme={prefs.theme}
      data-density={prefs.density}
      style={{ '--a': prefs.accent }}
    >
      <aside className={`adm-side ${menuOpen ? 'open' : ''}`}>
        <div className="adm-brand">gigspot<span>.in</span></div>
        {NAV.map(item => (
          <button
            key={item.id}
            type="button"
            className="adm-nav"
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
            {item.id === 'services' && pendingCount > 0 && <span className="n">{pendingCount}</span>}
          </button>
        ))}
        <div className="adm-side-foot">
          <span>{user.email}</span>
          <Link to="/">← View public site</Link>
          <button type="button" className="adm-btn sm" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-top">
          <button type="button" className="adm-btn adm-menu-btn" onClick={() => setMenuOpen(o => !o)}>☰</button>
          <h1>{title}</h1>
          <span className="sp" />
        </div>

        {active === 'overview' && <Overview prefs={prefs} notify={notify} go={go} onPending={setPendingCount} />}
        {active === 'services' && <ListingsView key="skills" collectionName="skills" prefs={prefs} notify={notify} />}
        {active === 'jobs' && <ListingsView key="jobs" collectionName="jobs" prefs={prefs} notify={notify} />}
        {active === 'users' && <UsersView prefs={prefs} notify={notify} />}
        {active === 'activity' && <ActivityView notify={notify} />}
        {active === 'settings' && <SettingsView notify={notify} />}
        {active === 'customize' && <CustomizeView prefs={prefs} updatePrefs={updatePrefs} />}
      </main>

      <div className="adm-toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`adm-toast ${t.isError ? 'err' : ''}`}>{t.message}</div>)}
      </div>
    </div>
  )
}

// ───────────── shared UI ─────────────
function Pill({ value }) {
  return <span className={`adm-pill ${value}`}>{label(value) || '—'}</span>
}

function Stat({ title, value, hint, alert, onClick }) {
  return (
    <div className={`adm-card adm-stat ${alert && value > 0 ? 'alert' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <small>{title}</small>
      <b>{value ?? '…'}</b>
      {hint && <em>{hint}</em>}
    </div>
  )
}

function Drawer({ onClose, children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="adm-drawer-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer" role="dialog" aria-modal="true">
        <div><button type="button" className="adm-btn sm" onClick={onClose}>✕ Close</button></div>
        {children}
      </aside>
    </div>
  )
}

function useBusy() {
  const [busy, setBusy] = useState(false)
  const run = async fn => {
    setBusy(true)
    try { return await fn() } finally { setBusy(false) }
  }
  return [busy, run]
}

// ───────────── overview ─────────────
function Overview({ prefs, notify, go, onPending }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await getOverview()
      setData(result)
      onPending(result.skills.pending)
    } catch (e) {
      setError(errText(e))
    }
  }, [onPending])

  useEffect(() => { load() }, [load])

  const signups = useMemo(() => {
    if (!data) return []
    const days = []
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      days.push({ key: d.toDateString(), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), n: 0 })
    }
    data.recentUsers.forEach(u => {
      const d = toDate(u.createdAt)
      const slot = d && days.find(x => x.key === new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString())
      if (slot) slot.n += 1
    })
    return days
  }, [data])

  if (error) return <div className="adm-card"><p>{error}</p><button className="adm-btn" onClick={load}>Retry</button></div>
  if (!data) return <p className="adm-empty">Loading dashboard…</p>

  const w = prefs.widgets
  const maxCat = Math.max(1, ...data.categories.map(c => c.jobs + c.skills))
  const maxSignup = Math.max(1, ...signups.map(s => s.n))

  return (
    <>
      <div className="adm-top" style={{ marginTop: -8 }}>
        <span className="sp" />
        <button type="button" className="adm-btn" onClick={load}>↻ Refresh</button>
      </div>

      {w.stats && (
        <div className="adm-grid adm-stats">
          <Stat title="Services awaiting review" value={data.skills.pending} alert hint="Needs your decision" onClick={() => go('services')} />
          <Stat title="Live services" value={data.skills.live} hint={`${data.skills.total} total`} />
          <Stat title="Live hiring requests" value={data.jobs.live} hint={`${data.jobs.total} total`} />
          <Stat title="Users" value={data.users.total} hint={`${data.users.banned} banned`} onClick={() => go('users')} />
          <Stat title="Suspended listings" value={data.skills.suspended + data.jobs.suspended} alert />
        </div>
      )}

      <div className="adm-grid adm-2col">
        {w.signups && (
          <div className="adm-card">
            <h3>New users · last 14 days</h3>
            <svg viewBox="0 0 280 90" width="100%" role="img" aria-label="New users per day">
              {signups.map((s, i) => {
                const h = (s.n / maxSignup) * 62
                return (
                  <g key={s.key}>
                    <rect x={i * 20 + 3} y={70 - h} width="14" height={Math.max(h, 1.5)} rx="3" fill="var(--a)" opacity={s.n ? 1 : 0.25}>
                      <title>{`${s.label}: ${s.n}`}</title>
                    </rect>
                  </g>
                )
              })}
              <text x="3" y="86" fontSize="8" fill="var(--muted)">{signups[0]?.label}</text>
              <text x="277" y="86" fontSize="8" fill="var(--muted)" textAnchor="end">{signups.at(-1)?.label}</text>
            </svg>
          </div>
        )}

        {w.categories && (
          <div className="adm-card">
            <h3>Listings by category</h3>
            <div className="adm-bars">
              {data.categories.map(c => (
                <div className="adm-bar" key={c.name}>
                  {c.name}
                  <i><u style={{ width: `${((c.jobs + c.skills) / maxCat) * 100}%` }} /></i>
                  <span>{c.jobs + c.skills}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="adm-grid adm-2col">
        {w.queue && (
          <div className="adm-card">
            <h3>Review queue</h3>
            {data.pending.length === 0 ? <p className="adm-empty">Nothing waiting. 🎉</p> : (
              <div className="adm-list">
                {data.pending.map(item => (
                  <div key={item.id}>
                    <div className="grow"><b>{item.title}</b><small>{item.postedBy?.name} · {fmtDate(item.createdAt)}</small></div>
                    <button type="button" className="adm-btn sm" onClick={() => go('services')}>Review</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {w.activity && (
          <div className="adm-card">
            <h3>Recent admin activity</h3>
            {data.activity.length === 0 ? <p className="adm-empty">No actions yet.</p> : (
              <div className="adm-list">
                {data.activity.map(a => (
                  <div key={a.id}>
                    <div className="grow"><b>{label(a.action)}</b><small>{a.listingTitle || a.targetEmail || ''} · {a.actorEmail}</small></div>
                    <small>{fmtDateTime(a.createdAt)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ───────────── listings (services + jobs) ─────────────
function ListingsView({ collectionName, prefs, notify }) {
  const isSkills = collectionName === 'skills'
  const statuses = isSkills
    ? ['all', 'pending_review', 'published', 'rejected', 'paused', 'suspended', 'deleted']
    : ['all', 'published', 'paused', 'closed', 'suspended', 'deleted']

  const [status, setStatus] = useState(isSkills ? 'pending_review' : 'all')
  const [category, setCategory] = useState('All')
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [open, setOpen] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, run] = useBusy()

  const load = useCallback(async (reset = true) => {
    setLoading(true)
    try {
      const page = await listListings(collectionName, {
        status,
        cursor: reset ? null : cursor,
        pageSize: prefs.pageSize,
      })
      setItems(current => (reset ? page.items : [...current, ...page.items]))
      setCursor(page.cursor)
      setHasMore(page.hasMore)
      if (reset) setSelected(new Set())
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setLoading(false)
    }
  }, [collectionName, status, cursor, prefs.pageSize, notify])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true) }, [status, collectionName, prefs.pageSize])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(item => {
      if (category !== 'All' && item.category !== category) return false
      if (!term) return true
      return [item.title, item.description, item.location, item.postedBy?.name, ...(item.tags || [])]
        .filter(Boolean).join(' ').toLowerCase().includes(term)
    })
  }, [items, q, category])

  const toggle = id => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  async function act(action, listings) {
    try {
      await run(() => moderateListings(collectionName, listings, action, reason))
      notify(`${label(action)} · ${listings.length} item${listings.length > 1 ? 's' : ''}`)
      setReason('')
      setOpen(null)
      load(true)
    } catch (e) {
      notify(errText(e), true)
    }
  }

  async function remove(listing) {
    if (!window.confirm('Permanently delete this listing? This cannot be undone.')) return
    try {
      await run(() => deleteListing(collectionName, listing))
      notify('Listing deleted')
      setOpen(null)
      load(true)
    } catch (e) {
      notify(errText(e), true)
    }
  }

  const chosen = items.filter(i => selected.has(i.id))

  return (
    <>
      <div className="adm-toolbar">
        <input type="search" placeholder="Search title, owner, location, tag…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : label(s)}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button type="button" className="adm-btn" onClick={() => load(true)}>↻</button>
        <button
          type="button"
          className="adm-btn"
          onClick={() => downloadCSV(`${collectionName}.csv`, [
            ['id', 'title', 'status', 'category', 'location', 'owner', 'min', 'max', 'views', 'created'],
            ...visible.map(i => [i.id, i.title, i.status, i.category, i.location, i.postedBy?.name, i.payMin, i.payMax, i.views || 0, fmtDate(i.createdAt)]),
          ])}
        >
          Export CSV
        </button>
      </div>

      <div className="adm-tablewrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={visible.length > 0 && visible.every(i => selected.has(i.id))}
                  onChange={e => setSelected(e.target.checked ? new Set(visible.map(i => i.id)) : new Set())}
                />
              </th>
              <th>Listing</th><th>Owner</th><th>Status</th><th>Rate</th><th>Views</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(item => (
              <tr key={item.id} onClick={() => { setOpen(item); setReason('') }}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Select ${item.title}`} />
                </td>
                <td><div className="t">{item.featured && '★ '}{item.title}</div><div className="s">{item.category} · {item.location}</div></td>
                <td>{item.postedBy?.name || '—'}</td>
                <td><Pill value={item.status} /></td>
                <td>{money(item.payMin)}–{money(item.payMax)}<div className="s">{item.payType}</div></td>
                <td>{item.views || 0}</td>
                <td>{fmtDate(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && <p className="adm-empty">No listings match these filters.</p>}
        {loading && <p className="adm-empty">Loading…</p>}
      </div>

      {hasMore && !loading && (
        <p style={{ textAlign: 'center' }}><button type="button" className="adm-btn" onClick={() => load(false)}>Load more</button></p>
      )}

      {chosen.length > 0 && (
        <div className="adm-bulk">
          <b>{chosen.length} selected</b>
          <span className="sp" />
          {isSkills && <button type="button" className="adm-btn sm" disabled={busy} onClick={() => act('approve', chosen.filter(i => ['pending_review', 'rejected'].includes(i.status)))}>Approve</button>}
          <button type="button" className="adm-btn sm" disabled={busy} onClick={() => act('restore', chosen.filter(i => i.status === 'suspended'))}>Restore</button>
          <button
            type="button"
            className="adm-btn sm"
            disabled={busy}
            onClick={() => {
              const why = window.prompt('Reason for suspending the selected listings:')
              if (why?.trim()) { setReason(why); moderateListings(collectionName, chosen.filter(i => i.status !== 'suspended'), 'suspend', why).then(() => { notify('Suspended'); load(true) }).catch(e => notify(errText(e), true)) }
            }}
          >
            Suspend
          </button>
          <button type="button" className="adm-btn sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {open && (
        <Drawer onClose={() => setOpen(null)}>
          <div><Pill value={open.status} /></div>
          <h2>{open.title}</h2>
          <dl className="adm-kv">
            <dt>Owner</dt><dd>{open.postedBy?.name} <small>({open.postedBy?.uid})</small></dd>
            <dt>Category</dt><dd>{open.category}</dd>
            <dt>Location</dt><dd>{open.location}{open.availability ? ` · ${open.availability}` : ''}</dd>
            <dt>Rate</dt><dd>{money(open.payMin)} – {money(open.payMax)} {open.payType}</dd>
            <dt>Tags</dt><dd>{(open.tags || []).join(', ') || '—'}</dd>
            <dt>Views</dt><dd>{open.views || 0}</dd>
            <dt>Created</dt><dd>{fmtDateTime(open.createdAt)}</dd>
            {open.rejectionReason && (<><dt>Rejected for</dt><dd>{open.rejectionReason}</dd></>)}
            {open.moderationReason && (<><dt>Suspended for</dt><dd>{open.moderationReason}</dd></>)}
          </dl>
          <div className="adm-desc">{open.description}</div>
          {(open.portfolio || []).length > 0 && (
            <div className="adm-list">
              {open.portfolio.map(link => (
                <div key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer nofollow">{link.label}</a></div>
              ))}
            </div>
          )}
          <Link to={`/job/${open.id}`} target="_blank">Open public page ↗</Link>

          <label className="adm-field">
            <span>Reason (required to reject or suspend)</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="Shown to the owner for rejections" />
          </label>

          <div className="adm-actions">
            {isSkills && ['pending_review', 'rejected'].includes(open.status) && (
              <button type="button" className="adm-btn primary" disabled={busy} onClick={() => act('approve', [open])}>Approve</button>
            )}
            {isSkills && open.status === 'pending_review' && (
              <button type="button" className="adm-btn danger" disabled={busy || !reason.trim()} onClick={() => act('reject', [open])}>Reject</button>
            )}
            {open.status === 'suspended' ? (
              <button type="button" className="adm-btn" disabled={busy} onClick={() => act('restore', [open])}>Restore</button>
            ) : open.status !== 'deleted' && (
              <button type="button" className="adm-btn danger" disabled={busy || !reason.trim()} onClick={() => act('suspend', [open])}>Suspend</button>
            )}
            <button type="button" className="adm-btn" disabled={busy} onClick={() => act(open.featured ? 'unfeature' : 'feature', [open])}>
              {open.featured ? '★ Unfeature' : '☆ Feature'}
            </button>
            <button type="button" className="adm-btn danger" disabled={busy} onClick={() => remove(open)}>Delete forever</button>
          </div>
        </Drawer>
      )}
    </>
  )
}

// ───────────── users ─────────────
function UsersView({ prefs, notify }) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [stats, setStats] = useState(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, run] = useBusy()

  const load = useCallback(async (reset = true) => {
    setLoading(true)
    try {
      const page = await listUsers({ cursor: reset ? null : cursor, pageSize: Math.max(prefs.pageSize, 50) })
      setItems(current => (reset ? page.items : [...current, ...page.items]))
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setLoading(false)
    }
  }, [cursor, prefs.pageSize, notify])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true) }, [])

  function openUser(user) {
    setOpen(user)
    setReason('')
    setNote(user.adminNote || '')
    setStats(null)
    getUserStats(user.id).then(setStats).catch(() => {})
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(u => {
      if (filter === 'banned' && !u.banned) return false
      if (filter === 'unverified' && u.emailVerified) return false
      if (!term) return true
      return `${u.name} ${u.email}`.toLowerCase().includes(term)
    })
  }, [items, q, filter])

  async function ban(user, banned) {
    try {
      await run(() => setUserBanned(user, banned, reason))
      notify(banned ? 'User banned' : 'User unbanned')
      setItems(current => current.map(u => (u.id === user.id ? { ...u, banned, bannedReason: banned ? reason : '' } : u)))
      setOpen(null)
    } catch (e) {
      notify(errText(e), true)
    }
  }

  return (
    <>
      <div className="adm-toolbar">
        <input type="search" placeholder="Search name or email…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter">
          <option value="all">All users</option>
          <option value="unverified">Email not verified</option>
          <option value="banned">Banned</option>
        </select>
        <button type="button" className="adm-btn" onClick={() => load(true)}>↻</button>
        <button
          type="button"
          className="adm-btn"
          onClick={() => downloadCSV('users.csv', [
            ['uid', 'name', 'email', 'provider', 'verified', 'banned', 'joined', 'last_login'],
            ...visible.map(u => [u.id, u.name, u.email, u.provider, !!u.emailVerified, !!u.banned, fmtDate(u.createdAt), fmtDate(u.lastLoginAt)]),
          ])}
        >
          Export CSV
        </button>
      </div>

      <div className="adm-tablewrap">
        <table>
          <thead><tr><th>User</th><th>Sign-in</th><th>Email</th><th>Status</th><th>Joined</th><th>Last login</th></tr></thead>
          <tbody>
            {visible.map(u => (
              <tr key={u.id} onClick={() => openUser(u)}>
                <td><div className="t">{u.name}</div><div className="s">{u.email}</div></td>
                <td>{u.provider === 'google.com' ? 'Google' : 'Email + password'}</td>
                <td><Pill value={u.emailVerified ? 'ok' : 'warn'} />{' '}<span className="s">{u.emailVerified ? 'verified' : 'unverified'}</span></td>
                <td>{u.banned ? <Pill value="banned" /> : <Pill value="published" />}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>{fmtDate(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && <p className="adm-empty">No users found. Users appear here after their next sign-in.</p>}
        {loading && <p className="adm-empty">Loading…</p>}
      </div>
      {hasMore && !loading && <p style={{ textAlign: 'center' }}><button type="button" className="adm-btn" onClick={() => load(false)}>Load more</button></p>}

      {open && (
        <Drawer onClose={() => setOpen(null)}>
          <div>{open.banned ? <Pill value="banned" /> : <Pill value="published" />}</div>
          <h2>{open.name}</h2>
          <dl className="adm-kv">
            <dt>Email</dt><dd>{open.email}</dd>
            <dt>UID</dt><dd><small>{open.id}</small></dd>
            <dt>Sign-in method</dt><dd>{open.provider === 'google.com' ? 'Google' : 'Email + password'}</dd>
            <dt>Email verified</dt><dd>{open.emailVerified ? 'Yes' : 'No'}</dd>
            <dt>Joined</dt><dd>{fmtDateTime(open.createdAt)}</dd>
            <dt>Last login</dt><dd>{fmtDateTime(open.lastLoginAt)}</dd>
            <dt>Listings</dt><dd>{stats ? `${stats.skills} services · ${stats.jobs} requests` : '…'}</dd>
            {open.bannedReason && (<><dt>Ban reason</dt><dd>{open.bannedReason}</dd></>)}
          </dl>

          <p className="adm-desc" style={{ margin: 0 }}>
            Passwords are stored by Firebase Authentication as salted hashes and cannot be viewed by anyone.
            If this user is locked out, send them a reset link.
          </p>

          <label className="adm-field">
            <span>Private admin note</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
          </label>
          <div className="adm-actions">
            <button type="button" className="adm-btn sm" disabled={busy} onClick={() => run(() => saveUserNote(open, note)).then(() => notify('Note saved')).catch(e => notify(errText(e), true))}>Save note</button>
            <button type="button" className="adm-btn sm" disabled={busy || !open.email} onClick={() => run(() => sendUserPasswordReset(open.email)).then(() => notify('Reset email sent')).catch(e => notify(errText(e), true))}>Send password reset email</button>
          </div>

          <label className="adm-field">
            <span>Reason (required to ban)</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
          </label>
          <div className="adm-actions">
            {open.banned
              ? <button type="button" className="adm-btn primary" disabled={busy} onClick={() => ban(open, false)}>Unban user</button>
              : <button type="button" className="adm-btn danger" disabled={busy || !reason.trim()} onClick={() => ban(open, true)}>Ban user</button>}
            <button
              type="button"
              className="adm-btn danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Delete this profile document? The sign-in account itself stays in Firebase Authentication.')) return
                try {
                  await run(() => deleteUserProfile(open))
                  setItems(current => current.filter(u => u.id !== open.id))
                  setOpen(null)
                  notify('Profile deleted')
                } catch (e) { notify(errText(e), true) }
              }}
            >
              Delete profile
            </button>
          </div>
          <small style={{ color: 'var(--muted)' }}>A banned user can still sign in, but can no longer post, edit listings or send messages.</small>
        </Drawer>
      )}
    </>
  )
}

// ───────────── activity log ─────────────
function ActivityView({ notify }) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (reset = true) => {
    setLoading(true)
    try {
      const page = await listAudit({ cursor: reset ? null : cursor })
      setItems(current => (reset ? page.items : [...current, ...page.items]))
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setLoading(false)
    }
  }, [cursor, notify])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true) }, [])

  return (
    <>
      <div className="adm-tablewrap">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Reason</th><th>By</th></tr></thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id} style={{ cursor: 'default' }}>
                <td>{fmtDateTime(a.createdAt)}</td>
                <td><b>{label(a.action)}</b></td>
                <td>{a.listingTitle || a.targetEmail || a.listingId || '—'}</td>
                <td>{a.reason || '—'}</td>
                <td>{a.actorEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="adm-empty">No admin actions recorded yet.</p>}
        {loading && <p className="adm-empty">Loading…</p>}
      </div>
      {hasMore && !loading && <p style={{ textAlign: 'center' }}><button type="button" className="adm-btn" onClick={() => load(false)}>Load more</button></p>}
    </>
  )
}

// ───────────── site settings (applies to the public site) ─────────────
function SettingsView({ notify }) {
  const [s, setS] = useState(null)
  const [busy, run] = useBusy()

  useEffect(() => { getSiteSettings(true).then(setS) }, [])

  if (!s) return <p className="adm-empty">Loading settings…</p>

  const set = patch => setS(current => ({ ...current, ...patch }))

  async function save() {
    try {
      await run(() => saveSiteSettings({
        announcementEnabled: !!s.announcementEnabled,
        announcementText: (s.announcementText || '').slice(0, 240),
        announcementTone: s.announcementTone || 'info',
        autoApproveServices: !!s.autoApproveServices,
      }))
      await getSiteSettings(true)
      notify('Settings saved — live on the public site')
    } catch (e) {
      notify(errText(e), true)
    }
  }

  return (
    <div className="adm-grid" style={{ maxWidth: 680 }}>
      <div className="adm-card">
        <h3>Moderation</h3>
        <label className="adm-switch">
          <input type="checkbox" checked={!!s.autoApproveServices} onChange={e => set({ autoApproveServices: e.target.checked })} />
          <span><b>Auto-approve new services</b><small>Off: every new or edited service waits in the review queue. On: services go live immediately (you can still suspend them).</small></span>
        </label>
      </div>

      <div className="adm-card">
        <h3>Site-wide announcement banner</h3>
        <label className="adm-switch">
          <input type="checkbox" checked={!!s.announcementEnabled} onChange={e => set({ announcementEnabled: e.target.checked })} />
          <span><b>Show banner on every page</b></span>
        </label>
        <div className="adm-grid" style={{ marginTop: 10 }}>
          <label className="adm-field">
            <span>Message (max 240 characters)</span>
            <textarea value={s.announcementText || ''} maxLength={240} onChange={e => set({ announcementText: e.target.value })} />
          </label>
          <label className="adm-field">
            <span>Style</span>
            <select value={s.announcementTone || 'info'} onChange={e => set({ announcementTone: e.target.value })}>
              <option value="info">Info (blue)</option>
              <option value="success">Success (green)</option>
              <option value="warning">Warning (amber)</option>
              <option value="danger">Alert (red)</option>
            </select>
          </label>
        </div>
      </div>

      <div><button type="button" className="adm-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button></div>
    </div>
  )
}

// ───────────── customize (per-admin, saved to Firestore) ─────────────
function CustomizeView({ prefs, updatePrefs }) {
  const widgetLabels = {
    stats: 'Key statistics',
    signups: 'New-user chart',
    categories: 'Listings by category',
    queue: 'Review queue',
    activity: 'Recent admin activity',
  }

  return (
    <div className="adm-grid" style={{ maxWidth: 680 }}>
      <div className="adm-card">
        <h3>Appearance</h3>
        <div className="adm-grid">
          <div className="adm-field">
            <span>Accent colour</span>
            <div className="adm-swatches">
              {ACCENTS.map(c => (
                <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={prefs.accent === c} style={{ background: c }} onClick={() => updatePrefs({ accent: c })} />
              ))}
              <input type="color" value={prefs.accent} onChange={e => updatePrefs({ accent: e.target.value })} aria-label="Custom colour" />
            </div>
          </div>
          <label className="adm-field">
            <span>Theme</span>
            <select value={prefs.theme} onChange={e => updatePrefs({ theme: e.target.value })}>
              <option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <label className="adm-field">
            <span>Density</span>
            <select value={prefs.density} onChange={e => updatePrefs({ density: e.target.value })}>
              <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
            </select>
          </label>
        </div>
      </div>

      <div className="adm-card">
        <h3>Workspace</h3>
        <div className="adm-grid">
          <label className="adm-field">
            <span>Open this page first</span>
            <select value={prefs.defaultTab} onChange={e => updatePrefs({ defaultTab: e.target.value })}>
              {NAV.filter(n => n.id !== 'customize').map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>Rows per page</span>
            <select value={prefs.pageSize} onChange={e => updatePrefs({ pageSize: Number(e.target.value) })}>
              {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="adm-card">
        <h3>Overview widgets</h3>
        {Object.entries(widgetLabels).map(([key, text]) => (
          <label className="adm-switch" key={key}>
            <input type="checkbox" checked={!!prefs.widgets[key]} onChange={e => updatePrefs({ widgets: { ...prefs.widgets, [key]: e.target.checked } })} />
            <span><b>{text}</b></span>
          </label>
        ))}
      </div>
      <small style={{ color: 'var(--muted)' }}>Your preferences are saved to your admin account and follow you across devices.</small>
    </div>
  )
}