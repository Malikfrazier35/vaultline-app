import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useToast } from '@/components/Toast'
import {
  Users, UserPlus, Mail, Shield, Crown, Eye, Clock, Loader2, X, Activity,
  ShieldCheck, Key, CheckCircle2, AlertTriangle, Pause, Play, ArrowRightLeft,
  RefreshCw, MoreVertical, Copy, Check, UserMinus
} from 'lucide-react'

const ROLE_CONFIG = {
  owner: { icon: Crown, color: 'text-amber', bg: 'bg-amber/[0.08]', label: 'Owner', border: 'border-amber/[0.1]' },
  admin: { icon: Shield, color: 'text-cyan', bg: 'bg-cyan/[0.08]', label: 'Admin', border: 'border-cyan/[0.1]' },
  member: { icon: Users, color: 'text-purple', bg: 'bg-purple/[0.08]', label: 'Member', border: 'border-purple/[0.1]' },
  viewer: { icon: Eye, color: 'text-t3', bg: 'bg-[rgba(148,163,184,0.06)]', label: 'Viewer', border: 'border-border' },
}

const STATUS_CONFIG = {
  active: { color: 'text-green', bg: 'bg-green/[0.06]', border: 'border-green/[0.1]', label: 'ACTIVE' },
  suspended: { color: 'text-amber', bg: 'bg-amber/[0.06]', border: 'border-amber/[0.1]', label: 'SUSPENDED' },
  deactivated: { color: 'text-red', bg: 'bg-red/[0.06]', border: 'border-red/[0.1]', label: 'DEACTIVATED' },
}

const PERMISSIONS = [
  { label: 'View dashboard & data', owner: true, admin: true, member: true, viewer: true },
  { label: 'Run & export reports', owner: true, admin: true, member: true, viewer: false },
  { label: 'Manage bank connections', owner: true, admin: true, member: false, viewer: false },
  { label: 'Invite & manage team', owner: true, admin: true, member: false, viewer: false },
  { label: 'Promote to admin', owner: true, admin: false, member: false, viewer: false },
  { label: 'Suspend / reactivate', owner: true, admin: true, member: false, viewer: false },
  { label: 'API access', owner: true, admin: true, member: false, viewer: false },
  { label: 'Billing & subscription', owner: true, admin: false, member: false, viewer: false },
  { label: 'Transfer ownership', owner: true, admin: false, member: false, viewer: false },
]

