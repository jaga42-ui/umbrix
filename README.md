# HIKARI - MVP

HIKARI is a minimalist, premium career discovery platform designed for high performers. This MVP includes a Daily Discovery Feed and a Kanban-style Application Tracker, built with a modern tech stack.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion
- **Backend API**: Node.js (via Next.js Server Components / API Routes)
- **Database**: MongoDB (Mongoose)
- **Auth**: Firebase Authentication

## Getting Started

### 1. Environment Variables

Create a `.env.local` file in the root of the project with the following variables:

```env
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

*Note: The application will run with dummy data on the UI and a mocked auth state if Firebase is not fully configured, but `MONGODB_URI` is required for the ingestion script to persist data.*

### Authentication & API security

When Firebase is configured (a real `NEXT_PUBLIC_FIREBASE_PROJECT_ID`), all `/api/*` data routes require a valid Firebase ID token, sent automatically by the client as an `Authorization: Bearer <token>` header. The server verifies the token against Google's public signing certificates and derives the user id from it — client-supplied `userId` values are ignored, so a user can only ever read or mutate their own data.

This verification uses only the **public** project ID; **no Firebase service-account key is required**. If Firebase is left unconfigured (placeholder values), the app falls back to demo mode and skips token enforcement.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

Start the Next.js dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Data Ingestion Script

The project includes a standalone Node.js script that fetches job postings from the public Greenhouse API, standardizes them into the Mongoose schema, and applies a heuristic scam filter.

### Running the Script

You can run the ingestion script locally. It will read from `scripts/companies.json` and ingest jobs.

```bash
# Run the ingestion script
node scripts/ingest-jobs.js
```

If `MONGODB_URI` is not set in `.env.local`, the script will run in a **dry-run mode**, fetching and filtering jobs but skipping the database insertion.

### Nightly Automation (GitHub Actions)

[`.github/workflows/ingest-jobs.yml`](.github/workflows/ingest-jobs.yml) runs the ingestion script every night at 00:00 UTC (5:30 AM IST), so the feed is refreshed before users check it in the morning. It's free — this is a public repo, so GitHub Actions minutes are unrestricted.

To enable it, add the database connection as a repository secret (**Settings → Secrets and variables → Actions → New repository secret**):

- `MONGODB_URI` — the same connection string used in `.env.local`

You can also trigger a run manually from the **Actions** tab (`workflow_dispatch`) without waiting for the schedule.

## Project Structure

- `src/app/` - Next.js App Router pages (`/`, `/feed`, `/tracker`)
- `src/components/` - Reusable UI components (JobCard, KanbanBoard, AuthProvider)
- `src/lib/` - Shared utilities and Firebase configuration
- `src/models/` - Mongoose schemas (Job.ts)
- `scripts/` - Standalone data ingestion scripts
