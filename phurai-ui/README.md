# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Auth Setup

Files already prepared in this repo:

- Frontend env: `.env`
- Frontend env template: `.env.example`
- Backend env template: `server/.env.example`
- Backend env file: `server/.env`

Values you still must replace with real credentials:

- `VITE_GOOGLE_CLIENT_ID` in `.env`
- `GOOGLE_CLIENT_ID` in `server/.env`
- `DB_PASSWORD` and other `DB_*` values in `server/.env`
- `SMTP_USER` and `SMTP_PASS` in `server/.env`

Required Google Cloud setup:

1. Create an OAuth 2.0 Client ID of type `Web application`.
2. Add `http://localhost:5173` to `Authorized JavaScript origins`.
3. Copy the generated client id into both frontend and backend env files.

Current behavior:

1. `Sign in with Google` opens the Google account chooser.
2. After the user selects an account, frontend sends the Google access token to `POST /api/google`.
3. Backend validates the token with Google and returns the normalized user.
4. Google sign-in does not go through OTP.
5. Email/password register creates records in `Users`, `UserProfiles`, `UserRoles`, `Customers`, and `OtpTokens`.
6. Email verification activates the account through `/api/verify`.

What is still blocked outside the repo:

- Real Google OAuth cannot work until you provide a real Google client id.
- Real database persistence cannot work until your MySQL server is running and `server/.env` has valid DB credentials.
- Real email sending cannot work until SMTP credentials are valid.
