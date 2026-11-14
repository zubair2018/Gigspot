import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
} from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from '../firebase/config'
import { CATEGORIES } from '../shared/constants'

// All admin operations talk to Firestore directly. Security is enforced by
// firestore.rules (isAdmin() = custom claim OR admins/{uid} document).

const mapDocs = snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
const count = async q => (await getCountFromServer(q)).data().count
const colRef = name => collection(db, name)

// ───────────── dashboard ─────────────
export async function getOverview() {
  const jobs = colRef('jobs')
  const skills = colRef('skills')
  const users = colRef('users')

  const [
    jobsTotal, jobsLive, jobsSuspended,
    skillsTotal, skillsPending, skillsLive, skillsRejected, skillsSuspended,
    usersTotal, usersBanned,
    jobsByCategory, skillsByCategory,
    recentUsersSnap, pendingSnap, auditSnap,
  ] = await Promise.all([
    count(query(jobs)),
    count(query(jobs, where('status', '==', 'published'))),
    count(query(jobs, where('status', '==', 'suspended'))),
    count(query(skills)),
    count(query(skills, where('status', '==', 'pending_review'))),
    count(query(skills, where('status', '==', 'published'))),
    count(query(skills, where('status', '==', 'rejected'))),
    count(query(skills, where('status', '==', 'suspended'))),
    count(query(users)),
    count(query(users, where('banned', '==', true))),
    Promise.all(CATEGORIES.map(c => count(query(jobs, where('category', '==', c))))),
    Promise.all(CATEGORIES.map(c => count(query(skills, where('category', '==', c))))),
    getDocs(query(users, orderBy('createdAt', 'desc'), limit(300))),
    getDocs(query(skills, where('status', '==', 'pending_review'), orderBy('createdAt', 'desc'), limit(6))),
    getDocs(query(colRef('adminAudit'), orderBy('createdAt', 'desc'), limit(8))),
  ])

  return {
    jobs: { total: jobsTotal, live: jobsLive, suspended: jobsSuspended },
    skills: { total: skillsTotal, pending: skillsPending, live: skillsLive, rejected: skillsRejected, suspended: skillsSuspended },
    users: { total: usersTotal, banned: usersBanned },
    categories: CATEGORIES.map((name, i) => ({ name, jobs: jobsByCategory[i], skills: skillsByCategory[i] })),
    recentUsers: mapDocs(recentUsersSnap),
    pending: mapDocs(pendingSnap),
    activity: mapDocs(auditSnap),
  }
}

// ───────────── lists (cursor pagination) ─────────────
export async function listListings(collectionName, { status = 'all', cursor = null, pageSize = 25 } = {}) {
  if (!['jobs', 'skills'].includes(collectionName)) throw new Error('Unsupported collection.')
  const constraints = []
  if (status !== 'all') constraints.push(where('status', '==', status))
  constraints.push(orderBy('createdAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))

  const snapshot = await getDocs(query(colRef(collectionName), ...constraints))
  return {
    items: mapDocs(snapshot),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.size === pageSize,
  }
}

export async function listUsers({ cursor = null, pageSize = 50 } = {}) {
  const constraints = [orderBy('createdAt', 'desc')]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))

  const snapshot = await getDocs(query(colRef('users'), ...constraints))
  return {
    items: mapDocs(snapshot),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.size === pageSize,
  }
}

export async function listAudit({ cursor = null, pageSize = 50 } = {}) {
  const constraints = [orderBy('createdAt', 'desc')]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))

  const snapshot = await getDocs(query(colRef('adminAudit'), ...constraints))
  return {
    items: mapDocs(snapshot),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.size === pageSize,
  }
}

export async function getUserStats(uid) {
  const [jobs, skills] = await Promise.all([
    count(query(colRef('jobs'), where('postedBy.uid', '==', uid))),
    count(query(colRef('skills'), where('postedBy.uid', '==', uid))),
  ])
  return { jobs, skills }
}

// ───────────── moderation ─────────────
function audit(batch, actor, entry) {
  batch.set(doc(colRef('adminAudit')), {
    ...entry,
    actorUid: actor.uid,
    actorEmail: actor.email || '',
    createdAt: serverTimestamp(),
  })
}

