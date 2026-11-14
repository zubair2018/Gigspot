import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()

  const location = useLocation()
  const navigate = useNavigate()
  const containerRef = useRef(null)

  const [openMenu, setOpenMenu] = useState(null)
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setOpenMenu(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpenMenu(null)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function toggleMenu(name) {
    setOpenMenu(current => (current === name ? null : name))
  }

  async function handleLogout() {
    setSigningOut(true)
    setError('')

    try {
      await logout()
      setOpenMenu(null)
      navigate('/')
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  const freelancerDestination = user
    ? '/post-skill'
    : '/signup?intent=freelancer'

  return (
    <header className="gs-header" ref={containerRef}>
      <div className="gs-container gs-navbar">
        <Link to="/" className="gs-logo" aria-label="Gigspot.in home">
          gigspot<span>.in</span>
        </Link>

        <nav className="gs-desktop-nav" aria-label="Main navigation">
          {user ? (
            <>
              <Link className="gs-button gs-button-spark" to="/post-job">Post a request</Link>
              <NavLink to="/messages">Messages</NavLink>
              <NavLink to="/my-skills">My Skills</NavLink>
              <NavLink to="/my-jobs">My Jobs</NavLink>

              <div className="gs-menu-container">
                <button
                  type="button"
                  className="gs-avatar"
                  onClick={() => toggleMenu('account')}
                  aria-label="Open account menu"
                  aria-expanded={openMenu === 'account'}
                  aria-controls="gigspot-account-menu"
                >
                  {(user.displayName || user.email || 'G')
                    .charAt(0)
                    .toUpperCase()}
                </button>

                {openMenu === 'account' && (
                  <div className="gs-dropdown" id="gigspot-account-menu">
                    <div className="gs-account-summary">
                      <strong>{user.displayName || 'Gigspot member'}</strong>
                      <span>{user.email}</span>
                    </div>

                    <Link to="/post-skill">Offer a skill</Link>
                    <Link to="/post-job">Post a hiring request</Link>
                    <Link to="/saved">Saved listings</Link>
                    {isAdmin && <Link to="/admin">Admin dashboard</Link>}

                    <button
                      type="button"
                      className="gs-dropdown-action"
                      onClick={handleLogout}
                      disabled={signingOut}
                    >
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to={freelancerDestination}>Join as freelancer</Link>
              <Link to="/signin">Sign in</Link>
              <Link className="gs-button gs-button-outline" to="/signup">
                Join
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          className="gs-mobile-toggle"
          onClick={() => toggleMenu('mobile')}
          aria-label="Toggle navigation"
          aria-expanded={openMenu === 'mobile'}
          aria-controls="gigspot-mobile-menu"
        >
          {openMenu === 'mobile' ? 'Close' : 'Menu'}
        </button>
      </div>

      {openMenu === 'mobile' && (
        <nav
          className="gs-mobile-nav gs-container"
          id="gigspot-mobile-menu"
          aria-label="Mobile navigation"
        >
          {user ? (
            <>
              <Link to="/post-job">Post a request</Link>
              <Link to="/post-skill">Offer a skill</Link>
              <Link to="/my-skills">My Skills</Link>
              <Link to="/my-jobs">My Jobs</Link>
              <Link to="/messages">Messages</Link>
              <Link to="/saved">Saved listings</Link>
              {isAdmin && <Link to="/admin">Admin dashboard</Link>}

              <button
                type="button"
                className="gs-nav-button"
                disabled={signingOut}
                onClick={handleLogout}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link to="/signin">Sign in</Link>
              <Link to="/signup">Create account</Link>
              <Link to={freelancerDestination}>Join as freelancer</Link>
            </>
          )}
        </nav>
      )}

      {error && (
        <div className="gs-container">
          <p className="gs-alert" role="alert">{error}</p>
        </div>
      )}
    </header>
  )
}