# Attendance Manager for Schools

A complete, production-ready school attendance management web app built with React, Vite, and JavaScript. It works **online** (Firebase Authentication + Firestore) or **fully offline** (IndexedDB via Dexie) — and the two profiles never merge automatically.

Developed by **Jeevan Varghese** · [https://itsjeevanvarghese.web.app](https://itsjeevanvarghese.web.app)

---

## Features

- **Two profiles** — authorized online profiles use Firestore with persistent offline caching; the optional device-only Dexie profile remains separate.
- **Complete authentication** — Google, email/password sign-in and sign-up, email verification when required, password reset, and Access Manager approval requests.
- **Canonical authorization** — online data requires an active `accessUsers/{uid}` record with this Firebase Web App ID enabled; Firestore rules enforce the same permission.
- **Classes** — create, rename, delete (with cascade), select active, set a device-local default class.
- **Students** — roll number + name per class, natural sort, search, move between classes (with conflict checks), CSV import/export/blank template, duplicate validation.
- **Today's Absentees** — circular roll-number buttons, draft-only selection, "Send to WhatsApp" that saves first and only opens WhatsApp after the save confirms.
- **Holiday Manager** — month grid, calendar with draft holidays, global Saturday/Sunday settings, per-date weekend overrides (working-day exceptions).
- **Attendance Report** — per-student month calendar, draft absences, Save Attendance button, cumulative statistics (working days, leaves, attendance %).
- **Full-class PDF** — A4 portrait, 5 month-boxes per row, dynamic box height, smart student pagination, all months in the academic year.
- **Master Backup & Restore** — one JSON file for the active profile, with Replace or Merge modes. Backup JSON is validated as untrusted.
- **Light / Dark theme** — persistent, switchable in Settings.
- **Modern responsive UI** — sidebar on desktop, navigation drawer on mobile, toasts, confirmation dialogs, loading states, empty states, accessible labels, focus states, subtle animations.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 |
| Build tool | Vite 5 |
| Language | JavaScript (JSX) |
| Online auth + database | Firebase Authentication + Cloud Firestore |
| Offline storage | Firestore persistent IndexedDB cache + Dexie device-only profile |
| PDF generation | jsPDF |
| Icons | lucide-react |
| Styling | Tailwind CSS |
| Hosting config | Firebase Hosting (`firebase.json`) |

---

## Getting Started

### 1. Install and run locally

```bash
npm install
npm run dev
```

The dev server starts automatically in this environment. On your own machine, run `npm run dev` and open the printed URL.

### 2. Build for production

```bash
npm run build
```

The output is written to `dist/`.

### 3. Configure Firebase (for online mode)

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com).
2. Add a **Web app** to the project and copy the config values.
3. Enable **Authentication → Sign-in method → Email/Password** and **Google**.
4. Register the app in the shared Firebase Access Manager. Account creation never grants application access.
5. Copy `.env.example` to `.env` and fill in the values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

6. Deploy the Firestore security rules (see `firestore.rules`):

```bash
firebase deploy --only firestore:rules
```

> Offline mode works without any Firebase configuration.

### 4. Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` is already configured to serve `dist/` and use `firestore.rules`.

---

## Firestore Security Rules

The rules in `firestore.rules` require the same canonical Access Manager permission used by the client:

```
accessUsers/{uid}.active == true
accessUsers/{uid}.apps[firebaseAppId] == true
appRegistry/{firebaseAppId}.active == true

attendanceManagerUsers/{uid}/classes/{classId}
attendanceManagerUsers/{uid}/students/{studentId}
attendanceManagerUsers/{uid}/attendance/{attendanceId}
attendanceManagerUsers/{uid}/holidays/{holidayId}
attendanceManagerUsers/{uid}/holidayOverrides/{overrideId}
attendanceManagerUsers/{uid}/settings/app
```

Access Manager records remain server-only. Shared-project rules for other applications are preserved.

---

## Project Structure

