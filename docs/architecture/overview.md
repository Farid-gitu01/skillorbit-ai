# Architecture Overview

## System Architecture

SkillOrbit AI follows a standard **client-server** architecture with a React SPA frontend communicating with an Express REST API backend backed by MongoDB.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│              React + TypeScript + Vite + Tailwind CSS           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST API
┌────────────────────────────▼────────────────────────────────────┐
│                   Backend (Node.js / Express)                   │
│                        TypeScript                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Routes    │  │  Controllers │  │    AI Services         │  │
│  │             │→ │              │→ │  (OpenAI / Analysis)   │  │
│  └─────────────┘  └──────┬───────┘  └────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │                    Mongoose Models                        │   │
│  └───────────────────────┬──────────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                         MongoDB Atlas                           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend build | Vite | Fast HMR, ESM-first |
| Styling | Tailwind CSS | Utility-first, consistent design |
| Auth | JWT | Stateless, scalable |
| ODM | Mongoose | Schema validation + query helpers |
| AI Layer | OpenAI API | Flexible, production-ready |
