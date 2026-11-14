import { useEffect, useState } from 'react'
import { getSiteSettings } from '../firebase/db'

const TONES = {
  info: { background: '#e8f1ff', color: '#14407a' },
  success: { background: '#e5f7ec', color: '#0d5a33' },
  warning: { background: '#fff4d6', color: '#7a5200' },
  danger: { background: '#fde8e8', color: '#8a1c1c' },
}

// Announcement banner controlled from Admin → Settings.
export default function SiteBanner() {
  const [settings, setSettings] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let mounted = true
    getSiteSettings().then(value => mounted && setSettings(value))
    return () => { mounted = false }
  }, [])

  if (!settings?.announcementEnabled || !settings.announcementText || dismissed) return null

  const tone = TONES[settings.announcementTone] || TONES.info

  return (
    <div
      role="status"
      style={{
        ...tone,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <span>{settings.announcementText}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}