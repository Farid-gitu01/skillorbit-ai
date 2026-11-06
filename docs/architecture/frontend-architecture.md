# Frontend Architecture — SkillOrbit AI

> Phase 1.3 · Architecture & Design System Documentation

---

## 1. Technology Stack

| Concern | Technology |
|---|---|
| Framework | React 19 (functional components, hooks) |
| Language | TypeScript ~5.9 (strict) |
| Build | Vite 8 (ESM, HMR) |
| Routing | React Router DOM 7 |
| Forms | react-hook-form 7 + Zod 4 (@hookform/resolvers) |
| HTTP | Axios 1.x |
| Icons | lucide-react 1.x |
| State | React Context API (auth, user session) |

---

## 2. Design System

### 2.1 Brand Identity

**Product name:** SkillOrbit AI  
**Design direction:** Modern professional AI SaaS — clean layouts, subtle gradients, consistent spacing, responsive dashboards.

### 2.2 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `midnight-navy` | `#080D1B` | Page backgrounds, deepest surfaces |
| `navy` | `#111C35` | Card backgrounds, sidebar, elevated surfaces |
| `blue` | `#2563EB` | Primary actions, CTAs, links |
| `cyan` | `#06B6D4` | Highlights, active states, progress indicators |
| `violet` | `#7C3AED` | Secondary accents, badges |
| `purple` | `#A855F7` | Gradient pair with violet, tag chips |
| `white` | `#F8FAFC` | Body text, headings on dark surfaces |
| `slate` | `#94A3B8` | Secondary text, borders, placeholders |

**Gradient patterns**

```
Primary CTA:   linear-gradient(135deg, #2563EB, #06B6D4)
Hero banner:   linear-gradient(135deg, #080D1B, #111C35)
AI feature:    linear-gradient(135deg, #7C3AED, #A855F7)
```

### 2.3 Typography

**Font family:** `Inter` (Google Fonts / self-hosted)  
**Fallback:** `ui-sans-serif, system-ui, -apple-system, sans-serif`

| Scale | Size | Weight | Usage |
|---|---|---|---|
| `display` | 3rem / 48px | 700 | Hero headings |
| `h1` | 2rem / 32px | 700 | Page titles |
| `h2` | 1.5rem / 24px | 600 | Section headings |
| `h3` | 1.25rem / 20px | 600 | Card headings |
| `h4` | 1.125rem / 18px | 500 | Sub-section labels |
| `body` | 1rem / 16px | 400 | General content |
| `small` | 0.875rem / 14px | 400 | Captions, metadata |
| `xs` | 0.75rem / 12px | 400 | Badges, tags |

**Line height:** 1.6 (body) · 1.2 (headings)  
**Letter spacing:** -0.01em (headings) · 0 (body)

### 2.4 Spacing Scale

Base unit: `4px`

| Token | Value | Tailwind equivalent |
|---|---|---|
| `xs` | 4px | `p-1` |
| `sm` | 8px | `p-2` |
| `md` | 16px | `p-4` |
| `lg` | 24px | `p-6` |
| `xl` | 32px | `p-8` |
| `2xl` | 48px | `p-12` |
| `3xl` | 64px | `p-16` |

### 2.5 Border Radius

| Context | Value |
|---|---|
| Buttons / inputs | `8px` (rounded-lg) |
| Cards | `12px` (rounded-xl) |
| Modals | `16px` (rounded-2xl) |
| Tags / badges | `9999px` (rounded-full) |

### 2.6 Elevation / Shadows

All surfaces use dark-mode-aware box-shadows on the navy palette:

```
card:   0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)
modal:  0 8px 32px rgba(0,0,0,0.5)
```

### 2.7 Component States

| State | Treatment |
|---|---|
| Default | Base colour per token |
| Hover | 10% lighter / subtle border highlight |
| Focus | 2px outline in `#2563EB` (blue) |
| Active | 10% darker |
| Disabled | 40% opacity, cursor not-allowed |
| Loading | Skeleton shimmer (navy → navy/80) |
| Error | `#EF4444` border + icon |
| Success | `#22C55E` border + icon |

---

## 3. Folder Structure

