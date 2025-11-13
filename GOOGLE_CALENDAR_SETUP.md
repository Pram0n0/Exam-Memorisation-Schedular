# Google Calendar Integration Setup

Follow these steps to enable Google Calendar sync in your Productivity Scheduler:

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top
4. Click "NEW PROJECT"
5. Enter a project name (e.g., "Productivity Scheduler")
6. Click "CREATE"

## Step 2: Enable Google Calendar API

1. Wait for the project to be created (it may take a few seconds)
2. In the Cloud Console, search for "Google Calendar API"
3. Click on "Google Calendar API"
4. Click "ENABLE"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "Credentials" in the left sidebar
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, click "CONFIGURE CONSENT SCREEN" first:
   - Select "External" user type
   - Click "CREATE"
   - Fill in the app name as "Productivity Scheduler"
   - Add your email as support email
   - Click "SAVE AND CONTINUE"
   - Click "ADD OR REMOVE SCOPES"
   - Search for and add: `https://www.googleapis.com/auth/calendar`
   - Click "UPDATE" and then "SAVE AND CONTINUE"
   - Click "SAVE AND CONTINUE" on the next screens
4. Back to Credentials, click "CREATE CREDENTIALS" → "OAuth client ID"
5. Select "Web application" as the application type
6. Under "Authorized redirect URIs", add:
   - `http://localhost:5173`
   - `http://localhost:5174`
   - `http://localhost:3000`
   - **Remove any trailing slashes** (e.g., `http://localhost:5173/` should be `http://localhost:5173`)
7. Click "CREATE"
8. Copy your **Client ID** from the modal that appears

## Step 4: Add Your Client ID to the App

1. Create a `.env` file in the project root (copy from `.env.example`) and set your Client ID:

   ```text
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

2. `Vite` exposes env variables prefixed with `VITE_` via `import.meta.env` in the app. `src/App.jsx` already reads `import.meta.env.VITE_GOOGLE_CLIENT_ID`, so no further code edits are required.

3. Save the `.env` file

## Step 5: Restart the Dev Server

```bash
npm run dev
```

## Usage

1. Create a revision schedule as normal
2. Once confirmed, you'll see a "Sync Cal" button next to each topic in the Saved Subjects section
3. Click "Sync Cal" to start the sync process
4. You'll be prompted to sign in with your Google account (first time only)
5. Grant permission to access your Google Calendar
6. Your revision dates will automatically be added to your primary Google Calendar as all-day events

## Troubleshooting

**"redirect_uri_mismatch" or "invalid_request" error:**
- The redirect URI must match EXACTLY (without trailing slashes)
- If your dev server shows "Port 5173 is in use, trying another one..." and uses 5174, update:
  - Google Cloud Console redirect URIs to `http://localhost:5174`
  - Your local development URL
- Click "Sync Cal" again after updating

**"CORS error" or "Network error":**
- Make sure your Client ID is correct in `App.jsx`
- Ensure your redirect URIs in Google Cloud Console match your development server URL

**"Access denied" error:**
- Make sure you granted calendar permission when signing in
- Try clearing localStorage: Open browser DevTools → Application → Local Storage → Clear all
- Try signing in again

**Revision events not appearing:**
- Check your Google Calendar's primary calendar is visible
- The events are created as all-day events (no specific time)
- Look for events titled "📖 Revise: [Subject] - [Topic]"

## Notes

- The access token is stored in `localStorage` so you won't need to re-authenticate on every sync
- Clear your browser's localStorage if you need to re-authenticate
- Events are created as all-day events on each revision date
- You can edit or delete events directly from Google Calendar
