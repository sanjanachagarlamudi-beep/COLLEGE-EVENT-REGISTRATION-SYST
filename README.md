# CampusEvents — College Event Registration System

CampusEvents is a responsive full-stack web app where students discover upcoming college events, register for a place, and manage their registrations. An administrator can create, edit, and delete events and see registration counts.

## 1. Problem and objectives

College event information is often scattered across posters, class groups, and announcements. CampusEvents centralizes event details and registration in one simple place.

### Users and roles
- **Student:** create an account, browse/search/filter upcoming events, register once per event, view registrations, and cancel before an event starts.
- **Administrator:** create and update events, set capacity, view registration counts, and delete events.

Admin accounts are provisioned from the backend command; public signup can only create student accounts.

## 2. Features
- Responsive HTML/CSS/Vanilla JavaScript interface.
- Express REST API and persistent Supabase PostgreSQL database.
- Password hashes using bcryptjs; signed, HTTP-only session cookie.
- Server-side role checks, input validation, authentication rate limiting, Helmet security headers.
- Atomic database registration function prevents capacity overflow and duplicate active registrations.
- Search and category filter; event capacity and registration status.
- No paid services or external APIs required.

## 3. Technology stack
- HTML5, CSS3, browser Vanilla JavaScript
- Node.js 20+ and Express 5
- Supabase PostgreSQL, accessed through `@supabase/supabase-js`
- Git and GitHub
- Small backend packages: `bcryptjs` (password hashing), `jsonwebtoken` (signed session token), `cookie-parser`, `helmet`, `express-rate-limit`, `dotenv`.

## 4. Folder structure

```text
college-event-registration-system/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   └── registrations.js
│   ├── middleware/
│   │   └── auth.js
│   ├── scripts/
│   │   └── create-admin.js
│   ├── package.json
│   ├── package-lock.json (created by npm install)
│   ├── .env (create locally; do not commit)
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## 5. Prerequisites and install links
- [Node.js LTS](https://nodejs.org/) (includes npm), version 20 or later
- [Visual Studio Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/downloads)
- A free [Supabase](https://supabase.com/) account

Verify in a new VS Code terminal:
```powershell
node --version
npm --version
git --version
```

## 6. Supabase setup
1. Sign in to Supabase and create a new project. Choose a strong database password and save it securely.
2. Wait until the database is ready.
3. Open **SQL Editor** in the project dashboard.
4. Open `database/schema.sql` in VS Code, copy the complete contents, paste them into the SQL Editor, and click **Run**.
5. Open **Table Editor** and confirm `app_users`, `events`, and `registrations` exist. In SQL Editor you can also run:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' and table_name in ('app_users','events','registrations')
   order by table_name;
   ```
6. In **Project Settings → API Keys** (or the API settings area in your dashboard), copy the Project URL and the server-side `service_role`/secret key. Dashboard labels can vary by Supabase project generation. Keep the privileged key private.

This app implements its own simple account table rather than Supabase Auth. The Express backend hashes passwords and verifies a signed session cookie. RLS is enabled and browser roles have no table policies; the backend uses a server-only service-role key and must enforce every permission. Do not add this privileged key to frontend files.

