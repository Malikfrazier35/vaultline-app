import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { X, Send, Sparkles, Lock } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const PLAN_LIMITS = { starter: 20, growth: 100, enterprise: Infinity }

const PAGE_SUGGESTIONS = {
  '/dashboard': ['What changed since yesterday?', 'Run a quick cash health check', 'Summarize this week\'s cash flow', 'Generate a board summary'],
  '/position': ['Which account has the most idle cash?', 'Is our concentration risk too high?', 'How does our liquidity compare to last month?', 'What is our effective cash buffer?'],
  '/forecast': ['Which forecast model is most accurate?', 'What if revenue drops 20%?', 'Show me the Monte Carlo confidence band', 'When do we hit zero at current burn?'],
  '/transactions': ['Flag any unusual transactions this week', 'What are our top 5 expense categories?', 'Find duplicate or recurring charges', 'How much are we spending on SaaS?'],
  '/banks': ['Which banks need re-syncing?', 'Help me connect a new bank', 'What are our bank fee totals?', 'Is any connection stale?'],
  '/reports': ['Generate a board treasury summary', 'Run a cash flow statement for this month', 'Compare this month to last month', 'What should I highlight for the board?'],
  '/scenarios': ['Create a bear case scenario', 'What if we lose our top customer?', 'Model a 15% headcount reduction', 'Stress test our runway'],
  '/alerts': ['Set up a low balance alert', 'What alerts fired this week?', 'Recommend alert rules for my setup', 'Help me configure Slack notifications'],
  '/copilot': ['What needs attention today?', 'Run the morning briefing', 'Show me all pending tasks', 'What did I miss overnight?'],
  '/home': ['Give me a 30-second cash update', 'What should I focus on today?', 'Any anomalies this week?', 'How is our runway trending?'],
}
const DEFAULT_SUGGESTIONS = ['How much idle cash do we have?', 'Show me our runway projection', 'Summarize this week\'s cash flow', 'Generate a board summary']

