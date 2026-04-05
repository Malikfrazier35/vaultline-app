import { useTheme } from '@/hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-11 h-11 rounded-xl border border-border flex items-center justify-center hover:border-border-hover hover:bg-deep active:bg-deep active:scale-95 transition-all group ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={17} className="text-t3 group-hover:text-amber group-active:text-amber transition-colors" />
      ) : (
        <Moon size={17} className="text-t3 group-hover:text-purple group-active:text-purple transition-colors" />
      )}
    </button>
  )
}
