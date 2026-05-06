import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Eye, UserPlus, AlertTriangle, ArrowUpRight, X, Loader2, Crown, Shield, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'

/**
 * TEAM SETTINGS — /settings/team
 * 
 * Shows current seat usage vs plan limits with clear upgrade nudges.
 * Invite flow respects can_add_seat() function — blocks at cap, warns at overage.
 */

const ROLE_META = {
  owner: { label: 'Owner', icon: Crown, color: 'text-amber-600', desc: 'Full access including billing' },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-600', desc: 'Manage team and connections' },
  member: { label: 'Member', icon: User, color: 'text-t2', desc: 'Use treasury features' },
  viewer: { label: 'Read-only', icon: Eye, color: 'text-purple-600', desc: 'View dashboards and reports only' },
}

export default function Team() {
  const { org, profile, isAdmin } = useAuth()
  const toast = useToast()
  
  const [seatCounts, setSeatCounts] = useState(null)
  const [planLimits, setPlanLimits] = useState(null)
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [seatCheckResult, setSeatCheckResult] = useState(null)

  useEffect(() => { document.title = 'Team — Vaultline' }, [])

  useEffect(() => {
    if (!org?.id) return
    let mounted = true
    
    async function load() {
      try {
        const [seats, limits, mems, invs] = await Promise.all([
          supabase.from('org_seat_counts').select('*').eq('org_id', org.id).maybeSingle(),
          supabase.from('plan_seat_limits').select('*').eq('plan', org.plan || 'starter').maybeSingle(),
          supabase.from('profiles').select('id, full_name, email, role, status, last_active, created_at').eq('org_id', org.id).order('created_at', { ascending: true }),
          supabase.from('invitations').select('id, email, role, created_at, expires_at, status').eq('org_id', org.id).eq('status', 'pending').order('created_at', { ascending: false }),
        ])
        
        if (!mounted) return
        setSeatCounts(seats.data)
        setPlanLimits(limits.data)
        setMembers(mems.data || [])
        setPendingInvites(invs.data || [])
        setLoading(false)
      } catch (e) {
        console.error('Team load error:', e)
        setLoading(false)
      }
    }
    load()
  }, [org?.id, org?.plan])

  // Check seat availability when role changes in the invite form
  useEffect(() => {
    if (!showInvite || !org?.id) { setSeatCheckResult(null); return }
    let mounted = true
    
    supabase.rpc('can_add_seat', { p_org_id: org.id, p_role: inviteRole })
      .then(({ data, error }) => {
        if (mounted && !error) setSeatCheckResult(data)
      })
    
    return () => { mounted = false }
  }, [inviteRole, showInvite, org?.id, members.length])

  async function submitInvite(e) {
    e.preventDefault()
    if (!inviteEmail || !seatCheckResult?.allowed) return
    
    setInviteSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, role: inviteRole, org_id: org.id }
      })
      if (error) throw error
      
      toast.success('Invitation sent', `${inviteEmail} will receive an email shortly.`)
      setInviteEmail('')
      setShowInvite(false)
      // refresh
      const { data } = await supabase.from('invitations').select('*').eq('org_id', org.id).eq('status', 'pending').order('created_at', { ascending: false })
      setPendingInvites(data || [])
    } catch (err) {
      toast.error('Could not send invitation', err.message)
    } finally {
      setInviteSubmitting(false)
    }
  }
  
  async function revokeInvite(inviteId) {
    if (!confirm('Revoke this invitation?')) return
    const { error } = await supabase.from('invitations').update({ status: 'revoked' }).eq('id', inviteId)
    if (error) return toast.error('Could not revoke', error.message)
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    toast.success('Invitation revoked')
  }

  async function changeRole(memberId, newRole) {
    if (memberId === profile.id) return toast.error("You can't change your own role")
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    if (error) return toast.error('Could not change role', error.message)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    toast.success('Role updated')
  }

  async function removeMember(memberId) {
    if (memberId === profile.id) return toast.error("You can't remove yourself")
    if (!confirm('Remove this member? They will lose access immediately.')) return
    const { error } = await supabase.from('profiles').update({ status: 'deactivated' }).eq('id', memberId)
    if (error) return toast.error('Could not remove', error.message)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    toast.success('Member removed')
  }

  if (loading) return <div className="p-12 text-t2">Loading…</div>
  if (!seatCounts || !planLimits) return <div className="p-12 text-t2">Setting up team data…</div>

  const fullUsed = seatCounts.active_full_seats || 0
  const fullIncluded = planLimits.included_full_seats
  const fullCap = planLimits.max_full_seats
  const fullOverage = Math.max(0, fullUsed - fullIncluded)
  const fullPctOfCap = fullCap ? (fullUsed / fullCap) * 100 : 0
  
  const roUsed = seatCounts.active_readonly_seats || 0
  const roIncluded = planLimits.included_readonly_seats >= 999 ? null : planLimits.included_readonly_seats
  
  const monthlyOverageCost = fullOverage * (planLimits.overage_full_seat_cents / 100)
  
  const planName = org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Starter'

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-[28px] font-display text-t1 mb-1">Team</h1>
        <p className="text-[14px] text-t2">
          Manage members, roles, and seat usage on your <strong>{planName}</strong> plan.
        </p>
      </header>

      {/* ─── SEAT USAGE CARDS ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full seats */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-t2" />
              <span className="text-[13px] font-semibold text-t1">Full seats</span>
            </div>
            {fullCap && fullPctOfCap > 80 && (
              <span className="text-[11px] uppercase tracking-wider font-medium text-amber-600">
                {fullPctOfCap > 95 ? 'Cap nearly reached' : 'Approaching cap'}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[32px] font-display text-t1 font-semibold">{fullUsed}</span>
            <span className="text-[14px] text-t2">
              of {fullCap ? `${fullCap} max` : 'unlimited'} 
              {fullIncluded !== fullUsed && ` · ${fullIncluded} included`}
            </span>
          </div>
          {fullCap && (
            <div className="w-full h-1.5 rounded-full bg-deep mb-3">
              <div 
                className={`h-full rounded-full ${fullPctOfCap > 95 ? 'bg-red-500' : fullPctOfCap > 80 ? 'bg-amber-500' : 'bg-cyan'}`}
                style={{ width: `${Math.min(100, fullPctOfCap)}%` }}
              />
            </div>
          )}
          {fullOverage > 0 && (
            <p className="text-[12px] text-t2 leading-relaxed">
              <strong className="text-t1">{fullOverage}</strong> over your included {fullIncluded} ·{' '}
              <strong className="text-t1">+${monthlyOverageCost}/mo</strong> on your next invoice
            </p>
          )}
          {fullCap && fullUsed >= fullCap && (
            <Link to="/billing" className="inline-flex items-center gap-1 text-[13px] text-cyan font-medium hover:underline mt-2">
              Upgrade to add more seats <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        {/* Read-only seats */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-t2" />
              <span className="text-[13px] font-semibold text-t1">Read-only seats</span>
            </div>
            {org.plan === 'starter' && (
              <span className="text-[11px] uppercase tracking-wider font-medium text-t3">Not available</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[32px] font-display text-t1 font-semibold">{roUsed}</span>
            <span className="text-[14px] text-t2">
              {org.plan === 'starter' 
                ? '· upgrade to Growth for read-only seats'
                : roIncluded === null 
                  ? '· unlimited (free)'
                  : `of ${roIncluded} included · then unlimited free`
              }
            </span>
          </div>
          {org.plan === 'starter' ? (
            <Link to="/billing" className="inline-flex items-center gap-1 text-[13px] text-cyan font-medium hover:underline">
              Upgrade to Growth <ArrowUpRight size={13} />
            </Link>
          ) : (
            <p className="text-[12px] text-t2 leading-relaxed">
              Invite CFOs, board members, and auditors at no extra cost.
            </p>
          )}
        </div>
      </section>

      {/* ─── MEMBERS LIST ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-display text-t1">Members</h2>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan text-white text-[13px] font-medium hover:opacity-90"
            >
              <UserPlus size={14} /> Invite member
            </button>
          )}
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-t3 bg-deep/40">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Last active</th>
                {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const meta = ROLE_META[m.role] || ROLE_META.member
                const Icon = meta.icon
                const isMe = m.id === profile.id
                return (
                  <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-deep/40">
                    <td className="px-4 py-3 text-[13px] text-t1 font-medium">
                      {m.full_name || '—'} {isMe && <span className="text-t3 text-[12px]">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-t2">{m.email}</td>
                    <td className="px-4 py-3">
                      {isAdmin && !isMe && m.role !== 'owner' ? (
                        <select 
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          className="text-[13px] bg-canvas border border-border rounded px-2 py-1"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Read-only</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px]">
                          <Icon size={12} className={meta.color} />
                          <span className="text-t1">{meta.label}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-t2">
                      {m.last_active ? new Date(m.last_active).toLocaleDateString() : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!isMe && m.role !== 'owner' && (
                          <button
                            onClick={() => removeMember(m.id)}
                            className="text-[12px] text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── PENDING INVITES ─── */}
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="text-[16px] font-display text-t1 mb-4">Pending invitations</h2>
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-t3 bg-deep/40">
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Sent</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map(inv => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-[13px] text-t1">{inv.email}</td>
                    <td className="px-4 py-3 text-[13px] text-t2 capitalize">{inv.role}</td>
                    <td className="px-4 py-3 text-[13px] text-t2">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-[13px] text-t2">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => revokeInvite(inv.id)} className="text-[12px] text-red-600 hover:underline">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── INVITE MODAL ─── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-display text-t1">Invite a member</h3>
              <button onClick={() => setShowInvite(false)} className="text-t2 hover:text-t1">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={submitInvite} className="space-y-4">
              <div>
                <label className="text-[12px] uppercase tracking-wider text-t3 font-medium mb-1.5 block">Email</label>
                <input 
                  type="email" 
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-canvas border border-border text-[14px]"
                />
              </div>
              
              <div>
                <label className="text-[12px] uppercase tracking-wider text-t3 font-medium mb-1.5 block">Role</label>
                <div className="space-y-2">
                  {Object.entries(ROLE_META)
                    .filter(([key]) => key !== 'owner')
                    .filter(([key]) => !(key === 'viewer' && org.plan === 'starter'))
                    .map(([key, meta]) => {
                      const Icon = meta.icon
                      return (
                        <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          inviteRole === key ? 'border-cyan bg-cyan/[0.04]' : 'border-border hover:border-border-hover'
                        }`}>
                          <input 
                            type="radio"
                            name="role"
                            value={key}
                            checked={inviteRole === key}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-t1">
                              <Icon size={13} className={meta.color} />
                              {meta.label}
                              {key === 'viewer' && org.plan !== 'starter' && (
                                <span className="text-[11px] text-cyan font-normal ml-1">free</span>
                              )}
                            </div>
                            <p className="text-[12px] text-t2 mt-0.5">{meta.desc}</p>
                          </div>
                        </label>
                      )
                    })
                  }
                </div>
              </div>
              
              {/* Seat-check feedback */}
              {seatCheckResult && (
                <>
                  {!seatCheckResult.allowed && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-[13px] text-red-900">
                        <strong>Seat cap reached.</strong> You're at {seatCheckResult.current} of {seatCheckResult.max} seats on {planName}.{' '}
                        <Link to="/billing" className="underline">Upgrade your plan</Link> to invite more.
                      </div>
                    </div>
                  )}
                  {seatCheckResult.allowed && seatCheckResult.is_overage && inviteRole !== 'viewer' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-[13px] text-amber-900">
                        <strong>This will be a paid seat.</strong> You'll be charged ${planLimits.overage_full_seat_cents / 100}/mo extra (prorated).
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 rounded-lg text-[13px] text-t2 hover:text-t1"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={inviteSubmitting || !inviteEmail || !seatCheckResult?.allowed}
                  className="px-4 py-2 rounded-lg bg-cyan text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {inviteSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  ) : (
                    <>Send invitation</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
