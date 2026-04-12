import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { MessageSquare, X, Send, Loader2, Sparkles, ChevronDown, Wrench } from 'lucide-react'

export default function SupportChat() {
  const { user, profile, org } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [convId, setConvId] = useState(null)
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      const name = profile?.full_name?.split(' ')[0] || 'there'
      setMessages([{
        role: 'assistant',
        content: `Hi ${name} \u2014 I'm your Vaultline support assistant. I have access to your treasury data and can help with questions about your cash position, transactions, forecasts, bank connections, team management, and more.\n\nWhat can I help with?`,
        tools: [],
      }])
    }
  }, [open, profile])

  async function sendMessage() {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setSending(true)

    try {
      const { data, error } = await supabase.functions.invoke('ai-support', {
        body: { message: userMsg, conversation_id: convId },
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      if (data?.conversation_id && !convId) setConvId(data.conversation_id)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data?.response || 'I couldn\'t process that. Please try again.',
        tools: data?.tools_used || [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${err.message}. Please try again or submit a support ticket from the Support page.`,
        tools: [],
      }])
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!user) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => { setOpen(true); setUnread(0) }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan to-sky-400 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 24px rgba(8,145,178,0.3)' }}>
          <MessageSquare size={22} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden flex flex-col"
          style={{ height: '560px', background: 'var(--color-background-primary, #fff)', border: '0.5px solid var(--color-border-tertiary)', boxShadow: '0 12px 48px rgba(0,0,0,0.12)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-tertiary)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan/[0.08] flex items-center justify-center">
                <Sparkles size={14} className="text-cyan" />
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Vaultline AI</p>
                <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>Treasury support</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setMessages([]); setConvId(null) }}
                className="p-1.5 rounded-lg transition" style={{ color: 'var(--color-text-tertiary)' }}
                title="New conversation">
                <ChevronDown size={14} />
              </button>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition" style={{ color: 'var(--color-text-tertiary)' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollBehavior: 'smooth' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan text-white rounded-br-sm'
                    : 'rounded-bl-sm'
                }`} style={msg.role !== 'user' ? { background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' } : {}}>
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1.5' : ''}>{line}</p>
                  ))}
                  {msg.tools?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 pt-1.5" style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                      <Wrench size={10} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                        {msg.tools.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3.5 py-2.5 rounded-bl-sm" style={{ background: 'var(--color-background-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
                    <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--color-border-tertiary)' }}>
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask about your treasury data..."
                rows={1}
                className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-[13px] outline-none"
                style={{
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  maxHeight: '80px',
                }} />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-xl bg-cyan text-white flex items-center justify-center shrink-0 hover:opacity-90 active:scale-95 transition disabled:opacity-40">
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] font-mono mt-1.5 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              AI assistant with live data access
            </p>
          </div>
        </div>
      )}
    </>
  )
}