## 7. Environment configuration
From the project root, create `backend/.env` by copying `backend/.env.example`. Replace the placeholder values:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
JWT_SECRET=PASTE_A_RANDOM_SECRET_HERE
COOKIE_SECURE=false
```

Generate a strong JWT secret in a terminal:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Paste the output as `JWT_SECRET`. Do not share it. `COOKIE_SECURE=false` is for local HTTP development only. Set it to `true` when the app is served over HTTPS in production. `.env.example` documents the variable names; `.env` contains your private local values and must never be committed.

## 8. Install and run
Open VS Code, choose **File → Open Folder**, and open the root `college-event-registration-system` folder. Open **Terminal → New Terminal**.

Install dependencies from the backend directory:
```powershell
cd backend
npm install
```
Create the local `.env` file and apply the SQL schema before starting the server. Then start development mode:
```powershell
npm run dev
```
Expected output:
```text
CampusEvents is running at http://localhost:3000
```
Open [http://localhost:3000](http://localhost:3000). Keep that terminal running while using the site. The health endpoint is [http://localhost:3000/api/health](http://localhost:3000/api/health) and should return `{"status":"ok","service":"CampusEvents API"}`.

### Create the first administrator
1. Add these temporary values to `backend/.env`:
   ```env
   ADMIN_EMAIL=your-admin-email@example.com
   ADMIN_PASSWORD=choose-a-unique-password-at-least-12-characters
   ADMIN_NAME=Campus Administrator
   ```
2. Open a second terminal at the project root and run:
   ```powershell
   cd backend
   npm run create-admin
   ```
3. After the script confirms the admin account is ready, remove `ADMIN_PASSWORD` from `.env` (you may keep `ADMIN_EMAIL`/`ADMIN_NAME` if desired). Log in with the admin email/password on the website.
4. Public signups always get the `student` role. Never promote a user by editing a browser request.

## 9. Architecture
Browser `frontend/app.js` uses `fetch()` to call `/api/...`. Express serves `frontend/` and validates all incoming requests. Protected routes verify the HTTP-only signed cookie, reload the user role from the database, and enforce ownership/administrator checks. Supabase PostgreSQL stores users, events, and registrations. The database function `register_for_event` locks the event row while checking capacity and inserting/reactivating a registration.

## 10. REST API reference

All responses are JSON. Authenticated routes use the `campus_session` HTTP-only cookie automatically set by login/signup. Students cannot use admin endpoints.

| Method | Path | Purpose / body | Access |
|---|---|---|---|
| GET | `/api/health` | Health check | Public |
| POST | `/api/auth/register` | `{ "name", "email", "password" }` | Public; student role only |
| POST | `/api/auth/login` | `{ "email", "password" }` | Public; rate-limited |
| GET | `/api/auth/me` | Current user | Logged in |
| POST | `/api/auth/logout` | Clear session cookie | Public |
| GET | `/api/events` | List upcoming events with counts | Public |
| POST | `/api/events` | Event fields: `title`, `description`, `category`, `venue`, `starts_at`, `capacity` | Admin |
| PATCH | `/api/events/:id` | Same complete event fields | Admin |
| DELETE | `/api/events/:id` | Delete event and its registrations | Admin |
| POST | `/api/events/:id/register` | Register current user for event | Student/admin logged in |
| GET | `/api/registrations/mine` | Current user's registrations | Logged in |
| DELETE | `/api/registrations/:id` | Cancel registration | Owner (or admin); before event starts |

Typical errors: `400` invalid input, `401` missing/expired session, `403` forbidden, `404` missing record/route, `409` duplicate/full/capacity conflict, `500` unexpected server/database problem. Error messages are intentionally generic for unexpected failures.

## 11. Try the application
1. Log in with the administrator account created above.
2. Create an event with a future date/time, category, venue, description, and capacity.
3. Log out. Create a student account with a different email.
4. Find the event, use search/category filter, and click **Register**.
5. Scroll to **My registrations** to verify it appears.
6. Cancel the registration before the event begins.
7. Log back in as admin and check that the registration count changed. Try editing and deleting a test event.

## 12. Testing checklist
- [ ] `GET /api/health` returns HTTP 200 and status `ok`.
- [ ] Create an admin and log in successfully.
- [ ] Student signup succeeds; repeated email signup returns HTTP 409.
- [ ] Wrong password returns HTTP 401 without revealing which field was wrong.
- [ ] Student cannot create/edit/delete events (HTTP 403).
- [ ] Admin can create/edit/delete events.
- [ ] Invalid event title, past date, unsupported category, or capacity outside 1–10,000 is rejected.
- [ ] Student registration appears in My registrations and the event count increments.
- [ ] Re-registering an active registration is rejected; cancelled registration can be reactivated if the event still has capacity.
- [ ] At capacity, the next registration is rejected; database locking prevents overbooking under concurrent requests.
- [ ] A student cannot cancel another student's registration.
- [ ] Search and category filtering work; no-result state is shown.
- [ ] Reload the page: database records remain present.
- [ ] Check the page at desktop and narrow/mobile widths.
- [ ] Log out and verify private endpoints return HTTP 401.
- [ ] Stop Supabase or use an invalid key in a local test copy: UI/API shows a friendly error and the server does not expose stack traces.

No remote database or browser tests are claimed as pre-run; execute this checklist after configuring your own Supabase project.

## 13. Troubleshooting
- **`Missing SUPABASE_URL...` or server exits:** check `backend/.env` exists, variable names are exact, and there are no surrounding quotes/spaces copied into values.
- **`Invalid API key` / database errors:** copy the correct project URL and server-side service-role/secret key from the same Supabase project. Never use a database password as the API key.
- **`password authentication failed for user "postgres"` in Supabase SQL Editor:** this is a dashboard/database connection problem, not a syntax error in `schema.sql`. Open the SQL Editor from the correct project dashboard, verify the project is active, refresh/reopen the editor, and check project status. Do not paste the SQL into a database connection prompt or replace your database password with the service-role key.
- **Port already in use:** set another port such as `PORT=3001` in `.env`, restart the server, and open `http://localhost:3001`.
- **`npm` PowerShell script is blocked:** run `npm.cmd install` and `npm.cmd run dev` in PowerShell, or use Command Prompt. Avoid changing system execution policy just for this project.
- **Admin cannot log in:** ensure the admin script ran successfully against the same Supabase project as the server; check the email spelling and use the password set in `.env` at creation time.
- **404 for page or styles:** start Express and visit `http://localhost:3000`, not by double-clicking `index.html`.
- **Changes do not appear:** save the file, refresh the browser; restart server if backend code changed.

## 14. Security notes and limitations
- Passwords are bcrypt-hashed; session JWT is held in an HTTP-only, SameSite=Lax cookie.
- The API uses Helmet and login/signup rate limiting. Keep dependencies updated and use HTTPS in production.
- This is a student MVP with custom authentication. For production, prefer a mature identity provider, add monitoring, password reset/email verification, audit logs, and stricter deployment configuration.
- The app does not send emails, issue QR tickets, process payments, or provide event check-in; these are possible future improvements.
- The service-role key bypasses RLS. The backend is therefore a trusted boundary: never expose its key, and always enforce authorization in server routes.
- The current RLS setup intentionally provides no direct browser table access. All app data operations go through Express.

## 15. GitHub upload
From the project root:
```powershell
git init
git status
git add .
git status
git commit -m "Build CampusEvents project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```
Replace `YOUR_GITHUB_REPOSITORY_URL` with the HTTPS or SSH URL from your GitHub repository. Create an empty repository on GitHub first. Before `git add .`, verify `backend/.env` and `node_modules/` are ignored and only `backend/.env.example` is included. Never commit database passwords, service-role keys, JWT secrets, real user data, or database exports. If a secret was committed, rotate it immediately; deleting the file or adding it to `.gitignore` does not remove it from Git history.
