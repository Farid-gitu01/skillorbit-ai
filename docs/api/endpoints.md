# API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

All protected routes require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and receive JWT | No |

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