function listingPatch(collectionName, listing, action, reason) {
  const now = serverTimestamp()
  const base = { moderatedBy: auth.currentUser?.uid || '', moderatedAt: now, updatedAt: now }

  switch (action) {
    case 'approve':
      return { ...base, status: 'published', rejectionReason: '', publishedAt: now }
    case 'reject':
      return { ...base, status: 'rejected', rejectionReason: reason }
    case 'suspend':
      return { ...base, status: 'suspended', statusBeforeSuspension: listing.status, moderationReason: reason }
    case 'restore': {
      let restore = listing.statusBeforeSuspension || (collectionName === 'jobs' ? 'published' : 'pending_review')
      if (collectionName === 'skills' && restore === 'active') restore = 'pending_review'
      return { ...base, status: restore, statusBeforeSuspension: deleteField(), moderationReason: deleteField() }
    }
    case 'feature':
      return { ...base, featured: true }
    case 'unfeature':
      return { ...base, featured: false }
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

// Applies one action to one or many listings in a single atomic batch (max 200).
export async function moderateListings(collectionName, listings, action, reason = '') {
  const actor = auth.currentUser
  if (!actor) throw new Error('Not signed in.')
  if (!listings.length) return
  if (['reject', 'suspend'].includes(action) && !reason.trim()) throw new Error('A reason is required.')

  const batch = writeBatch(db)
  for (const listing of listings.slice(0, 200)) {
    batch.update(doc(db, collectionName, listing.id), listingPatch(collectionName, listing, action, reason.trim()))
    audit(batch, actor, {
      action: `listing_${action}`,
      collectionName,
      listingId: listing.id,
      listingTitle: listing.title || '',
      reason: reason.trim(),
      previousStatus: listing.status || '',
    })
  }
  await batch.commit()
}

export async function deleteListing(collectionName, listing) {
  const actor = auth.currentUser
  const batch = writeBatch(db)
  batch.delete(doc(db, collectionName, listing.id))
  audit(batch, actor, {
    action: 'listing_deleted',
    collectionName,
    listingId: listing.id,
    listingTitle: listing.title || '',
    reason: '',
    previousStatus: listing.status || '',
  })
  await batch.commit()
}

// ───────────── users ─────────────
export async function setUserBanned(user, banned, reason = '') {
  const actor = auth.currentUser
  if (banned && !reason.trim()) throw new Error('A reason is required to ban a user.')

  const batch = writeBatch(db)
  batch.update(doc(db, 'users', user.id), {
    banned,
    bannedReason: banned ? reason.trim() : '',
    moderatedBy: actor.uid,
    moderatedAt: serverTimestamp(),
  })
  audit(batch, actor, {
    action: banned ? 'user_banned' : 'user_unbanned',
    targetUid: user.id,
    targetEmail: user.email || '',
    reason: reason.trim(),
  })
  await batch.commit()
}

export async function saveUserNote(user, note) {
  await setDoc(doc(db, 'users', user.id), {
    adminNote: note.slice(0, 1000),
    moderatedBy: auth.currentUser.uid,
    moderatedAt: serverTimestamp(),
  }, { merge: true })
}

// Passwords can never be read. If a user is locked out, the admin sends a reset email.
export async function sendUserPasswordReset(email) {
  await sendPasswordResetEmail(auth, email)
  const batch = writeBatch(db)
  audit(batch, auth.currentUser, { action: 'user_password_reset_sent', targetEmail: email, reason: '' })
  await batch.commit()
}

export async function deleteUserProfile(user) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', user.id))
  audit(batch, auth.currentUser, {
    action: 'user_profile_deleted',
    targetUid: user.id,
    targetEmail: user.email || '',
    reason: '',
  })
  await batch.commit()
}

// ───────────── settings & preferences ─────────────
export async function saveSiteSettings(settings) {
  const actor = auth.currentUser
  const batch = writeBatch(db)
  batch.set(doc(db, 'siteSettings', 'main'), {
    ...settings,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  }, { merge: true })
  audit(batch, actor, { action: 'settings_updated', reason: '' })
  await batch.commit()
}

export async function getAdminPrefs(uid) {
  try {
    const snapshot = await getDoc(doc(db, 'adminPrefs', uid))
    return snapshot.exists() ? snapshot.data() : null
  } catch {
    return null
  }
}

export function saveAdminPrefs(uid, prefs) {
  return setDoc(doc(db, 'adminPrefs', uid), { ...prefs, updatedAt: serverTimestamp() })
}