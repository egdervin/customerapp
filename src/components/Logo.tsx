interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
}

const sizes = {
  sm: { mark: 24, text: '17px' },
  md: { mark: 36, text: '24px' },
  lg: { mark: 52, text: '34px' },
}

export function Logo({ size = 'md', variant = 'dark' }: LogoProps) {
  const { mark, text } = sizes[size]
  const textColor = variant === 'light' ? '#ffffff' : 'var(--pd-green)'
  const shapeColor = variant === 'light' ? '#ffffff' : '#145a10'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Official PD mark */}
      <svg
        width={mark}
        height={Math.round(mark * 1.28)}
        viewBox="0 0 100 128"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="22" cy="19" r="16" fill="#e8f22a"/>
        <rect x="6" y="42" width="32" height="32" rx="6" fill={shapeColor}/>
        <path d="M38 112 L38 82 L6 82 Q6 112 38 112 Z" fill={shapeColor}/>
        <path d="M52 4 L52 36 L84 36 Q84 4 52 4 Z" fill={shapeColor}/>
        <path d="M84 42 L52 42 L52 74 Q84 74 84 42 Z" fill={shapeColor}/>
      </svg>

      {/* Wordmark */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: text,
        fontWeight: 400,
        color: textColor,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        Plusdine
      </span>
    </div>
  )
}
