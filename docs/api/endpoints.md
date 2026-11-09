# API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

Protected routes use the `skillorbit_access` HttpOnly cookie. The API uses credentialed CORS for explicit configured frontend origins; see the authentication architecture for cookie and role behavior.

---

## Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and set HttpOnly cookie | No |
| POST | `/auth/logout` | Clear authentication cookie | No |
| POST | `/auth/forgot-password` | Request password-reset email | No |
| POST | `/auth/reset-password` | Consume reset token and change password | No |
| POST | `/auth/verify-email` | Verify email with one-time token | No |
| POST | `/auth/resend-verification` | Request another verification email | No |

---

## User Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/me` | Get current user profile | Yes |

---

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |

---

> Additional endpoints (jobs, skills, courses, applications) will be documented here as they are implemented.
