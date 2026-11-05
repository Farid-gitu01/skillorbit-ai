# SkillOrbit AI 🚀

**AI-Powered Career Development & Opportunity Platform**

SkillOrbit AI connects job seekers, employers, and skill development providers through an intelligent platform that leverages AI to deliver personalised career roadmaps, smart job matching, and upskilling recommendations.

---

## 📌 Project Overview

| Item | Detail |
|---|---|
| **Project Type** | Hackathon – Full-Stack Web Application |
| **Platform** | Web (Desktop & Mobile Responsive) |
| **AI Integration** | Resume parsing, skill gap analysis, job matching |

---

## 🏗️ Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State / Context:** React Context API

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js + TypeScript
- **Database:** MongoDB + Mongoose ODM
- **AI Services:** OpenAI API (planned)

---

## 📁 Folder Structure

```
skillorbit-ai/
├── frontend/               # React + Vite client application
│   ├── src/
│   │   ├── assets/         # Static assets (images, fonts, icons)
│   │   ├── components/     # Reusable UI components
│   │   │   ├── common/     # Shared/generic components
│   │   │   ├── layout/     # Layout wrappers (Navbar, Sidebar, Footer)
│   │   │   └── ui/         # Design-system primitives (Button, Input, Card)
│   │   ├── pages/          # Route-level page components
│   │   │   ├── auth/       # Login, Register, Forgot Password
│   │   │   ├── seeker/     # Job seeker dashboard & profile
│   │   │   ├── employer/   # Employer dashboard & job posts
│   │   │   ├── provider/   # Skill provider dashboard & courses
│   │   │   └── admin/      # Admin panel
│   │   ├── routes/         # React Router route definitions
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API call abstractions (axios instances)
│   │   ├── context/        # React Context providers
│   │   ├── types/          # Shared TypeScript interfaces & types
│   │   └── utils/          # Pure helper functions
│   └── public/
├── backend/                # Express.js REST API server
│   └── src/
│       ├── config/         # DB connection, env config, constants
│       ├── controllers/    # Route handler functions
│       ├── middlewares/    # Auth, error handling, validation middleware
│       ├── models/         # Mongoose schema/model definitions
│       ├── routes/         # Express route declarations
│       ├── services/
│       │   └── ai/         # AI integration services (OpenAI etc.)
│       ├── validators/     # Request body validation schemas
│       ├── utils/          # Utility helpers (token, email, etc.)
│       └── types/          # TypeScript type declarations
└── docs/                   # Project documentation
    ├── architecture/       # System design & architecture diagrams
    ├── api/                # API endpoint documentation
    └── database/           # Database schema & ERD
```

---

## 👥 User Roles

| Role | Description |
|---|---|
| **Job Seeker** | Browse jobs, get AI career guidance, track applications |
| **Employer** | Post jobs, search candidates, AI-powered screening |
| **Skill Provider** | Publish courses, connect learners with opportunities |
| **Admin** | Platform management, analytics, user moderation |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18.x
- MongoDB (local or Atlas)
- npm or yarn

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in the required values.

---

## 📄 License

MIT — built for hackathon demonstration purposes.
