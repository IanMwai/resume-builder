# Resume Builder – LaTeX + AI [Technically an attempt at Vibe coding]

A fun side project I did to automate the tedious task of manually editing resumes, especially those crafted in LaTeX. This React-based web application lets you easily rebuild, manage, and store resumes, leveraging Firebase for authentication and cloud storage and Google's Gemini AI to intelligently tailor resume content to job descriptions. I built it from scratch using Gemini CLI - when I conceived this idea, it had just come out and I wanted to test its capability.

---

## What the App Does

**Core features and user workflow:**

- **User Authentication**  
  - Sign up for a new account (`Signup.jsx`).  
  - Log in to an existing account (`Login.jsx`).  
  - Reset forgotten passwords securely (`ForgotPassword.jsx`).

- **Account Management**  
  - Dedicated account management page (`Account.jsx`) for user settings and profile information.

- **Resume Management**  
  - View and manage your resumes in a private dashboard (`Resumes.jsx`).  
  - Securely create, update, and delete resumes stored privately in Firestore.

- **Resume Editing Workspace**  
  - A primary workspace (`AppMain.jsx`) where users actively upload, edit, or create resumes.  
  - AI-driven enhancements that intelligently adjust resume content to match job descriptions.

- **Consistent Structure and Navigation**  
  - Uniform layout and navigation using `Layout.jsx` and `Navbar.jsx` across all pages.

---

## Features at a Glance

- **Authentication**  
  Secure user authentication system powered by Firebase Auth.

- **LaTeX Resume Handling**  
  Upload `.tex` files or paste LaTeX directly into the built-in editor.

- **AI-Enhanced Editing**  
  Utilize Google Gemini AI to refine resumes based on targeted job descriptions.

- **Saved Resumes Dashboard**  
  Organize and manage your saved resumes seamlessly.

- **Match Analysis**  
  Review a summary of changes and receive a resume-job compatibility score after AI adjustments.

- **Download **  
  Download resumes as a `.tex` file.

---

## Technologies & Tools

| Area                 | Tools                                       |
|----------------------|---------------------------------------------|
| Frontend             | React, Tailwind CSS                          |
| Routing              | React Router DOM                             |
| AI Integration       | Google Gemini (`@google/generative-ai`)      |
| Authentication       | Firebase Authentication                      |
| Database             | Firebase Firestore                           |
| PDF Generation       | (Planned) Node backend w/ LaTeX              |
| Build System         | Create React App                             |
| Hosting & Deployment | Firebase Hosting, GitHub Actions             |
| Development Env.     | Node.js, npm                                 |

---

## Project Structure

```
resume-builder/
├── public/
├── src/
│   ├── components/       # UI components (Navbar, buttons, modals)
│   ├── pages/            # Login, Signup, AppMain, Account, Resumes
│   ├── App.jsx           # Main app and routing
│   ├── firebase.js       # Firebase initialization
│   └── index.css         # Tailwind CSS imports
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Our Development Process

### Issue 1: `(auth/invalid-api-key)` on Deployed App
- **Cause**: GitHub Actions didn't have access to environment variables due to `.env` exclusion (security practice).
- **Resolution**: Integrated GitHub Actions Secrets, securely passing environment variables into the deployment process by updating the workflow YAML (`.github/workflows/firebase-hosting-merge.yml`).

### Issue 2: Proactive Security Enhancement
- **Potential Vulnerability**: Firestore rules previously allowed any authenticated user to access others' profile data.
- **Resolution**: Strengthened security rules to restrict data access exclusively to the respective authenticated user:
```firestore
allow read, write: if request.auth != null && request.auth.uid == userId;
```

## Setup Instructions

**1. Clone the repository**

```bash
git clone https://github.com/IanMwai/resume-builder.git
cd resume-builder
```

**2. Install Dependencies**

```bash
npm install
```

**3. Configure Environment Variables**

Create a `.env` file at the root of your project and add your Firebase and Google Gemini credentials:

```
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_GEMINI_API_KEY=your-gemini-api-key
```

**4. Run the Development Server**

```bash
npm start
```

Your application will now be accessible at [http://localhost:3000](http://localhost:3000).

