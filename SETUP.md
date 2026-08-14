# Branch Visit Tracker — Setup Guide

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Setup environment variables
```bash
cp .env.example .env
```
Then edit `.env`:
- `DATABASE_URL` — your MySQL connection string
- `JWT_SECRET` — generate a strong secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

### 3. Run database migrations
```bash
pnpm db:push
```

### 4. Seed the first admin user
```bash
pnpm seed
```
Default credentials: `admin` / `admin123`
> ⚠️ **Change the password immediately after first login!**

### 5. Start development server
```bash
pnpm dev
```
Open http://localhost:3000

---

## User Roles

| Role    | Access                                         |
|---------|------------------------------------------------|
| **admin** | Dashboard, Branches, Managers, Users, Reports |
| **user**  | Check-in, Visit History, Sync                 |

---

## Mobile App (Capacitor)

### Android
```bash
pnpm build
npx cap sync android
# Then open android/ in Android Studio and run
```

### iOS
```bash
pnpm build
npx cap sync ios
# Then open ios/ in Xcode and run
```

---

## Photo Storage

| Mode     | How                                                      |
|----------|----------------------------------------------------------|
| **Local**  | Photos saved in `/uploads` (default, dev only)         |
| **AWS S3** | Set `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in `.env` |

---

## Auth Flow

1. User visits the app → sees login form
2. Enters username + password → `POST /api/auth/login`
3. Server verifies password via PBKDF2, sets httpOnly JWT cookie
4. All subsequent requests authenticated via cookie
5. Logout clears the cookie server-side

---

## Database Schema

Tables: `users`, `managers`, `branches`, `managerBranches`, `visits`, `locationLogs`

Run `pnpm db:push` after any schema changes in `drizzle/schema.ts`.

---

## Scripts

| Script          | Description                            |
|-----------------|----------------------------------------|
| `pnpm dev`      | Start dev server (frontend + backend)  |
| `pnpm build`    | Production build                       |
| `pnpm start`    | Run production build                   |
| `pnpm db:push`  | Push schema changes to DB              |
| `pnpm seed`     | Create initial admin user              |
| `pnpm test`     | Run tests                              |
| `pnpm check`    | TypeScript type check                  |
| `pnpm format`   | Format code with Prettier              |
