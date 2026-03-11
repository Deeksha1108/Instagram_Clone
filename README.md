# Instagram Clone – Onboarding Service (OTP + JWT Auth)
## Secure User Authentication using NestJS + PostgreSQL + Redis

This Onboarding Service handles **user registration and authentication**
through an OTP-based verification flow using JWT tokens and Redis session management.

It demonstrates how **real-world backend systems** implement secure,
stateless authentication with token-based session handling
decoupled from the main application logic.

The goal of this service is to show **how production-grade auth systems work** —
from identity verification to profile creation — in a clean, scalable, and secure manner.

---

## What is OTP-Based Auth (Easy Explanation)

Instead of directly asking a user for a password during registration,
OTP-based auth works like this:

User → sends email/phone → OTP generated → stored in Redis → JWT temp token returned

This approach ensures:

- Identity verified before profile creation
- No plaintext OTP stored (bcrypt hashed in Redis)
- Stateless flow using JWT tokens
- Session auto-expires via Redis TTL

---

## Authentication Flow

The registration flow has **3 steps**:

1. Send OTP
2. Verify OTP
3. Create Profile

Each step is guarded and validated independently.

---

## Why JWT + Redis Together?

JWT and Redis serve different purposes in this system:

- **JWT (Temp Token)**
  - Carries identity (email/phone) between steps
  - Stateless — no DB lookup needed
  - Expires in 5 minutes (same as OTP TTL)

- **Redis (OTP Session)**
  - Stores hashed OTP securely
  - Tracks `verified` state between steps
  - Auto-expires using TTL — no manual cleanup needed

---

## API Flow Implemented

### Step 1 — Send OTP (BasicAuth Protected)

Used to initiate registration with email or phone.

Request:
POST /auth/send-otp

Protected by BasicAuth (app-level authentication).

Flow:
Client → BasicAuthGuard → OTP generated → hashed & stored in Redis → JWT temp token returned

---

### Step 2 — Verify OTP (TempToken Protected)

Used to verify the OTP received by the user.

Request:
POST /auth/verify-otp

Protected by TempTokenGuard (JWT in Authorization header).

Flow:
Client → TempTokenGuard → extract identifier from JWT → fetch OTP from Redis → bcrypt.compare → mark verified

---

### Step 3 — Create Profile (TempToken Protected)

Used to complete registration after OTP is verified.

Request:
POST /auth/create-profile

Protected by TempTokenGuard (same JWT from Step 1).

Flow:
Client → TempTokenGuard → check Redis verified:true → create user in DB → return accessToken + refreshToken

---

## Security Concepts Applied

### OTP Hashing
OTP is hashed using bcrypt before storing in Redis.
Plain OTP is never stored anywhere.

### JWT Temp Token
Contains only identity info (email/phone + type).
Used exclusively for the onboarding flow.
Expires in the same TTL as the OTP session.

### Access + Refresh Tokens
After profile creation, two tokens are issued:
- Access Token — short-lived (10 minutes)
- Refresh Token — long-lived (7 days)

---

## Tech Stack Used

- NestJS
- PostgreSQL
- TypeORM
- Redis (ioredis)
- JWT (@nestjs/jwt)
- bcrypt
- class-validator / class-transformer
- Swagger (@nestjs/swagger)
- dotenv
- tsconfig-paths

---

## Project Folder Structure

```
src/
├── common/
│   ├── constants/
│   │   └── constants.ts
│   ├── guards/
│   │   ├── basic-auth.guard.ts
│   │   └── temp-token.guard.ts
│   ├── interceptors/
│   │   ├── request.interceptor.ts
│   │   └── response.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── types/
│       └── auth.types.ts
├── config/
│   └── jwt.config.ts
├── database/
│   ├── data-source.ts
│   ├── database.module.ts
│   └── migrations/
├── modules/
│   ├── auth/
│   │   ├── constants/
│   │   ├── dto/
│   │   ├── interfaces/
│   │   ├── response/
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   └── user/
│       ├── entities/
│       │   └── user.entity.ts
│       └── users.module.ts
├── shared/
│   └── redis/
│       ├── redis.module.ts
│       └── redis.service.ts
├── app.module.ts
└── main.ts
```

---

## Setup Instructions

### Clone Repository
```
git clone <your-repo-url>
cd instagram-clone
npm install
```

---

### Start PostgreSQL
Make sure PostgreSQL is running and a database is created:
```
CREATE DATABASE instagram_clone;
```

---

### Start Redis
```
redis-server
```

Or using Docker:
```
docker run -d --name redis -p 6379:6379 redis
```

---

### Configure Environment Variables
Create a `.env` file in the root:
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=instagram_clone

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=600
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=604800

PORT=3000
```

---

### Run Database Migrations
```
npm run migration:generate
npm run migration:run
```

---

### Start Application
```
npm run start:dev
```

---

## Swagger API Docs

After starting the app, open:

```
http://localhost:3000/api
```

All endpoints are documented with request/response schemas.
BasicAuth and BearerAuth are both configured in Swagger.

---

## Internal Working (Step-by-Step)

1. Client sends email/phone with BasicAuth credentials
2. OTP is generated and hashed with bcrypt
3. Hashed OTP + `verified: false` stored in Redis with TTL
4. JWT temp token signed with identifier (email/phone) returned to client
5. Client sends OTP with temp token in Authorization header
6. Guard validates JWT → extracts identifier → Redis fetched
7. bcrypt.compare verifies OTP → Redis updated to `verified: true`
8. Client sends profile data with same temp token
9. Guard validates JWT → Redis checked for `verified: true`
10. User saved in PostgreSQL → Redis key deleted → accessToken + refreshToken returned

---

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migration:generate` | Generate migration from entity changes |
| `npm run migration:run` | Apply pending migrations to DB |
| `npm run migration:revert` | Revert last applied migration |

---

## Production-Level Concepts Applied

- OTP hashing with bcrypt (no plaintext OTP storage)
- Redis TTL for automatic session expiry
- JWT-based stateless authentication
- Separation of temp token and access/refresh tokens
- Guard-based route protection
- Global exception filter for consistent error responses
- Global response interceptor for consistent API shape
- Request logging interceptor
- Environment-based configuration with `getOrThrow`
- Path alias resolution via tsconfig-paths

---

## What I Learned from This Project

- How **OTP-based authentication** works in production
- How **Redis** is used for short-lived session management
- How **JWT** enables stateless identity transfer between steps
- How to implement **multi-step auth flows** in NestJS
- How **Guards** protect routes at different levels
- How to structure a **modular NestJS backend** cleanly
- How to use **TypeORM migrations** for schema management

---

## Made By Deeksha

This **Instagram Clone Backend** demonstrates a **production-grade OTP authentication system**
using NestJS with JWT, Redis, and PostgreSQL.
It implements a clean **3-step onboarding flow** with proper security,
token management, and modular architecture.
