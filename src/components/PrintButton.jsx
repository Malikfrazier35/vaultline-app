import { Printer } from 'lucide-react'

/**
 * PrintButton — drop into any page header.
 * Calls window.print() which respects /styles/print.css globally.
 *
 * Usage:
 *   <PrintButton label="Print" />
 *   <PrintButton label="Print Cash Position" variant="ghost" />
 */
export default function PrintButton({ 
  label = 'Print', 
  variant = 'ghost',
  className = '',
  onBeforePrint,
}) {
  const handleClick = () => {
    if (onBeforePrint) onBeforePrint()
    // give the browser a beat to apply any state changes
    setTimeout(() => window.print(), 50)
  }
  
  const base = 'inline-flex items-center gap-2 text-[13px] font-medium transition-colors no-print'
  const variants = {
    ghost: 'px-3 py-1.5 rounded-lg text-t2 hover:text-t1 hover:bg-deep',
    solid: 'px-4 py-2 rounded-lg bg-cyan text-white hover:opacity-90',
    outline: 'px-3 py-1.5 rounded-lg border border-border text-t1 hover:border-border-hover',
  }
  
  return (
    <button 
      onClick={handleClick} 
      className={`${base} ${variants[variant]} ${className}`}
      title="Print this page (Cmd+P)"
    >
      <Printer size={14} />
      {label}
    </button>
  )
}
