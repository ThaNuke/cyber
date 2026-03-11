import { useEffect, useState } from 'react'
import './Login.css'
import { PublicClientApplication } from '@azure/msal-browser'

let msalInstance = null
let msalInitPromise = null
let msalInteractionLock = false

function Login() {
  const [error, setError] = useState('')
  const [msLoading, setMsLoading] = useState(false)

  const msalClientId = import.meta.env.VITE_MSAL_CLIENT_ID
  const msalTenantId = import.meta.env.VITE_MSAL_TENANT_ID
  const msalAuthority = msalTenantId
    ? `https://login.microsoftonline.com/${msalTenantId}`
    : 'https://login.microsoftonline.com/organizations'

  const exchangeMicrosoftToken = async (idToken) => {
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
    const response = await fetch(`${apiUrl}/auth/microsoft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    })

    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Microsoft login failed (${response.status})`)
    }

    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    if (data.user.role === 'teacher') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/dashboard'
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        if (!msalClientId) return

        if (!msalInstance) {
          msalInstance = new PublicClientApplication({
            auth: {
              clientId: msalClientId,
              authority: msalAuthority,
              redirectUri: window.location.origin,
            },
            cache: {
              cacheLocation: 'sessionStorage',
              storeAuthStateInCookie: false,
            },
          })
        }

        if (!msalInitPromise) {
          msalInitPromise = msalInstance.initialize()
        }
        await msalInitPromise

        // Handle redirect callback (avoids #code=... page sticking around)
        const result = await msalInstance.handleRedirectPromise()
        if (cancelled) return
        if (result?.idToken) {
          setMsLoading(true)
          await exchangeMicrosoftToken(result.idToken)
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Microsoft callback failed')
      } finally {
        if (!cancelled) setMsLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetMicrosoftLogin = () => {
    try {
      // Clear MSAL cached interaction/state (sessionStorage)
      const clearMsaKeys = (storage) => {
        const keys = []
        for (let i = 0; i < storage.length; i += 1) {
          const k = storage.key(i)
          if (k && k.startsWith('msal.')) keys.push(k)
        }
        keys.forEach(k => storage.removeItem(k))
      }
      clearMsaKeys(sessionStorage)
      // Defensive: clear localStorage too (even if cacheLocation=sessionStorage)
      clearMsaKeys(localStorage)

      // Clear our app auth too (safe reset)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('admin2fa_verified')
    } finally {
      window.location.reload()
    }
  }

  const handleMicrosoftLogin = async () => {
    if (msalInteractionLock) return
    setError('')
    setMsLoading(true)
    try {
      if (!msalClientId) {
        throw new Error('ยังไม่ได้ตั้งค่า VITE_MSAL_CLIENT_ID')
      }

      if (!msalInstance) {
        msalInstance = new PublicClientApplication({
          auth: {
            clientId: msalClientId,
            authority: msalAuthority,
            redirectUri: window.location.origin,
          },
          cache: {
            cacheLocation: 'sessionStorage',
            storeAuthStateInCookie: false,
          },
        })
      }

      if (!msalInitPromise) {
        msalInitPromise = msalInstance.initialize()
      }
      await msalInitPromise

      msalInteractionLock = true
      // Use redirect flow to avoid nested popup issues
      await msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
      })
    } catch (err) {
      const code = err?.errorCode || err?.code
      if (code === 'interaction_in_progress') {
        setError('สถานะเข้าสู่ระบบ Microsoft ค้างอยู่ กด “รีเซ็ต Microsoft Login” แล้วลองใหม่')
      } else {
        setError(err.message || 'เข้าสู่ระบบด้วย Microsoft ไม่สำเร็จ')
      }
    } finally {
      msalInteractionLock = false
      setMsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Section - KMUTT Photo */}
        <div className="login-illustration-section">
          <div className="login-photo" />
        </div>

        {/* Right Section - Form */}
        <div className="login-content">
          <div className="login-header">
            <div className="logo-section">
              <img src="/KMUTT_CI_Primary_Logo-Full.png" alt="KMUTT Logo" className="logo" />
            </div>
            <h1>เข้าสู่ระบบ</h1>
            <p>ยินดีต้อนรับเข้าสู่ระบบประเมินการสอน</p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="login-form">
            {error && (
              <div className="error-message">
                <span> {error}</span>
              </div>
            )}
            {error && (
              <button
                type="button"
                onClick={resetMicrosoftLogin}
                disabled={msLoading}
                className="login-button"
                style={{
                  marginBottom: 12,
                  background: '#6b7280',
                }}
              >
                รีเซ็ต Microsoft Login
              </button>
            )}

            <button
              type="button"
              className="login-button"
              onClick={handleMicrosoftLogin}
              disabled={msLoading}
              style={{ marginTop: 12, background: '#111827' }}
            >
              {msLoading ? 'กำลังเข้าสู่ระบบด้วย Microsoft...' : 'เข้าสู่ระบบด้วย Microsoft (@mail.kmutt.ac.th)'}
            </button>
          </form>

          <div className="login-footer">
            <p>
              <a href="/forgot-password">ลืมรหัสผ่าน?</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