```
frontend/src/
├── assets/              # Static images, SVGs, fonts
├── components/
│   ├── common/          # Shared non-UI components (ProtectedRoute, RoleGuard, etc.)
│   ├── layout/          # Page shells (AppLayout, DashboardLayout, AuthLayout)
│   └── ui/              # Atomic design-system primitives (Button, Input, Card, Badge, Modal, etc.)
├── context/             # React Context providers (AuthContext, ThemeContext)
├── hooks/               # Custom React hooks (useAuth, useApi, useDebounce, etc.)
├── pages/
│   ├── auth/            # Login, Register, ForgotPassword
│   ├── seeker/          # Job Seeker dashboard & sub-pages
│   ├── employer/        # Employer dashboard & sub-pages
│   ├── provider/        # Training Provider dashboard & sub-pages
│   └── admin/           # Admin dashboard & sub-pages
├── routes/              # Route definitions, ProtectedRoute wrappers
├── services/            # Axios API service modules (auth, jobs, users, etc.)
├── types/               # Global TypeScript interfaces and enums
└── utils/               # Pure helper functions (formatDate, cn, etc.)
```

---

## 4. Page Routes by Role

### 4.1 Public Routes

| Path | Page | Description |
|---|---|---|
| `/` | `LandingPage` | Marketing homepage |
| `/login` | `LoginPage` | Email + password login |
| `/register` | `RegisterPage` | Account creation with role selection |
| `/forgot-password` | `ForgotPasswordPage` | Password reset request |
| `/reset-password/:token` | `ResetPasswordPage` | New password entry |

### 4.2 Job Seeker Routes (`/seeker/*`)

| Path | Page | Description |
|---|---|---|
| `/seeker/dashboard` | `SeekerDashboard` | Overview: applications, matches, AI tips |
| `/seeker/profile` | `SeekerProfile` | Edit profile, upload resume |
| `/seeker/jobs` | `JobBrowse` | Search and filter job listings |
| `/seeker/jobs/:id` | `JobDetail` | Full job description + apply |
| `/seeker/applications` | `MyApplications` | Track application statuses |
| `/seeker/skills` | `SkillsPage` | Skill inventory and gap analysis |
| `/seeker/courses` | `CourseBrowse` | Recommended courses |
| `/seeker/courses/:id` | `CourseDetail` | Course details + enroll |
| `/seeker/ai-advisor` | `AIAdvisor` | AI-powered career guidance chat |

### 4.3 Employer Routes (`/employer/*`)

| Path | Page | Description |
|---|---|---|
| `/employer/dashboard` | `EmployerDashboard` | Overview: active jobs, new applicants |
| `/employer/profile` | `EmployerProfile` | Company profile management |
| `/employer/jobs` | `ManageJobs` | List of posted jobs |
| `/employer/jobs/new` | `CreateJob` | Post a new job listing |
| `/employer/jobs/:id/edit` | `EditJob` | Edit existing listing |
| `/employer/jobs/:id/applicants` | `Applicants` | Review applicants for a job |
| `/employer/applicants/:id` | `ApplicantDetail` | Full applicant profile + AI match score |
| `/employer/analytics` | `EmployerAnalytics` | Posting performance stats |

### 4.4 Training Provider Routes (`/provider/*`)

| Path | Page | Description |
|---|---|---|
| `/provider/dashboard` | `ProviderDashboard` | Overview: courses, enrollments |
| `/provider/profile` | `ProviderProfile` | Organisation profile |
| `/provider/courses` | `ManageCourses` | List of published courses |
| `/provider/courses/new` | `CreateCourse` | Create new course |
| `/provider/courses/:id/edit` | `EditCourse` | Edit course details |
| `/provider/courses/:id/learners` | `CourseLearners` | Enrolled learners list |
| `/provider/analytics` | `ProviderAnalytics` | Enrollment & completion stats |

### 4.5 Admin Routes (`/admin/*`)

| Path | Page | Description |
|---|---|---|
| `/admin/dashboard` | `AdminDashboard` | Platform KPIs overview |
| `/admin/users` | `UserManagement` | List, search, filter all users |
| `/admin/users/:id` | `UserDetail` | View/edit individual user |
| `/admin/jobs` | `AllJobs` | Moderate job listings |
| `/admin/courses` | `AllCourses` | Moderate course listings |
| `/admin/analytics` | `PlatformAnalytics` | Global usage statistics |
| `/admin/settings` | `PlatformSettings` | Feature flags, config |

---

## 5. Reusable Component Architecture

### 5.1 UI Primitives (`components/ui/`)

These are headless or minimal-style atomic components that implement the design system tokens above.

