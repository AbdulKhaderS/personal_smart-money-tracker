# Sharif Lala – Smart Money Trac

Smart Money Tracker web app built with Google AI Studio, React, and Firebase to log daily expenses, view summaries, and export data for personal finance tracking.

## Features
- Google Sign-In authentication (Firebase Auth)
- Add, edit, and delete income and expense records
- Dashboard with recent transactions and simple charts
- Per-user data storage secured with Firebase Security Rules
- (Planned) Export expenses to Excel/CSV

## Tech Stack
- React + Vite (frontend)
- Firebase Authentication
- Cloud Firestore for data storage
- Google AI Studio generated starter code

## How to Run Locally
1. Clone or download this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file or Firebase config as required and add your Firebase project keys.
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open the shown `http://localhost:` URL in your browser and sign in with Google.

## Notes
- Each user only sees their own financial records (user-based Firestore rules).
- This project is for learning and personal finance tracking.
```
