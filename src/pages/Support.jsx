import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { SkeletonPage } from '@/components/Skeleton'
import {
  MessageSquare, Plus, ArrowLeft, Send, Clock, AlertTriangle,
  CheckCircle2, Tag, ChevronRight, Loader2, Star, Inbox,
  LifeBuoy, Zap, Bug, CreditCard, Shield, BookOpen
} from 'lucide-react'

const STATUS_BADGE = {
  open: { bg: 'bg-cyan/[0.06]', text: 'text-cyan', label: 'Open', icon: Inbox },
  in_progress: { bg: 'bg-purple/[0.06]', text: 'text-purple', label: 'In Progress', icon: Zap },
  waiting_customer: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'Waiting on You', icon: Clock },
  waiting_internal: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'Under Review', icon: Clock },
  resolved: { bg: 'bg-green/[0.06]', text: 'text-green', label: 'Resolved', icon: CheckCircle2 },
  closed: { bg: 'bg-t3/[0.06]', text: 'text-t3', label: 'Closed', icon: CheckCircle2 },
}
const PRIORITY_BADGE = {
  critical: { bg: 'bg-red/[0.06]', text: 'text-red', dot: 'bg-red' },
  high: { bg: 'bg-amber/[0.06]', text: 'text-amber', dot: 'bg-amber' },
  medium: { bg: 'bg-cyan/[0.06]', text: 'text-cyan', dot: 'bg-cyan' },
  low: { bg: 'bg-t3/[0.06]', text: 'text-t3', dot: 'bg-t3' },
}
const CATEGORIES = [
  { value: 'general', label: 'General' }, { value: 'billing', label: 'Billing' },
  { value: 'integration', label: 'Integration' }, { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' }, { value: 'data_issue', label: 'Data Issue' },
  { value: 'security', label: 'Security' }, { value: 'onboarding', label: 'Onboarding' },
  { value: 'account', label: 'Account' },
]

export default function Support() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [view, setView] = useState('list')
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('medium')
  const [submitting, setSubmitting] = useState(false)
  const [draftStatus, setDraftStatus] = useState(null)
  const draftTimer = useRef(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const [csatScore, setCsatScore] = useState(0)

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!subject && !body) return
    if (draftTimer.current) clearTimeout(draftTimer.current)
    setDraftStatus('saving')
    draftTimer.current = setTimeout(() => {
      localStorage.setItem('vaultline-ticket-draft', JSON.stringify({ subject, body, category, priority }))
      setDraftStatus('saved')
      setTimeout(() => setDraftStatus(null), 3000)
    }, 1500)
  }, [subject, body, category, priority])

  // Restore draft on mount
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem('vaultline-ticket-draft'))
      if (draft?.subject || draft?.body) {
        setSubject(draft.subject || ''); setBody(draft.body || '')
        setCategory(draft.category || 'general'); setPriority(draft.priority || 'medium')
      }
    } catch {}
  }, [])

  function clearDraft() {
    localStorage.removeItem('vaultline-ticket-draft')
    setSubject(''); setBody(''); setCategory('general'); setPriority('medium'); setDraftStatus(null)
  }

  // Fetch tickets directly from Supabase
  const fetchTickets = useCallback(async () => {
    if (!org?.id) { setLoading(false); return }
    setLoading(true)
    let query = supabase.from('support_tickets').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setTickets(data || [])
    setLoading(false)
  }, [org?.id, filter])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  async function openTicket(ticket) {
    setSelectedTicket(ticket)
    setView('detail')
    const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true })
    setMessages(data || [])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!subject.trim() || !body.trim() || !org?.id) return
    setSubmitting(true)
    try {
      const { data: ticket, error } = await supabase.from('support_tickets').insert({
        org_id: org.id, created_by: profile?.id, subject: subject.trim(), body: body.trim(),
        category, priority, page_url: window.location.href, user_agent: navigator.userAgent?.slice(0, 200),
      }).select().single()
      if (error) throw new Error(error.message)
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id, sender_type: 'customer', sender_id: profile?.id,
        sender_name: profile?.full_name || 'You', body: body.trim(),
      })
      toast.success('Ticket created — we\'ll respond shortly')
      clearDraft(); setView('list'); fetchTickets()
    } catch (err) { toast.error(err.message || 'Failed to create ticket') }
    finally { setSubmitting(false) }
  }

  async function handleReply() {
    if (!reply.trim() || !selectedTicket) return
    setSending(true)
    try {
      await supabase.from('ticket_messages').insert({
        ticket_id: selectedTicket.id, sender_type: 'customer', sender_id: profile?.id,
        sender_name: profile?.full_name || 'You', body: reply.trim(),
      })
      if (selectedTicket.status === 'waiting_customer') {
        await supabase.from('support_tickets').update({ status: 'waiting_internal', updated_at: new Date().toISOString() }).eq('id', selectedTicket.id)
        setSelectedTicket(prev => ({ ...prev, status: 'waiting_internal' }))
      }
      setReply('')
      const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', selectedTicket.id).order('created_at', { ascending: true })
      setMessages(data || [])
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) { toast.error(err.message) }
    finally { setSending(false) }
  }

  async function handleClose() {
    await supabase.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', selectedTicket.id)
    toast.success('Ticket resolved'); setView('list'); fetchTickets()
  }

  async function handleRate(score) {
    setCsatScore(score)
    await supabase.from('support_tickets').update({ csat_score: score }).eq('id', selectedTicket.id)
    toast.success('Thanks for your feedback!')
  }

  const openCount = tickets.filter(t => ['open', 'in_progress', 'waiting_customer', 'waiting_internal'].includes(t.status)).length

  if (loading && tickets.length === 0) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Support</h1>
          <p className="text-[13px] text-t3 mt-0.5">{openCount} open ticket{openCount !== 1 ? 's' : ''}</p>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('create')} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all glow-sm flex items-center gap-2 btn-press">
            <Plus size={14} /> New Ticket
          </button>
        )}
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setSelectedTicket(null) }} className="px-3 py-1.5 rounded-lg text-[12px] text-t3 hover:text-t1 transition flex items-center gap-1.5 hover:bg-deep">
            <ArrowLeft size={13} /> All Tickets
          </button>
        )}
      </div>

      {/* LIST */}
      {view === 'list' && (<>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map(f => {
            const count = f === 'all' ? tickets.length : tickets.filter(t => t.status === f).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition whitespace-nowrap flex items-center gap-1.5 ${filter === f ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t1 hover:bg-deep'}`}>
                {f === 'all' ? 'All' : STATUS_BADGE[f]?.label || f}
                {count > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${filter === f ? 'bg-cyan/20' : 'bg-deep'}`}>{count}</span>}
              </button>
            )
          })}
        </div>

        {tickets.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center page-enter">
            <div className="w-16 h-16 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-t3" />
            </div>
            <p className="text-[16px] text-t1 font-semibold mb-1">No tickets yet</p>
            <p className="text-[13px] text-t3 max-w-[280px] mx-auto mb-6">Create a ticket when you need help with billing, integrations, or anything else.</p>
            <button onClick={() => setView('create')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all inline-flex items-center gap-2">
              <Plus size={14} /> Create Your First Ticket
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const sb = STATUS_BADGE[t.status] || STATUS_BADGE.open
              const pb = PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.medium
              const StatusIcon = sb.icon
              return (
                <button key={t.id} onClick={() => openTicket(t)} className="w-full glass-card rounded-xl p-4 text-left hover:border-border-hover hover:-translate-y-px transition-all group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sb.bg}`}>
                        <StatusIcon size={16} className={sb.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${sb.bg} ${sb.text}`}>{sb.label}</span>
                          <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${pb.dot}`} /><span className={`text-[9px] font-mono font-bold uppercase ${pb.text}`}>{t.priority}</span></span>
                          <span className="text-[9px] font-mono text-t4">{t.category?.replace('_', ' ')}</span>
                        </div>
                        <p className="text-[13px] font-medium text-t1 truncate">{t.subject}</p>
                        <p className="text-[11px] text-t3 mt-0.5 line-clamp-1">{t.body}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-t4">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </>)}

      {/* CREATE */}
      {view === 'create' && (
        <div className="page-enter">
          <form onSubmit={handleCreate} className="glass-card rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-[16px] font-bold text-t1">Create Support Ticket</h2><p className="text-[12px] text-t3 mt-0.5">Describe your issue and we'll get back to you</p></div>
              {draftStatus && <span className={`text-[11px] font-mono px-2 py-1 rounded count-enter ${draftStatus === 'saving' ? 'text-amber' : 'text-green'}`}>{draftStatus === 'saving' ? 'Saving draft...' : 'Draft saved'}</span>}
            </div>
            <div><label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="Brief summary of your issue" className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" /></div>
            <div><label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} required rows={6} placeholder="Describe the issue in detail. Include steps to reproduce and any error messages." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3 resize-none leading-relaxed" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition cursor-pointer">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select></div>
              <div><label className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-1.5 block">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition cursor-pointer">
                  <option value="low">Low — no impact</option><option value="medium">Medium — minor impact</option><option value="high">High — significant impact</option><option value="critical">Critical — blocking</option>
                </select></div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={submitting || !subject.trim() || !body.trim()} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-void text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 glow-sm flex items-center gap-2 btn-press">
                {submitting ? <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" /> Submitting...</> : <><Send size={14} /> Submit Ticket</>}
              </button>
              {(subject || body) && <button type="button" onClick={clearDraft} className="text-[12px] text-t3 hover:text-t1 transition">Clear draft</button>}
            </div>
          </form>
        </div>
      )}

      {/* DETAIL */}
      {view === 'detail' && selectedTicket && (
        <div className="space-y-4 page-enter">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${STATUS_BADGE[selectedTicket.status]?.bg} ${STATUS_BADGE[selectedTicket.status]?.text}`}>{STATUS_BADGE[selectedTicket.status]?.label}</span>
                  <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${PRIORITY_BADGE[selectedTicket.priority]?.dot}`} /><span className={`text-[10px] font-mono font-bold uppercase ${PRIORITY_BADGE[selectedTicket.priority]?.text}`}>{selectedTicket.priority}</span></span>
                  <span className="text-[10px] font-mono text-t4 capitalize">{selectedTicket.category?.replace('_', ' ')}</span>
                </div>
                <h2 className="text-[18px] font-display font-bold text-t1">{selectedTicket.subject}</h2>
                <p className="text-[11px] text-t4 font-mono mt-1.5">#{selectedTicket.id?.slice(0, 8)} · {new Date(selectedTicket.created_at).toLocaleString()}</p>
              </div>
              {!['closed', 'resolved'].includes(selectedTicket.status) && (
                <button onClick={handleClose} className="px-3.5 py-2 rounded-xl text-[12px] text-green font-medium border border-green/20 hover:bg-green/[0.06] hover:border-green/30 transition-all flex items-center gap-1.5"><CheckCircle2 size={13} /> Resolve</button>
              )}
            </div>
            <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-1">
              {messages.length === 0 && (
                <div className="rounded-xl p-4 bg-cyan/[0.03] border border-cyan/[0.06]">
                  <div className="flex items-center gap-2 mb-1.5"><span className="text-[10px] font-mono font-bold uppercase text-cyan">You</span><span className="text-[9px] font-mono text-t4">{new Date(selectedTicket.created_at).toLocaleString()}</span></div>
                  <p className="text-[13px] text-t2 leading-relaxed whitespace-pre-wrap">{selectedTicket.body}</p>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`rounded-xl p-4 ${m.sender_type === 'customer' ? 'bg-cyan/[0.03] border border-cyan/[0.06]' : m.sender_type === 'system' ? 'bg-deep/50 border border-border/20' : 'bg-purple/[0.03] border border-purple/[0.06]'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-mono font-bold uppercase ${m.sender_type === 'customer' ? 'text-cyan' : m.sender_type === 'system' ? 'text-t3' : 'text-purple'}`}>{m.sender_type === 'customer' ? (m.sender_name || 'You') : m.sender_type === 'system' ? 'System' : (m.sender_name || 'Support')}</span>
                    <span className="text-[9px] font-mono text-t4">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[13px] text-t2 leading-relaxed whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {!['closed', 'resolved'].includes(selectedTicket.status) && (
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex gap-2">
                  <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }} rows={2}
                    className="flex-1 px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3 resize-none" />
                  <button onClick={handleReply} disabled={sending || !reply.trim()} className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-void hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-40 self-end btn-press">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-t4 mt-1.5">Press Enter to send · Shift+Enter for new line</p>
              </div>
            )}
            {selectedTicket.status === 'resolved' && !selectedTicket.csat_score && (
              <div className="mt-6 p-5 rounded-xl bg-green/[0.03] border border-green/[0.08] text-center">
                <p className="text-[14px] text-t1 font-medium mb-1">How was your experience?</p>
                <p className="text-[12px] text-t3 mb-3">Your feedback helps us improve</p>
                <div className="flex items-center justify-center gap-1.5">
                  {[1,2,3,4,5].map(s => (<button key={s} onClick={() => handleRate(s)} className={`p-2 rounded-xl transition-all hover:scale-110 ${csatScore >= s ? 'text-amber scale-110' : 'text-t4 hover:text-amber'}`}><Star size={24} fill={csatScore >= s ? 'currentColor' : 'none'} /></button>))}
                </div>
              </div>
            )}
            {selectedTicket.csat_score && <div className="mt-4 p-3 rounded-xl bg-green/[0.03] border border-green/[0.08] text-center"><p className="text-[12px] text-green font-medium flex items-center justify-center gap-1"><CheckCircle2 size={13} /> You rated this {selectedTicket.csat_score}/5 — thank you!</p></div>}
          </div>
        </div>
      )}
    </div>
  )
}
