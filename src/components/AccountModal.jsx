import { useEffect, useState } from 'react'
import { useAccount } from '../context/AccountContext'

export default function AccountModal() {
  const {
    authError,
    authMessage,
    authMode,
    closeAuthModal,
    continueWatchingItems,
    favoriteItems,
    hasSupabaseConfig,
    isAuthModalOpen,
    isSignedIn,
    profile,
    requestPasswordReset,
    setAuthMode,
    signInWithEmail,
    signInWithProvider,
    signOut,
    signUpWithEmail,
    updateDisplayName,
    user,
  } = useAccount()

  const [signInForm, setSignInForm] = useState({
    email: '',
    password: '',
  })
  const [signUpForm, setSignUpForm] = useState({
    displayName: '',
    email: '',
    password: '',
  })
  const [displayNameDraft, setDisplayNameDraft] = useState(profile.displayName)

  useEffect(() => {
    setDisplayNameDraft(profile.displayName)
  }, [profile.displayName])

  if (!isAuthModalOpen) {
    return null
  }

  const handleSignInSubmit = async (event) => {
    event.preventDefault()
    await signInWithEmail(signInForm)
  }

  const handleSignUpSubmit = async (event) => {
    event.preventDefault()
    await signUpWithEmail(signUpForm)
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    await updateDisplayName(displayNameDraft)
  }

  const handlePasswordReset = async () => {
    await requestPasswordReset(signInForm.email)
  }

  return (
    <div className="account-modal-backdrop" onClick={closeAuthModal} role="presentation">
      <section
        className="account-modal"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-label="Account"
      >
        <div className="account-modal-header">
          <div>
            <p className="account-modal-kicker">Account</p>
            <h2>{isSignedIn ? 'Your profile' : 'Sign in to sync your profile'}</h2>
          </div>
          <button className="account-modal-close" type="button" onClick={closeAuthModal}>
            ×
          </button>
        </div>

        {isSignedIn ? (
          <div className="account-modal-body">
            <div className="account-summary-card">
              <div className="account-summary-avatar">
                {(profile.displayName || user?.email || 'G').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3>{profile.displayName}</h3>
                <p>{profile.email || user?.email || 'Guest profile'}</p>
              </div>
            </div>

            <form className="account-form" onSubmit={handleProfileSubmit}>
              <label className="account-field">
                <span>Display name</span>
                <input
                  type="text"
                  value={displayNameDraft}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                  placeholder="Your name"
                />
              </label>

              <div className="account-stats">
                <div className="account-stat-card">
                  <strong>{favoriteItems.length}</strong>
                  <span>Saved in My List</span>
                </div>
                <div className="account-stat-card">
                  <strong>{continueWatchingItems.length}</strong>
                  <span>Continue watching items</span>
                </div>
              </div>

              {authMessage && <p className="account-helper">{authMessage}</p>}

              <div className="account-actions">
                <button className="account-primary-btn" type="submit">
                  Save profile
                </button>
                <button className="account-secondary-btn" type="button" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="account-modal-body">
            <div className="account-mode-toggle">
              <button
                type="button"
                className={authMode === 'sign-in' ? 'active' : ''}
                onClick={() => setAuthMode('sign-in')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={authMode === 'sign-up' ? 'active' : ''}
                onClick={() => setAuthMode('sign-up')}
              >
                Create Account
              </button>
            </div>

            {authMode === 'sign-in' ? (
              <form className="account-form" onSubmit={handleSignInSubmit}>
                <label className="account-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={signInForm.email}
                    onChange={(event) =>
                      setSignInForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label className="account-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={signInForm.password}
                    onChange={(event) =>
                      setSignInForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Password"
                    required
                  />
                </label>

                <button className="account-primary-btn" type="submit">
                  Sign in with email
                </button>

                <button
                  className="account-text-btn"
                  type="button"
                  onClick={handlePasswordReset}
                >
                  Forgot password?
                </button>
              </form>
            ) : (
              <form className="account-form" onSubmit={handleSignUpSubmit}>
                <label className="account-field">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={signUpForm.displayName}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Cinevia fan"
                    required
                  />
                </label>
                <label className="account-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={signUpForm.email}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label className="account-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={signUpForm.password}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Create a password"
                    required
                  />
                </label>

                <button className="account-primary-btn" type="submit">
                  Create account
                </button>
              </form>
            )}

            <div className="account-divider">
              <span>or continue with</span>
            </div>

            <div className="account-oauth-grid">
              <button
                className="account-secondary-btn"
                type="button"
                onClick={() => signInWithProvider('google')}
                disabled={!hasSupabaseConfig}
              >
                Google
              </button>
            </div>

            {authError && <p className="account-error">{authError}</p>}
            {authMessage && <p className="account-helper">{authMessage}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
