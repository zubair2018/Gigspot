import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './context/AuthContext'
import { SavedListingsProvider } from './context/SavedListingsContext'
import Navbar from './components/Navbar'
import SiteBanner from './components/SiteBanner'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Home = lazy(() => import('./pages/Home'))
const PostJob = lazy(() => import('./pages/PostJob'))
const PostSkill = lazy(() => import('./pages/PostSkill'))
const EditJob = lazy(() => import('./pages/EditJob'))
const EditSkill = lazy(() => import('./pages/EditSkill'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const MyJobs = lazy(() => import('./pages/MyJobs'))
const MySkills = lazy(() => import('./pages/MySkills'))
const SavedJobs = lazy(() => import('./pages/SavedJobs'))
const Messages = lazy(() => import('./pages/Messages'))
const Chat = lazy(() => import('./pages/Chat'))

import './gigspot.css'

// The admin console is code-split: regular visitors never download it.
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  return (
    <AuthProvider>
      <SavedListingsProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </SavedListingsProvider>
    </AuthProvider>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const inAdmin = pathname.startsWith('/admin')

  return (
    <>
      {!inAdmin && <SiteBanner />}
      {!inAdmin && <Navbar />}

      <Suspense fallback={<p style={{ padding: 32 }}>Loading page…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="reset" />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route path="/post-job" element={<RequireUser verified><PostJob /></RequireUser>} />
          <Route path="/post-skill" element={<RequireUser verified><PostSkill /></RequireUser>} />

          <Route path="/edit/:id" element={<RequireUser verified><EditJob /></RequireUser>} />
          <Route path="/edit-skill/:id" element={<RequireUser verified><EditSkill /></RequireUser>} />

          <Route path="/job/:id" element={<JobDetail />} />

          <Route path="/my-jobs" element={<RequireUser><MyJobs /></RequireUser>} />
          <Route path="/my-skills" element={<RequireUser><MySkills /></RequireUser>} />

          <Route path="/saved" element={<RequireUser><SavedJobs /></RequireUser>} />
          <Route path="/messages" element={<RequireUser><Messages /></RequireUser>} />
          <Route path="/chat/:chatId" element={<RequireUser verified><Chat /></RequireUser>} />

          <Route
            path="/admin/*"
            element={
              <RequireUser>
                <Admin />
              </RequireUser>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}

function RequireUser({ children, verified = false }) {
  const { user } = useAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`

  if (!user) {
    return (
      <Navigate
        to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    )
  }

  if (verified && !user.emailVerified) {
    return (
      <Navigate
        to={`/verify-email?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    )
  }

  return children
}