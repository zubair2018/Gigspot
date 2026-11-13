import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getSavedJobs,
  getSavedSkills,
} from '../firebase/db'
import JobCard from '../components/JobCard'

export default function SavedJobs() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState([])
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadSavedListings() {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const [savedJobs, savedSkills] = await Promise.all([
        getSavedJobs(user.uid),
        getSavedSkills(user.uid),
      ])

      setJobs(savedJobs)
      setSkills(savedSkills)
    } catch (error) {
      console.error('Saved listings load error:', error)
      setError('Unable to load your saved listings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSavedListings()
  }, [user])

  const total = useMemo(() => {
    return jobs.length + skills.length
  }, [jobs.length, skills.length])

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{ background: 'var(--cream)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1
              className="font-black text-3xl"
              style={{
                fontFamily: '"Playfair Display", serif',
                color: 'var(--forest)',
              }}
            >
              Saved Listings
            </h1>

            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              {loading
                ? 'Loading saved listings...'
                : `${total} saved listing${total !== 1 ? 's' : ''}`}
            </p>
          </div>

          <button onClick={() => navigate('/')} className="btn-primary">
            Browse Gigs →
          </button>
        </div>

        {error && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Loading...
          </p>
        ) : total === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl">🔖</p>

            <h2
              className="font-black text-xl mt-4"
              style={{
                fontFamily: '"Playfair Display", serif',
                color: 'var(--forest)',
              }}
            >
              Nothing saved yet
            </h2>

            <p
              className="text-sm mt-2 mb-6"
              style={{ color: 'var(--muted)' }}
            >
              Save jobs and skill providers you want to revisit later.
            </p>

            <button onClick={() => navigate('/')} className="btn-primary">
              Browse Gigs →
            </button>
          </div>
        ) : (
          <>
            <SavedSection
              title="Saved Skill Providers"
              items={skills}
              emptyMessage="You have not saved any skill providers."
              onRefresh={loadSavedListings}
            />

            <SavedSection
              title="Saved Jobs and Gigs"
              items={jobs}
              emptyMessage="You have not saved any jobs."
              onRefresh={loadSavedListings}
            />
          </>
        )}
      </div>
    </div>
  )
}

function SavedSection({
  title,
  items,
  emptyMessage,
  onRefresh,
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2
          className="font-black text-xl"
          style={{
            fontFamily: '"Playfair Display", serif',
            color: 'var(--forest)',
          }}
        >
          {title}
        </h2>

        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-7 text-sm"
          style={{
            background: '#fff',
            border: '1px solid rgba(4,50,34,0.08)',
            color: 'var(--muted)',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <JobCard
              key={item.id}
              job={item}
              onSaveToggle={onRefresh}
            />
          ))}
        </div>
      )}
    </section>
  )
}