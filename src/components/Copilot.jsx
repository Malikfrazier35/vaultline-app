import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { X, Send, Sparkles, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

const PLAN_LIMITS = { starter: 20, growth: 100, enterprise: Infinity }

const SUGGESTIONS = [
  'How much idle cash do we have?',
  'Show me our runway projection',
  'Summarize this week\'s cash flow',
  'Generate a board treasury summary',
  'When is our next large outflow?',
  'What would happen if revenue dropped 20%?',
]

export default function Copilot({ open, onClose }) {
  const { profile, org } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
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
    if (!text.trim() || streaming) return
    if (atLimit) return

    const userMsg = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            message: text.trim(),
            history: messages.slice(-10),
          }),
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
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
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
              {SUGGESTIONS.slice(0, 4).map((s) => (
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

      {/* Input */}
      {/* Plan limit bar */}
      {dailyLimit !== Infinity && (
        <div className="px-4 py-1.5 flex items-center justify-between border-t border-border/20">
          <span className="text-[9px] font-mono text-t4">{dailyCount}/{dailyLimit} messages today</span>
          {atLimit && <Link to="/billing" onClick={onClose} className="text-[9px] font-mono text-amber hover:text-cyan transition">Upgrade →</Link>}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
        {atLimit ? (
          <div className="flex-1 flex items-center gap-2 bg-amber/[0.04] border border-amber/[0.1] rounded-[10px] px-4 py-2.5">
            <Lock size={14} className="text-amber flex-shrink-0" />
            <span className="text-[12px] text-amber">Daily limit reached. <Link to="/billing" onClick={onClose} className="underline hover:text-cyan transition">Upgrade</Link> for more.</span>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your cash position..."
              className="flex-1 bg-deep border border-border rounded-[10px] px-4 py-2.5 text-[14px] text-t1 outline-none placeholder:text-t3 focus:border-border-cyan transition"
              disabled={streaming}
            />
            <button
              onClick={() => { sendMessage(input); setDailyCount(c => c + 1) }}
              disabled={streaming || !input.trim()}
              className="bg-gradient-to-r from-cyan to-purple rounded-[10px] w-10 flex items-center justify-center hover:scale-105 transition disabled:opacity-40"
            >
              <Send size={16} className="text-void" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
