import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import Topbar from '../components/Topbar'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { authError, authMessage, hasSupabaseConfig, session, updatePassword } = useAccount()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localMessage, setLocalMessage] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLocalMessage('Supabase is not configured yet, so password reset is not available.')
      return
    }

    if (!session) {
      setLocalMessage('Open the reset link from your email to finish changing your password.')
    } else {
      setLocalMessage('')
    }
  }, [hasSupabaseConfig, session])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setLocalMessage('The passwords do not match.')
      return
    }

    const didUpdate = await updatePassword(password)

    if (didUpdate) {
      setLocalMessage('Password updated. Redirecting you back home...')
      window.setTimeout(() => {
        navigate('/', { replace: true })
      }, 1400)
    }
  }

  return (
    <main className="reset-page">
      <Topbar showSearch={false} />

      <section className="reset-password-card">
        <p className="reset-password-kicker">Account Security</p>
        <h1>Set a new password</h1>
        <p className="reset-password-copy">
          Finish the recovery flow by choosing a new password for your Cinevia account.
        </p>

        <form className="account-form" onSubmit={handleSubmit}>
          <label className="account-field">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Use at least 8 characters"
              required
            />
          </label>

          <label className="account-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat the password"
              required
            />
          </label>

          <button className="account-primary-btn" type="submit">
            Update password
          </button>
        </form>

        {(localMessage || authMessage) && <p className="account-helper">{localMessage || authMessage}</p>}
        {authError && <p className="account-error">{authError}</p>}

        <Link to="/" className="reset-password-link">
          Back to Cinevia
        </Link>
      </section>
    </main>
  )
}
