import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor={inputId} style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--pd-green-dark)',
          letterSpacing: '0.01em',
        }}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            border: `1.5px solid ${error ? 'var(--pd-red)' : 'var(--pd-gray-mid)'}`,
            background: 'var(--pd-white)',
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--pd-text)',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            WebkitAppearance: 'none',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--pd-yellow)'
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? 'var(--pd-red)' : 'var(--pd-gray-mid)'
          }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: '13px', color: 'var(--pd-red)' }}>{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