export default function Team() {
  const { user, profile, org, isAdmin } = useAuth()
  const { refetch } = useTreasury()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [showInvite, setShowInvite] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [bulkEmails, setBulkEmails] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()
  const [showPerms, setShowPerms] = useState(false)
  const [activeMenu, setActiveMenu] = useState(null)
  const [confirmTransfer, setConfirmTransfer] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { document.title = 'Team \u2014 Vaultline' }, [])
  useEffect(() => { let stale = false; if (!stale) load(); return () => { stale = true } }, [])

  function showToast(msg, type = 'info') { type === 'success' ? toast.success(msg) : type === 'error' ? toast.error(msg) : toast.info(msg) }

  async function load() {
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('org_id', org?.id).order('created_at'),
        supabase.from('invites').select('*').eq('org_id', org?.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).catch(() => ({ data: [] })),
      ])
      setMembers(mRes.data || [])
      setInvites(iRes?.data || [])
    } catch (err) {
      console.error('Team load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function teamAction(action, body = {}) {
    setError(null)
    setActionLoading(body.profile_id || body.invite_id || action)
    try {
      const { data, error: fnErr } = await safeInvoke('team-manage', { action, ...body })
      if (fnErr) throw new Error(typeof fnErr === 'string' ? fnErr : fnErr.message || 'Action failed')
      if (data?.error) throw new Error(data.error)
      load()
      return data
    } catch (err) {
      setError(err.message)
      showToast(err.message, 'error')
      return null
    } finally {
      setActionLoading(null)
    }
  }

  async function invite() {
    if (!inviteEmail.trim()) return
    const result = await teamAction('invite', { email: inviteEmail.trim().toLowerCase(), role: inviteRole })
    if (result?.success) { setInviteEmail(''); showToast('Invite sent', 'success') }
  }

  async function bulkInvite() {
    const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'))
    if (emails.length === 0) return
    const result = await teamAction('bulk_invite', { emails, role: inviteRole })
    if (result?.success) {
      const succeeded = result.results.filter(r => r.success).length
      const failed = result.results.filter(r => r.error).length
      setBulkEmails('')
      showToast(`${succeeded} invited, ${failed} skipped`, succeeded > 0 ? 'success' : 'error')
    }
  }

  async function transferOwnership(profileId) {
    if (!confirm('Transfer ownership? You will be demoted to Admin. This cannot be undone.')) return
    const result = await teamAction('transfer_ownership', { profile_id: profileId })
    if (result?.success) { showToast('Ownership transferred', 'success'); setConfirmTransfer(null) }
  }

  const initials = (name) => (name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const maxSeats = org?.max_team_members || 25
  const activeMembers = members.filter(m => m.status !== 'deactivated')
  const seatUsage = activeMembers.length
  const seatPct = Math.min(100, (seatUsage / maxSeats) * 100)
  const roleCounts = { owner: 0, admin: 0, member: 0, viewer: 0 }
  members.forEach(m => { if (roleCounts[m.role] !== undefined) roleCounts[m.role]++ })
  const suspendedCount = members.filter(m => m.status === 'suspended').length
  const mfaCount = members.filter(m => m.mfa_enabled).length
  const isOwner = profile?.role === 'owner'

  const filteredMembers = filter === 'all' ? members
    : filter === 'suspended' ? members.filter(m => m.status === 'suspended')
    : members.filter(m => m.role === filter)

  if (loading) return <SkeletonPage />

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">TEAM MANAGEMENT</span>
          <span className="text-[12px] font-mono text-t3">{org?.name}</span>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold glow-sm hover:-translate-y-px active:scale-[0.98] transition-all">
            <UserPlus size={15} /> Invite
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Users, label: 'SEATS', value: `${seatUsage}/${maxSeats}`, color: 'cyan' },
          { icon: ShieldCheck, label: 'MFA', value: `${mfaCount}/${seatUsage}`, color: mfaCount === seatUsage ? 'green' : 'amber' },
          { icon: Pause, label: 'SUSPENDED', value: suspendedCount.toString(), color: suspendedCount > 0 ? 'amber' : 'green' },
          { icon: Mail, label: 'PENDING', value: invites.length.toString(), color: invites.length > 0 ? 'amber' : 'green' },
          { icon: Activity, label: 'ROLES', value: `${roleCounts.admin}A ${roleCounts.member}M ${roleCounts.viewer}V`, color: 'purple' },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber', purple: 'bg-purple/[0.08] text-purple' }
          return (
            <div key={k.label} className="glass-card rounded-xl p-3.5 terminal-scanlines relative">
              <div className="relative z-[2]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cm[k.color]}`}><k.icon size={12} /></div>
                  <span className="text-[8px] font-mono text-t3 uppercase tracking-wider">{k.label}</span>
                </div>
                <p className="font-mono text-[16px] font-black text-t1 terminal-data">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Seat bar */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-t3">SEAT USAGE</span>
          <span className="text-[11px] font-mono text-t2 terminal-data">{seatUsage} / {maxSeats} ({seatPct.toFixed(0)}%)</span>
        </div>
        <div className="h-[6px] bg-deep rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${seatPct > 90 ? 'bg-red' : seatPct > 70 ? 'bg-amber' : 'bg-cyan'}`} style={{ width: `${seatPct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2">
          {Object.entries(roleCounts).filter(([, c]) => c > 0).map(([role, count]) => {
            const rc = ROLE_CONFIG[role]
            return <span key={role} className="flex items-center gap-1.5 text-[10px] font-mono text-t3"><rc.icon size={9} className={rc.color} /> {count} {rc.label}</span>
          })}
          {suspendedCount > 0 && <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber"><Pause size={9} /> {suspendedCount} Suspended</span>}
        </div>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="glass-card rounded-2xl p-5 border-cyan/[0.15]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail size={15} className="text-cyan" />
              <span className="terminal-label">INVITE</span>
            </div>
            <button onClick={() => setBulkMode(!bulkMode)} className="text-[11px] font-mono text-t3 hover:text-cyan transition px-2 py-1 rounded border border-border hover:border-cyan/[0.15]">
              {bulkMode ? 'SINGLE' : 'BULK'}
            </button>
          </div>
          {error && <p className="text-[13px] text-red mb-3 bg-red/[0.06] px-3 py-2 rounded-lg font-mono">{error}</p>}
          {bulkMode ? (
            <div className="space-y-3">
              <textarea value={bulkEmails} onChange={e => setBulkEmails(e.target.value)} rows={4}
                placeholder="one@company.com&#10;two@company.com&#10;three@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl glass-input text-[13px] font-mono text-t1 outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 placeholder:text-t3 resize-none" />
              <div className="flex gap-2">
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-3 py-2.5 rounded-xl glass-input text-[13px] font-mono text-t2 outline-none cursor-pointer">
                  <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
                </select>
                <button onClick={bulkInvite} disabled={actionLoading === 'bulk_invite' || !bulkEmails.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-cyan text-void text-[13px] font-mono font-semibold disabled:opacity-50 transition hover:-translate-y-px active:scale-[0.98] flex items-center justify-center gap-1.5">
                  {actionLoading === 'bulk_invite' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} SEND {bulkEmails.split(/[\n,;]+/).filter(e => e.trim().includes('@')).length} INVITES
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                onKeyDown={e => e.key === 'Enter' && invite()}
                className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] font-mono text-t1 outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 placeholder:text-t3" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-3 py-2.5 rounded-xl glass-input text-[13px] font-mono text-t2 outline-none cursor-pointer">
                <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option>
              </select>
              <button onClick={invite} disabled={actionLoading === 'invite' || !inviteEmail.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan text-void text-[13px] font-mono font-semibold disabled:opacity-50 transition hover:-translate-y-px active:scale-[0.98] flex items-center gap-1.5">
                {actionLoading === 'invite' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} SEND
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {['all', 'admin', 'member', 'viewer', 'suspended'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-all ${filter === f ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'}`}>
            {f.toUpperCase()} {f === 'all' ? `(${members.length})` : f === 'suspended' ? `(${suspendedCount})` : `(${members.filter(m => m.role === f).length})`}
          </button>
        ))}
      </div>

      {/* Members list */}
      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
        <div className="relative z-[2]">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between">
            <span className="terminal-label">MEMBERS</span>
            <span className="text-[11px] font-mono text-t3">{filteredMembers.length} shown</span>
          </div>
          <div className="divide-y divide-border/20">
            {filteredMembers.map(m => {
              const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.member
              const sc = STATUS_CONFIG[m.status || 'active'] || STATUS_CONFIG.active
              const isMe = m.id === user?.id
              const isMemberOwner = m.role === 'owner'
              const isSuspended = m.status === 'suspended'
              const daysSince = Math.floor((Date.now() - new Date(m.created_at).getTime()) / 86400000)
              const lastActive = m.last_active ? new Date(m.last_active) : null
              const activeDaysAgo = lastActive ? Math.floor((Date.now() - lastActive.getTime()) / 86400000) : null
              return (
                <div key={m.id} className={`flex items-center justify-between px-6 py-4 transition group ${isSuspended ? 'opacity-60' : 'hover:bg-deep active:bg-deep'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] relative ${isSuspended ? 'grayscale' : ''}`}
                      style={{ background: isSuspended ? '#64748B' : `linear-gradient(135deg, ${rc.color === 'text-amber' ? '#FBBF24' : rc.color === 'text-cyan' ? '#22D3EE' : rc.color === 'text-purple' ? '#818CF8' : '#64748B'}, ${rc.color === 'text-amber' ? '#D97706' : rc.color === 'text-cyan' ? '#0891B2' : rc.color === 'text-purple' ? '#6366F1' : '#475569'})` }}>
                      {initials(m.full_name)}
                      {isMe && !isSuspended && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green border-2 border-card" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold">{m.full_name || 'Unnamed'}</p>
                        {isMe && <span className="text-[9px] font-mono font-bold text-cyan bg-cyan/[0.06] border border-cyan/[0.1] px-1.5 py-0.5 rounded">YOU</span>}
                        {daysSince < 7 && <span className="text-[9px] font-mono font-bold text-green bg-green/[0.06] border border-green/[0.1] px-1.5 py-0.5 rounded">NEW</span>}
                        {isSuspended && <span className={`text-[9px] font-mono font-bold ${sc.color} ${sc.bg} border ${sc.border} px-1.5 py-0.5 rounded`}>{sc.label}</span>}
                      </div>
                      <p className="text-[12px] text-t3 font-mono mt-0.5">{m.email}</p>
                      {m.title && <p className="text-[11px] text-t3">{m.title}{m.department ? ` / ${m.department}` : ''}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Last active */}
                    <span className="text-[10px] text-t3 font-mono hidden lg:block" title={lastActive?.toLocaleString()}>
                      {activeDaysAgo === 0 ? 'Today' : activeDaysAgo === 1 ? '1d ago' : activeDaysAgo !== null ? `${activeDaysAgo}d ago` : '--'}
                    </span>
                    {/* MFA */}
                    <div title={m.mfa_enabled ? 'MFA enabled' : 'MFA not set up'}>
                      {m.mfa_enabled ? <CheckCircle2 size={12} className="text-green" /> : <AlertTriangle size={12} className="text-amber/40" />}
                    </div>
                    {/* Role badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${rc.bg} ${rc.color} border ${rc.border}`}>
                      <rc.icon size={10} /> {rc.label.toUpperCase()}
                    </span>
                    {/* Action menu */}
                    {isAdmin && !isMe && !isMemberOwner && (
                      <div className="relative">
                        <button onClick={() => setActiveMenu(activeMenu === m.id ? null : m.id)}
                          className="p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t1 transition opacity-0 group-hover:opacity-100">
                          <MoreVertical size={14} />
                        </button>
                        {activeMenu === m.id && (
                          <div className="absolute right-0 top-8 z-50 glass-card rounded-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-w-[180px] border-border" onClick={() => setActiveMenu(null)}>
                            {/* Role change */}
                            {['admin', 'member', 'viewer'].filter(r => r !== m.role).map(r => {
                              const RIcon = ROLE_CONFIG[r].icon
                              return (
                              <button key={r} onClick={() => teamAction('update_role', { profile_id: m.id, role: r })}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-mono text-t2 hover:bg-deep hover:text-t1 transition text-left">
                                <RIcon size={12} className={ROLE_CONFIG[r].color} /> Set {ROLE_CONFIG[r].label}
                              </button>
                              )
                            })}
                            <div className="h-px bg-border/30 my-1" />
                            {/* Suspend / Reactivate */}
                            {isSuspended ? (
                              <button onClick={() => teamAction('reactivate_member', { profile_id: m.id }).then(r => r?.success && showToast('Member reactivated', 'success'))}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-mono text-green hover:bg-green/[0.06] transition text-left">
                                <Play size={12} /> Reactivate
                              </button>
                            ) : (
                              <button onClick={() => teamAction('suspend_member', { profile_id: m.id }).then(r => r?.success && showToast('Member suspended', 'success'))}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-mono text-amber hover:bg-amber/[0.06] transition text-left">
                                <Pause size={12} /> Suspend
                              </button>
                            )}
                            {/* Transfer ownership */}
                            {isOwner && !isSuspended && (
                              <button onClick={() => transferOwnership(m.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-mono text-purple hover:bg-purple/[0.06] transition text-left">
                                <ArrowRightLeft size={12} /> Transfer Ownership
                              </button>
                            )}
                            <div className="h-px bg-border/30 my-1" />
                            {/* Remove */}
                            <button onClick={() => { if (confirm(`Remove ${m.full_name}? They will lose all access.`)) teamAction('remove_member', { profile_id: m.id }).then(r => r?.success && showToast('Member removed', 'success')) }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-mono text-red hover:bg-red/[0.06] transition text-left">
                              <UserMinus size={12} /> Remove Member
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="terminal-status flex items-center justify-between px-6 py-1.5">
            <span className="text-t3">SEATS: <span className="text-t2">{seatUsage}/{maxSeats}</span></span>
            <span className="text-t3">MFA: <span className={mfaCount === seatUsage ? 'text-green' : 'text-amber'}>{mfaCount}/{seatUsage}</span></span>
          </div>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
          <div className="relative z-[2]">
            <div className="px-6 py-3 border-b border-border flex items-center gap-2">
              <Clock size={13} className="text-amber" />
              <span className="terminal-label">PENDING INVITES</span>
              <span className="text-[10px] font-mono text-amber bg-amber/[0.06] px-2 py-0.5 rounded border border-amber/[0.1]">{invites.length}</span>
            </div>
            <div className="divide-y divide-border/20">
              {invites.map(inv => {
                const expired = new Date(inv.expires_at) < new Date()
                return (
                  <div key={inv.id} className={`flex items-center justify-between px-6 py-3.5 ${expired ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber/[0.06] border border-amber/[0.1] flex items-center justify-center">
                        <Mail size={14} className="text-amber" />
                      </div>
                      <div>
                        <p className="text-[13px] font-mono font-medium">{inv.email}</p>
                        <p className="text-[10px] text-t3 font-mono">
                          {expired ? 'EXPIRED' : `Expires ${new Date(inv.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`} / {inv.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expired && (
                        <button onClick={() => teamAction('resend_invite', { invite_id: inv.id }).then(r => r?.success && showToast('Invite resent', 'success'))}
                          disabled={actionLoading === inv.id}
                          className="px-3 py-1.5 rounded-lg border border-cyan/[0.15] text-[11px] font-mono font-semibold text-cyan hover:bg-cyan/[0.06] transition disabled:opacity-50">
                          {actionLoading === inv.id ? <Loader2 size={11} className="animate-spin" /> : 'RESEND'}
                        </button>
                      )}
                      <button onClick={() => teamAction('revoke', { invite_id: inv.id }).then(r => r?.success && showToast('Invite revoked', 'success'))}
                        disabled={actionLoading === inv.id}
                        className="px-3 py-1.5 rounded-lg border border-border text-[11px] font-mono font-semibold text-t3 hover:text-red hover:border-red transition disabled:opacity-50">
                        REVOKE
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button onClick={() => setShowPerms(!showPerms)} className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-deep active:bg-deep transition">
          <div className="flex items-center gap-2"><Key size={13} className="text-cyan" /><span className="terminal-label">PERMISSION MATRIX</span></div>
          <span className={`text-[11px] font-mono text-t3 transition-transform ${showPerms ? 'rotate-180' : ''}`}>{'\u25BC'}</span>
        </button>
        {showPerms && (
          <div className="px-6 pb-5 border-t border-border pt-4">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-mono text-t3 uppercase tracking-wider py-2 pr-4">Permission</th>
                  {['owner', 'admin', 'member', 'viewer'].map(r => {
                    const RIcon = ROLE_CONFIG[r].icon
                    return (
                    <th key={r} className="text-center py-2 px-3"><span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold ${ROLE_CONFIG[r].color}`}><RIcon size={9} /> {ROLE_CONFIG[r].label.toUpperCase()}</span></th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(p => (
                  <tr key={p.label} className="border-b border-border/30">
                    <td className="text-[11px] text-t2 font-mono py-2 pr-4">{p.label}</td>
                    {['owner', 'admin', 'member', 'viewer'].map(r => (
                      <td key={r} className="text-center py-2 px-3">{p[r] ? <Check size={13} className="text-green mx-auto" /> : <X size={13} className="text-border mx-auto" />}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {activeMenu && <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />}
    </div>
  )
}
