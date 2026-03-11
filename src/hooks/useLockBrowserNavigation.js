import { useEffect } from 'react'

/**
 * Handle browser back/forward navigation while mounted.
 * - default: "lock" (pushState กลับให้อยู่หน้าเดิม)
 * - optional: "logout" (ล้าง auth แล้วเด้งไป /login)
 *
 * Note: ไม่สามารถ "บล็อก" ได้ 100% ทุกกรณี แต่ช่วยกันการกด back/forward ใน SPA ได้ดี
 */
export default function useLockBrowserNavigation(
  enabled = true,
  { mode = 'lock' } = {}
) {
  useEffect(() => {
    if (!enabled) return

    // เพิ่ม state กัน back ครั้งแรก
    try {
      window.history.pushState(null, '', window.location.href)
    } catch {
      // ignore
    }

    const handlePopState = () => {
      if (mode === 'logout') {
        try {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('admin2fa_verified')
          localStorage.removeItem('otp_verified')
          localStorage.removeItem('otp_verified_time')
        } catch {
          // ignore
        }
        window.location.href = '/login'
        return
      }

      // mode === 'lock' -> ดันกลับให้อยู่หน้าเดิม
      try {
        window.history.pushState(null, '', window.location.href)
      } catch {
        // ignore
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [enabled, mode])
}

