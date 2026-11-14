# Gigspot.in

Free-first marketplace: clients post hiring requests, freelancers publish services, contact happens in private chat.

## Run

```bash
npm install
npm run dev        # local
npm run build      # production build -> dist/
npm test
```

Firebase config comes from `.env` (`VITE_FIREBASE_*`). Never commit `.env` or any service-account key.

## Deploy Firebase rules + indexes (required after every change to these files)

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

No Cloud Functions are used, so the free Spark plan is enough.

## Data

| Collection | Purpose |
| --- | --- |
| `users/{uid}` | Profile: name, email, photo, provider, emailVerified, timestamps. **No passwords** – Firebase Authentication stores those as salted hashes. |
| `jobs`, `skills` | Hiring requests (live instantly) and services (reviewed unless auto-approve is on) |
| `chats/{id}/messages` | Private conversations (participants only) |
| `siteSettings/main` | Announcement banner, auto-approve switch |
| `admins/{uid}` | Marks an administrator (create by hand in the Firebase Console) |
| `adminPrefs/{uid}` | Each admin's dashboard customization |
| `adminAudit` | Append-only log of every admin action |

## Admin dashboard

Open `/admin` while signed in. To become an admin: Firebase Console → Firestore → create collection `admins` → add a document whose **ID is your UID** (shown on the access-denied screen). Refresh.