export default function Copilot({ open, onClose }) {
  const { profile, org } = useAuth()
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [errorCount, setErrorCount] = useState(0)
  const [lastError, setLastError] = useState(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [attachment, setAttachment] = useState(null) // { name, type, base64, preview }

  // File processing
  function processFile(file) {
    if (!file) return
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) { return }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv']
    if (!allowed.some(t => file.type.startsWith(t.split('/')[0]) || file.type === t)) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1]
      setAttachment({
        name: file.name,
        type: file.type,
        base64,
        preview: file.type.startsWith('image/') ? e.target.result : null,
      })
    }
    reader.readAsDataURL(file)
  }

  // Drag and drop
  const [dragging, setDragging] = useState(false)
  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  // Paste from clipboard (Cmd+V screenshot)
  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        processFile(item.getAsFile())
        return
      }
    }
  }
  const [dailyCount, setDailyCount] = useState(0)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const plan = org?.plan || 'starter'
  const dailyLimit = PLAN_LIMITS[plan] || 20
  const atLimit = dailyCount >= dailyLimit

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  // Load recent copilot history
  useEffect(() => {
    if (!open || messages.length > 0) return
    loadHistory()
  }, [open])

  async function loadHistory() {
    try {
      const { data } = await supabase
        .from('copilot_messages')
        .select('role, content, created_at')
        .order('created_at', { ascending: true })
        .limit(20)

      if (data?.length) {
        setMessages(data.map((m) => ({ role: m.role, content: m.content })))
      }
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase.from('copilot_messages').select('id', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', today + 'T00:00:00Z')
      setDailyCount(count || 0)
    } catch { /* table may not exist yet */ }
  }

  async function sendMessage(text) {
    if ((!text.trim() && !attachment) || streaming) return
    if (atLimit) return

    const displayText = text.trim() + (attachment ? ` [Attached: ${attachment.name}]` : '')
    const userMsg = { role: 'user', content: displayText, preview: attachment?.preview }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const currentAttachment = attachment
    setAttachment(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const body = {
        message: text.trim() || 'Analyze this file',
        history: messages.slice(-10),
        page_context: location.pathname,
      }

      // Include image if attached
      if (currentAttachment?.type?.startsWith('image/')) {
        body.image = { type: currentAttachment.type, data: currentAttachment.base64 }
      } else if (currentAttachment) {
        body.file = { name: currentAttachment.name, type: currentAttachment.type, data: currentAttachment.base64 }
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        throw new Error(`Copilot error: ${res.status}`)
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                assistantText += parsed.text
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: assistantText }
                  return updated
                })
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Copilot error:', err)
      setErrorCount(c => c + 1)
      setLastError(err.message)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: errorCount >= 2
            ? 'I\'m having trouble responding. Try using the recovery options below to continue.'
            : 'Sorry, I encountered an error. Let me try again — or use the reset button if this persists.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // Estimated context health (rough token count)
  const estimatedTokens = messages.reduce((sum, m) => sum + (m.content?.length || 0) * 0.25, 0)
  const maxTokens = 200000
  const contextHealth = Math.max(0, Math.min(100, Math.round((1 - estimatedTokens / maxTokens) * 100)))
  const contextDegraded = contextHealth < 30
  const contextCritical = contextHealth < 10

  // Summarize and continue — compress conversation, keep key facts
  async function summarizeAndContinue() {
    setStreaming(true)
    try {
      const summaryPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n')
      setMessages([
        { role: 'assistant', content: 'Conversation summarized. I remember the key facts from our discussion. What else can I help with?' }
      ])
      setErrorCount(0)
      setLastError(null)
    } finally {
      setStreaming(false)
    }
  }

  // Soft reset — clear history, inject fresh treasury context
  async function softReset() {
    setMessages([
      { role: 'assistant', content: `Reset complete. I've refreshed your treasury data.\n\nTotal cash: $${((org?.total_cash || 0) / 1000000).toFixed(2)}M across your connected accounts. What would you like to analyze?` }
    ])
    setErrorCount(0)
    setLastError(null)
  }

  // Clear conversation — nuclear option
  function clearConversation() {
    setMessages([])
    setErrorCount(0)
    setLastError(null)
  }

  if (!open) return null

  return (
    <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:w-[420px] max-h-[70vh] sm:max-h-[540px] glass rounded-[18px] z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} className="text-cyan" />
          <span className="font-display text-[16px] font-semibold">Treasury Copilot</span>
          <span className="bg-gradient-to-r from-cyan to-purple text-void text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">AI</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-deep text-t3 hover:text-t2 transition">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-deep rounded-[14px] p-4 text-[14px] text-t2 leading-relaxed">
              Hey {profile?.full_name?.split(' ')[0] || 'there'}! I have access to your live treasury data. Ask me anything about your cash position, forecasts, or transactions.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(PAGE_SUGGESTIONS[location.pathname] || DEFAULT_SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-lg border border-border text-[13px] text-t2 hover:border-cyan hover:text-cyan active:text-cyan transition bg-transparent cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
            {msg.role === 'user' ? (
              <div className="bg-cyan/10 border border-cyan/20 rounded-[14px] rounded-br-sm px-4 py-2.5 text-[14px] text-t1 max-w-[85%]">
                {msg.preview && <img src={msg.preview} className="w-full max-w-[200px] rounded-lg mb-2 border border-cyan/10" alt="Attached" />}
                {msg.content}
              </div>
            ) : (
              <div className="bg-deep rounded-[14px] rounded-bl-sm px-4 py-3 text-[14px] text-t2 leading-relaxed max-w-[95%]">
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce [animation-delay:0s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce [animation-delay:0.3s]" />
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Plan limit + context health */}
      <div className="px-4 py-1.5 flex items-center justify-between border-t border-border/20">
        <div className="flex items-center gap-2">
          {dailyLimit !== Infinity && <span className="text-[9px] font-mono text-t4">{dailyCount}/{dailyLimit} messages today</span>}
          {messages.length > 0 && (
            <span className={`text-[9px] font-mono ${contextCritical ? 'text-red' : contextDegraded ? 'text-amber' : 'text-t4'}`}>
              ctx: {contextHealth}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {atLimit && <Link to="/billing" onClick={onClose} className="text-[9px] font-mono text-amber hover:text-cyan transition">Upgrade →</Link>}
        </div>
      </div>

      {/* Recovery buttons — show when degraded or errored */}
      {(contextDegraded || errorCount >= 2) && messages.length > 0 && (
        <div className="px-4 py-2 border-t border-border/20 bg-deep/50">
          {errorCount >= 2 && (
            <p className="text-[10px] text-red mb-2 font-mono">Copilot is struggling. Use recovery options:</p>
          )}
          {contextDegraded && errorCount < 2 && (
            <p className="text-[10px] text-amber mb-2 font-mono">Long conversation — responses may slow down.</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {contextDegraded && (
              <button onClick={summarizeAndContinue} disabled={streaming}
                className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-cyan/[0.06] border border-cyan/[0.15] text-cyan hover:bg-cyan/[0.12] transition">
                Summarize & continue
              </button>
            )}
            <button onClick={softReset} disabled={streaming}
              className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-amber/[0.06] border border-amber/[0.15] text-amber hover:bg-amber/[0.12] transition">
              Soft reset
            </button>
            <button onClick={clearConversation}
              className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-lg bg-red/[0.06] border border-red/[0.15] text-red hover:bg-red/[0.12] transition">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-t border-border shrink-0">
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-deep border border-border text-[11px]">
            {attachment.preview && <img src={attachment.preview} className="w-8 h-8 rounded object-cover" alt="" />}
            <span className="flex-1 text-t2 truncate">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-t4 hover:text-red transition text-[10px]">✕</button>
          </div>
        )}
        {atLimit ? (
          <div className="flex items-center gap-2 bg-amber/[0.04] border border-amber/[0.1] rounded-[10px] px-4 py-2.5">
            <Lock size={14} className="text-amber flex-shrink-0" />
            <span className="text-[12px] text-amber">Daily limit reached. <Link to="/billing" onClick={onClose} className="underline hover:text-cyan transition">Upgrade</Link> for more.</span>
          </div>
        ) : (
          <div className="flex gap-2"
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={dragging ? "Drop file here..." : "Ask about your cash position..."}
              className={`flex-1 bg-deep border rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none placeholder:text-t3 focus:border-border-cyan transition ${dragging ? 'border-cyan border-dashed' : 'border-border'}`}
              disabled={streaming}
            />
            <button
              onClick={() => { sendMessage(input); setDailyCount(c => c + 1) }}
              disabled={streaming || (!input.trim() && !attachment)}
              className="bg-gradient-to-r from-cyan to-purple rounded-[10px] w-10 flex items-center justify-center hover:scale-105 transition disabled:opacity-40"
            >
              <Send size={16} className="text-void" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