```
src/
  components/
    layout/      App shell, sidebar, mobile drawer
    ui/          Button, Modal, ConfirmDialog, Spinner, EmptyState, Input, Select, Calendar
  pages/         StartPage, ClassesPage, StudentsPage, TodayAbsencesPage,
                 HolidayManagerPage, AttendanceReportPage, SettingsPage
  services/
    firebase/    config.js, auth.js, access.js, sync.js
    firestore/   onlineRepo.js
    indexeddb/   database.js, offlineRepo.js
    backup/      backup.js
    pdf/         classReport.js
  repositories/  repo.js  (unified, routes to online/offline)
  context/       AuthContext, ThemeContext, ToastContext, NavContext, DataContext
  utils/         date, csv, ids, sort, logger, whatsapp, attendance
  validation/    backup.js
```

UI components never talk to Firestore or Dexie directly — everything goes through the repository layer.

---

## Offline Data (Dexie / IndexedDB)

Database name: `attendance-manager`

| Store | Schema |
|---|---|
| classes | `id, name` |
| students | `id, classId, rollNumber, [classId+rollNumber]` |
| attendance | `id, studentId, classId, date, [studentId+date]` |
| holidays | `id, date` |
| holidayOverrides | `id, date` |
| settings | `id` |

> **Primary keys are never changed after release.** Schema evolution only adds stores/indexes by incrementing the Dexie version number. The database is never deleted as a recovery mechanism.

The default-class, theme, and last successful per-UID authorization marker are stored device-locally. No passwords or Firebase credentials are stored in IndexedDB. The authorization marker is accepted only while offline; reconnecting revalidates Access Manager permission before Firestore networking and queued-write sync are enabled.

Authorized online profiles use Firestore's persistent IndexedDB cache. Writes made while disconnected are queued with stable document IDs, survive browser restarts, and sync after authorization is revalidated. Firestore resolves same-document conflicts with its last-write-wins behavior; merge writes avoid replacing unrelated fields. A service worker caches only the same-origin app shell and static assets, never Firebase API responses.

---

## Master Backup Format

A backup is a single JSON file named `attendance-master-backup-YYYY-MM-DD.json`. It contains:

- `app`, `formatVersion`, `schemaVersion`, `appVersion`
- `createdAt`, `sourceProfile` (`online` / `offline`)
- `data`: classes, students, attendance, holidays, holidayOverrides, settings
- `counts`: per-collection record counts

It **never** includes passwords, Firebase tokens, API secrets, environment variables, or service-account credentials.

### Restore modes

- **Replace Current Data** (recommended) — validates the backup, then replaces only the active profile's data. Uses a Dexie transaction offline and Firestore batches online.
- **Merge With Current Data** — keeps current records, imports non-conflicting ones, and remaps IDs for conflicting classes/students/attendance so nothing is silently overwritten.

Backups are treated as untrusted and all fields/references are validated before restore.

---

## Testing Instructions

### Offline mode
1. Click **Work Offline** on the start page.
2. Go to Settings → set an academic year (e.g. 2024-06-01 to 2025-05-31) and save.
3. Create a class, add students (or import a CSV).
4. Mark today's absentees and click **Send to WhatsApp** — confirm the list saves and WhatsApp opens.
5. Add holidays in Holiday Manager and save.
6. Refresh the page or restart the browser — all data should persist.
7. Generate a class PDF from Attendance Report.

### Online mode (requires Firebase config)
1. Sign in with a Firebase user.
2. Repeat steps 2–7 above.
3. Open an incognito window, sign into the same account — all data should appear.
4. Sign out, then sign back in — deleted classes/students/holidays must not return.

### Backup & Restore
1. In Settings → Create Master Backup — a JSON file downloads with a summary.
2. Switch to the other mode (offline ↔ online).
3. Restore the backup with Replace or Merge and confirm the data appears.

### Theme
1. Toggle Light/Dark in Settings — the preference persists across refreshes.

---

## App Icon

A custom rounded-square icon (attendance register + student silhouettes + check mark, blue/teal with a warm accent) is generated in `public/icons/`:

- `icon-1024.png` — master
- `icon-512.png`, `icon-192.png` — PWA
- `icon-maskable-512.png` — maskable PWA
- `apple-touch-icon.png` — Apple touch
- `favicon.png` + `icon.svg` — favicon

The web manifest is at `public/manifest.webmanifest`.

---

## License

Developed by Jeevan Varghese. [https://itsjeevanvarghese.web.app](https://itsjeevanvarghese.web.app)
