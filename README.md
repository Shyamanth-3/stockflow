# StockFlow

A small multi-tenant inventory app. Each user signs up with their own organization, manages its products and stock, and sees a dashboard with inventory totals and low-stock items.

**Live app:** https://stockflow-n9cp.onrender.com

The live app runs on Render's free tier, which sleeps when idle. The first visit after a quiet period can take up to a minute to load. After that it responds normally.

## Features

- Sign up, log in and log out, with a new organization created at signup
- Add, edit, delete and search products
- Adjust stock with a `+/- units` control and an optional note
- Dashboard with total products, total units and low-stock items
- A default low-stock threshold per organization, used when a product has none of its own
- All data is scoped to the logged-in user's organization

## Tech stack

| Part | Choice |
|---|---|
| Frontend | React (Vite), React Router, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL on Neon, using Prisma |
| Auth | bcrypt password hashes, JWT in an httpOnly cookie |
| Hosting | One Render web service, with Express serving the React build |

## Run it locally

You need Node.js 22.9 or newer and a PostgreSQL database. A separate Neon branch works well, so local work never touches production.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `server/.env` and fill it in:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Pooled connection string, used by the running app |
   | `DIRECT_URL` | Direct connection string, used by migrations. With Neon, this is the same string without `-pooler` |
   | `JWT_SECRET` | A long random value (see below) |
   | `PORT` | Optional, defaults to 3001 |

   To generate a secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

3. Create the tables:

   ```bash
   npx -w server prisma migrate deploy
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:5173.

## Testing

```bash
npm test
```

This starts its own server on a free port and removes its test data afterwards. It covers tenant isolation, login requirements, signup rules, sessions, rate limits, product validation, stale edits and concurrent stock adjustments. It needs a working `server/.env`, so point that at a development database.

A Postman collection with pass/fail checks for the whole API is in `postman/StockFlow.postman_collection.json`. Import it and click **Run**, keeping the default order, because the requests depend on each other. It leaves test accounts behind, so use it against a development database.

## Deploying to Render

Create a web service from this repo with these settings:

| Setting | Value |
|---|---|
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Environment variables | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` |

`npm run build` builds the React app, generates the Prisma client and applies any new migrations to the database in `DIRECT_URL`. The new migrations run while the previous version is still serving, so they need to stay compatible with it.

## Key decisions

- **Tenant isolation:** product queries go through `productsFor(organizationId)` in `server/src/tenant.js`, which adds the organization filter to every query. The organization always comes from the logged-in user, never from the request.
- **Sessions:** `requireAuth` checks the database on each request, so deleted accounts lose access immediately. Logging out increases the user's `tokenVersion`, which also ends their sessions on other devices.
- **Stock changes:** stock adjustments use one atomic database update, so simultaneous changes cannot take stock below 0. The edit form sends the `updatedAt` value it loaded, and the API rejects the save if the product has changed since.
- **Low-stock rule:** a product is low when its quantity is at or below its own threshold, or the organization's default if it has none. A threshold of 0 is treated as a real value.

### Additions beyond the PRD

- Passwords must include a letter and a number
- Organization names are unique, ignoring capitals, extra spaces and invisible characters
- Rate limits in production: 10 failed logins per email and IP, 100 failed logins per IP (both per 15 minutes), and 30 signups per IP per hour
- The product list is paginated at 50 per page, and the dashboard lists the 100 lowest low-stock items

## Known limitations

- **Password reset:** as the PRD allows, there is no reset flow. To reset one manually, hash a new password and update the row, which also ends existing sessions:

  ```sql
  UPDATE "User"
  SET "passwordHash" = '<new bcrypt hash>', "tokenVersion" = "tokenVersion" + 1
  WHERE "email" = '<email>';
  ```

- **Existing emails and organization names:** signup says when one is already taken, so these can be discovered. Hiding this would need email verification, which is out of scope.
- **Look-alike organization names:** characters from other alphabets that look identical, such as a Cyrillic `а`, count as different names.
- **Rate limits:** the counters are kept in memory, so they reset on restart and assume one server instance.
- **Stock notes:** only the latest note is kept, because the PRD excludes full stock history.
- **Search:** it matches anywhere in the name or SKU without a dedicated search index, so it would slow down with very large catalogs.