| Component | Props | Description |
|---|---|---|
| `Button` | `variant`, `size`, `loading`, `disabled` | Primary / secondary / ghost / danger |
| `Input` | `label`, `error`, `prefix`, `suffix` | Controlled text field |
| `Textarea` | `label`, `error`, `rows` | Multi-line input |
| `Select` | `label`, `options`, `error` | Dropdown selector |
| `Card` | `padding`, `border`, `className` | Surface container |
| `Badge` | `variant`, `size` | Status / category chip |
| `Modal` | `open`, `onClose`, `title` | Overlay dialog |
| `Spinner` | `size`, `color` | Loading indicator |
| `Skeleton` | `width`, `height`, `rounded` | Content placeholder |
| `Avatar` | `src`, `name`, `size` | User image with fallback |
| `Tooltip` | `content`, `position` | Hover label |
| `Toast` / `Alert` | `type`, `message`, `onDismiss` | Feedback messages |
| `ProgressBar` | `value`, `max`, `color` | Completion indicator |
| `Tabs` | `tabs`, `activeTab`, `onChange` | Tab navigation |
| `DataTable` | `columns`, `data`, `pagination` | Sortable, paginated table |

### 5.2 Layout Components (`components/layout/`)

| Component | Description |
|---|---|
| `AppLayout` | Outer shell with nav, sidebar, footer |
| `DashboardLayout` | Role-specific sidebar + top bar |
| `AuthLayout` | Centred card layout for login/register |
| `PageHeader` | Title + breadcrumb + action slot |
| `Sidebar` | Collapsible role-aware navigation |
| `TopBar` | Logo + user menu + notifications |

### 5.3 Common Components (`components/common/`)

| Component | Description |
|---|---|
| `ProtectedRoute` | Redirects to `/login` if no token |
| `RoleGuard` | Redirects to role dashboard if wrong role |
| `ErrorBoundary` | Catches render errors, shows fallback |
| `SEOHead` | `<title>` and meta per page |
| `EmptyState` | Illustration + message for empty lists |
| `LoadingPage` | Full-screen spinner during data fetch |
| `NotFound` | 404 page |

---

## 6. State Management

| Layer | Mechanism |
|---|---|
| Server state | Axios service calls + local component state |
| Auth state | `AuthContext` (user, token, role, login/logout) |
| Form state | react-hook-form per form instance |
| Global UI | React Context (theme, notifications) |
| URL state | React Router `useSearchParams` for filters/pagination |

No external state management library (Redux / Zustand) is introduced in Phase 1. Context is sufficient for auth and minimal global state.

---

## 7. API Service Organisation (`services/`)

| File | Responsibility |
|---|---|
| `api.ts` | Axios instance — base URL, auth header interceptor, error interceptor |
| `auth.service.ts` | `register()`, `login()`, `logout()`, `refreshToken()` |
| `user.service.ts` | `getProfile()`, `updateProfile()`, `uploadAvatar()` |
| `jobs.service.ts` | `getJobs()`, `getJob()`, `createJob()`, `updateJob()`, `deleteJob()` |
| `applications.service.ts` | `apply()`, `getMyApplications()`, `updateStatus()` |
| `courses.service.ts` | `getCourses()`, `getCourse()`, `createCourse()`, `enroll()` |
| `ai.service.ts` | `analyzeResume()`, `getSkillGap()`, `getJobMatches()` |
| `admin.service.ts` | `getUsers()`, `updateUser()`, `getPlatformStats()` |

All service functions return typed `Promise<T>` using interfaces defined in `types/`.

---

## 8. Routing & Guards

```
src/routes/
├── index.tsx          # Root router — mounts public + role routers
├── PublicRoutes.tsx   # Routes accessible without auth
├── SeekerRoutes.tsx   # /seeker/* with RoleGuard role="seeker"
├── EmployerRoutes.tsx # /employer/* with RoleGuard role="employer"
├── ProviderRoutes.tsx # /provider/* with RoleGuard role="provider"
└── AdminRoutes.tsx    # /admin/* with RoleGuard role="admin"
```

**Guard logic:**
1. `ProtectedRoute` checks `AuthContext` for a valid token. Unauthenticated users are redirected to `/login`.
2. `RoleGuard` reads `user.role` and redirects mismatched roles to their own dashboard.
3. After login, users are redirected to `/<role>/dashboard` based on their role.

---

## 9. Type Definitions (`types/`)

```typescript
// types/user.types.ts
export type UserRole = 'seeker' | 'employer' | 'provider' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

// types/api.types.ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```
