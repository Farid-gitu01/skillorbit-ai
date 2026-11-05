# Database Schema

## Collections

### `users`

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated primary key |
| `name` | String | Full name |
| `email` | String | Unique email address |
| `password` | String | Bcrypt hashed password |
| `role` | Enum | `seeker` \| `employer` \| `provider` \| `admin` |
| `createdAt` | Date | Auto-managed by Mongoose timestamps |
| `updatedAt` | Date | Auto-managed by Mongoose timestamps |

---

### `jobs` *(planned)*

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated primary key |
| `title` | String | Job title |
| `description` | String | Full job description |
| `skills` | String[] | Required skill tags |
| `employer` | ObjectId | Ref → `users` |
| `createdAt` | Date | Auto-managed |

---

### `applications` *(planned)*

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Auto-generated primary key |
| `seeker` | ObjectId | Ref → `users` |
| `job` | ObjectId | Ref → `jobs` |
| `status` | Enum | `pending` \| `reviewed` \| `accepted` \| `rejected` |
| `createdAt` | Date | Auto-managed |

---

> Full ERD diagram will be added here once all collections are finalised.
