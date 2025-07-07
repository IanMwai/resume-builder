# Resume Builder — LaTeX + AI

A fun side project built to reduce the suffering manual resume edits impose on me.

 TLDR. This is a React-based Resume Builder designed to help users efficiently create, edit, and organize resumes — especially LaTeX-based ones. It uses Google Gemini AI to intelligently tailor resume content to job descriptions and Firebase for secure authentication and cloud storage.

---

## Features

- User Authentication  
  Sign up, log in, reset passwords — all powered by Firebase Auth.

- LaTeX Resume Upload & Editing  
  Upload `.tex` files or paste LaTeX directly into the editor.

- AI-Powered Resume Enhancement  
  Use Google’s Generative AI to reword, restructure, or refine your resume based on the job description.

- Saved Resumes  
  Save, view, and manage previous resumes in your personal dashboard.

- Change Summary + Match Score  
  After AI processing, see what changed and how well your resume matches the job.

- Download Options  
  Download your resume in `.tex` or `.pdf` formats.

---

## Tech Stack

| Area            | Tool                          |
|-----------------|-------------------------------|
| Frontend        | React, Tailwind CSS           |
| Routing         | React Router DOM              |
| AI Integration  | Google Gemini (`@google/generative-ai`) |
| Auth & Storage  | Firebase Auth + Firestore     |
| PDF Generation  | (Planned) Node backend w/ `latex` |
| Build Tool      | Create React App              |
| Hosting         | TBD (e.g., Vercel, Render)    |

---

## AI Prompting

The app constructs detailed prompts combining your LaTeX resume and pasted job description, asking Gemini to reformat and align the resume content while maintaining LaTeX structure.

---

## Project Structure

```bash
resume-builder/
├── public/
├── src/
│   ├── components/       # Navbar, buttons, modals
│   ├── pages/            # Login, Signup, AppMain, Account, Resumes
│   ├── App.jsx           # Main app + routing
│   ├── firebase.js       # Firebase init
│   └── index.css         # Tailwind CSS
├── tailwind.config.js
├── postcss.config.js
└── package.json

git clone https://github.com/IanMwai/resume-builder.git
cd resume-builder
