import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function useToast() {
  return useContext(ToastCtx)
}

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg, dur) => push(msg, 'success', dur),
    error:   (msg, dur) => push(msg, 'error',   dur),
    info:    (msg, dur) => push(msg, 'info',     dur),
  }

  const BG = { success: '#10b981', error: '#ef4444', info: '#4f7cf6' }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              background: BG[t.type],
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              boxShadow: `0 4px 20px ${BG[t.type]}55`,
              cursor: 'pointer',
              pointerEvents: 'all',
              maxWidth: 340,
              lineHeight: 1.5,
              animation: 'toast-in 0.2s ease',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastCtx.Provider>
  )
}
