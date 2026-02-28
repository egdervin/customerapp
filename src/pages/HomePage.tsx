import { useState } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { useAuthStore } from '../stores/authStore'
import { Logo } from '../components/Logo'

type Tab = 'wallet' | 'transactions' | 'menu' | 'order'

interface TabItem {
  id: Tab
  label: string
  icon: string
  comingSoon?: boolean
}

const TABS: TabItem[] = [
  { id: 'wallet', label: 'Wallet', icon: '⬡' },
  { id: 'transactions', label: 'History', icon: '↕' },
  { id: 'menu', label: 'Menu', icon: '◈', comingSoon: true },
  { id: 'order', label: 'Order', icon: '◎', comingSoon: true },
]

export function HomePage() {
  const { customerProfile, signOut } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('wallet')

  if (!customerProfile) return null

  const displayName = `${customerProfile.first_name} ${customerProfile.last_name}`
  const initials = `${customerProfile.first_name[0]}${customerProfile.last_name[0]}`.toUpperCase()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pd-off-white)',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--pd-green-dark)',
        padding: 'var(--space-lg) var(--space-xl)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Logo size="sm" variant="light" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
          cursor: 'pointer',
        }} onClick={() => signOut()}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--pd-yellow)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '13px', color: 'var(--pd-text)',
          }}>
            {initials}
          </div>
        </div>
      </header>

      {/* Balance banner */}
      <div style={{
        background: 'var(--pd-green-dark)',
        padding: '0 var(--space-xl) var(--space-xl)',
      }}>
        <div style={{
          background: 'var(--pd-green-mid)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          border: '1px solid rgba(232,148,58,0.15)',
        }}>
          <p style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'rgba(245,240,232,0.45)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-sm)',
          }}>
            Account balance
          </p>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '48px',
            color: 'var(--pd-white)',
            lineHeight: 1,
            marginBottom: 'var(--space-xs)',
          }}>
            ${customerProfile.balance.toFixed(2)}
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(245,240,232,0.4)' }}>
            {displayName}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        background: 'var(--pd-white)',
        borderBottom: '1px solid var(--pd-gray-light)',
        padding: '0 var(--space-sm)',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: 'var(--space-md) var(--space-sm)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--pd-yellow)'
                : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color: activeTab === tab.id ? 'var(--pd-green)' : 'rgba(28,26,24,0.45)',
              transition: 'all 0.15s ease',
              letterSpacing: '0.03em',
              position: 'relative',
            }}
          >
            {tab.label}
            {tab.comingSoon && (
              <span style={{
                position: 'absolute',
                top: 6, right: 4,
                width: 6, height: 6,
                background: 'var(--pd-yellow)',
                borderRadius: '50%',
                opacity: 0.6,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, padding: 'var(--space-xl)', overflow: 'auto' }}>
        {activeTab === 'wallet' && <WalletTab customerProfile={customerProfile} />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {(activeTab === 'menu' || activeTab === 'order') && <ComingSoonTab tab={activeTab} />}
      </div>
    </div>
  )
}

function WalletTab({ customerProfile }: { customerProfile: { scancode: string; first_name: string } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xl)' }}>
      <div className="animate-fade-up">
        <p style={{
          textAlign: 'center',
          fontSize: '14px',
          color: 'rgba(28,26,24,0.5)',
          marginBottom: 'var(--space-lg)',
        }}>
          Show this code at the kiosk to pay
        </p>

        {/* QR Code card */}
        <div style={{
          background: 'var(--pd-white)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xl)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-lg)',
          border: '1px solid var(--pd-gray-light)',
          animation: 'pulse-green 3s ease-in-out infinite',
        }}>
          <QRCode
            value={customerProfile.scancode}
            size={200}
            level="M"
            includeMargin={false}
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'rgba(28,26,24,0.4)', marginBottom: 2 }}>
              Member ID
            </p>
            <p style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'rgba(28,26,24,0.35)',
              letterSpacing: '0.05em',
            }}>
              {customerProfile.scancode.slice(0, 4)} {customerProfile.scancode.slice(4, 8)} {customerProfile.scancode.slice(8, 12)} {customerProfile.scancode.slice(12)}
            </p>
          </div>
        </div>
      </div>

      <div className="animate-fade-up animate-fade-up-delay-1" style={{
        background: 'rgba(232,242,42,0.1)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--pd-green)', fontWeight: 500 }}>
          💡 Keep your screen bright when scanning
        </p>
      </div>
    </div>
  )
}

function TransactionsTab() {
  // TODO: fetch from Supabase
  return (
    <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
      <div style={{ fontSize: '40px', marginBottom: 'var(--space-md)' }}>📋</div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', marginBottom: 'var(--space-sm)' }}>
        No transactions yet
      </p>
      <p style={{ fontSize: '14px', color: 'rgba(28,26,24,0.45)' }}>
        Your purchase history will appear here
      </p>
    </div>
  )
}

function ComingSoonTab({ tab }: { tab: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
      <div style={{
        width: 64, height: 64,
        background: 'var(--pd-yellow)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '28px', margin: '0 auto var(--space-lg)',
      }}>
        {tab === 'menu' ? '🍽' : '🛒'}
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: 'var(--space-sm)' }}>
        Coming soon
      </p>
      <p style={{ fontSize: '14px', color: 'rgba(28,26,24,0.45)', lineHeight: 1.6 }}>
        {tab === 'menu'
          ? 'Browse today\'s café menu right from your phone.'
          : 'Place orders ahead and skip the line.'}
      </p>
    </div>
  )
}
