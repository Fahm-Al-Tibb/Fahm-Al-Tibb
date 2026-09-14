# Fahm Al-Tibb — Mobile Full-Stack Edition

Mobile-first oral and practical revision bank built from the supplied question-bank workbook.

## Local run
1. Install Node.js 18+.
2. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (minimum 12 characters).
3. Run `npm start`.
4. Open `http://localhost:3000`.

## Deployment
This repository is configured for a Render Node.js Web Service.
- Build: `npm install`
- Start: `npm start`
- Health: `/api/me`
- Free Render web services are suitable for testing/hobby use but can sleep after inactivity and have an ephemeral filesystem.

## Accounts
New registrations are pending until approved by the administrator. Approved users can access the oral/practical banks, card mode, revision tracking, mistake log, and saved state.

## Data
The source workbook contains 70 cards, 980 oral entries, and 630 practical entries (1,610 total). The question bank is bundled with the application.

## Production note
For durable user accounts and progress, migrate the JSON user store to a managed database such as Postgres/Supabase before treating this as a production system.
