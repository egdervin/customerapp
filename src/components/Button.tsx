import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px 24px',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.18s var(--ease-out)',
    border: 'none',
    outline: 'none',
    opacity: loading ? 0.7 : 1,
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--pd-yellow)',
      color: 'var(--pd-green-dark)',
      boxShadow: '0 4px 20px rgba(232,242,42,0.25)',
    },
    secondary: {
      background: 'var(--pd-green)',
      color: '#ffffff',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--pd-text)',
      border: '1.5px solid var(--pd-gray-mid)',
    },
  }

  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <>
          <span style={{
            width: 16, height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </>
      ) : null}
      {children}
    </button>
  )
}
