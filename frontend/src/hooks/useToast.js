import { useState, useCallback, useRef } from 'react'

export function useToast() {
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' })
  const timerRef = useRef(null)

  const showToast = useCallback((msg, type = 'success', duration = 2500) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ show: true, msg, type })
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, show: false }))
    }, duration)
  }, [])

  const ToastEl = (
    <div className={`toast ${toast.type} ${toast.show ? 'show' : ''}`}>
      {toast.msg}
    </div>
  )

  return { showToast, ToastEl }
}
