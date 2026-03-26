# Instagram Clone – Auth Service
## Secure Authentication using NestJS + PostgreSQL + Redis

This Auth Service handles **user registration, login, session management, and password reset**
through an OTP-based verification flow, password-based login, and Facebook OAuth —
all backed by JWT tokens, Redis session management, and SMTP email delivery.

It demonstrates how **real-world backend systems** implement secure, stateless authentication
with token rotation, device tracking, multi-provider support, and audit logging
in a clean, modular, and scalable manner.

---

## What This Service Covers

| Feature | Description |
|---|---|
| OTP Signup | Register via email/phone with OTP verification |
| Password Login | Login with email / phone / username + password |
| Facebook Login | OAuth login/signup via Facebook access token |
| Forgot Password | Reset password via OTP verification |
| Resend OTP | Re-send OTP with rate limiting |
| Refresh Token | Rotate access + refresh tokens |
| Logout | Deactivate session on current device |
| Logout All | Deactivate all sessions across devices |

---

## Authentication Flows

### Flow 1 — OTP Signup (3 Steps)

```
POST /auth/send-otp       → validate user, generate OTP, store in Redis, return temp token
POST /auth/verify-otp     → verify OTP using temp token, mark session as verified in Redis
POST /auth/create-profile → create user in DB, return access + refresh tokens
```

### Flow 2 — Password Login

```
POST /auth/login → validate credentials, create session, return access + refresh tokens
```

### Flow 3 — Facebook Login

```
POST /auth/facebook-login → verify token with Graph API → find/link/create user → return tokens
```

### Flow 4 — Forgot Password (3 Steps)

```
POST /auth/send-otp       → type: FORGOT_PASSWORD → validate user exists, send OTP
POST /auth/verify-otp     → verify OTP, mark session as verified
POST /auth/reset-password → validate verified session, update hashed password
```

### Flow 5 — Session Management

```
POST /auth/resend-otp     → resend OTP (rate limited)
POST /auth/refresh-token  → rotate refresh token, return new access + refresh tokens
POST /auth/logout         → deactivate current session
POST /auth/logout-all     → deactivate all sessions for the user
```

---

## API Endpoints

| Method | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| POST | `/auth/send-otp` | BasicAuth | Send OTP for signup or forgot-password |
| POST | `/auth/verify-otp` | TempToken | Verify OTP |
| POST | `/auth/create-profile` | TempToken | Create user profile after OTP verification |
| POST | `/auth/login` | BasicAuth | Login with email/phone/username + password |
| POST | `/auth/facebook-login` | BasicAuth | Login or register via Facebook |
| POST | `/auth/reset-password` | TempToken | Reset password after OTP verification |
| POST | `/auth/resend-otp` | TempToken | Resend OTP |
| POST | `/auth/refresh-token` | BasicAuth | Rotate refresh token |
| POST | `/auth/logout` | JwtAuth | Logout current device |
| POST | `/auth/logout-all` | JwtAuth | Logout all devices |

---

## Guards

| Guard | Protects | How |
|-------|----------|-----|
| `BasicAuthGuard` | Public entry points | App-level credentials in Authorization header |
| `TempTokenGuard` | OTP flow steps | Short-lived JWT (temp token) in Authorization header |
| `JwtAuthGuard` | Authenticated routes | Access token in Authorization header |

---

## Why JWT + Redis Together?

| | JWT | Redis |
|---|---|---|
| **Temp Token** | Carries identity (email/phone + OTP type) between flow steps | Stores hashed OTP + verified state + attempt count |
| **Access Token** | Short-lived (10 min), stateless auth for protected routes | — |
| **Refresh Token** | Long-lived (7 days), used to rotate tokens | Stores refresh token string keyed by sessionId |

Redis TTL ensures automatic expiry — no manual cleanup needed.

---

## Security Concepts Applied

- **OTP hashing** — bcrypt hash stored in Redis; plain OTP never persisted
- **Temp token expiry** — same TTL as OTP session (configurable, default 20 min)
- **Brute force protection** — `verifyAttempts` tracked in Redis; throws after max attempts
- **OTP rate limiting** — per-identifier Redis counter with configurable window and max requests
- **Token rotation** — refresh token replaced on every `/refresh-token` call
- **Session tracking** — every login creates a `UserSession` row with device, provider, loginAt, expiresAt
- **Auth attempt audit** — failed signups/logins/forgot-password attempts logged to `auth_attempts` table
- **Multi-provider support** — `provider` field on user distinguishes `local` vs `facebook` accounts
- **Facebook account linking** — existing local account auto-linked by email on first Facebook login
- **OTP bypass** — configurable bypass code for dev/qa environments (disabled in production)
- **Device detection** — `device` header or User-Agent parsed and stored per session

---

## Database Entities

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, from BaseEntity |
| email | string | nullable, unique, indexed |
| phone | string | nullable, unique, indexed |
| username | string | nullable, unique, indexed |
| fullName | string | nullable |
| age | number | nullable |
| gender | string | nullable |
| password | string | nullable, excluded from select by default |
| facebookId | string | nullable, unique |
| provider | enum | `local` \| `facebook` |
| isVerified | boolean | default false |

### `user_sessions`
| Column | Type | Notes |
|--------|------|-------|
| userId | string | FK → users |
| sessionId | uuid | unique, indexed |
| device | string | from header or user-agent |
| loginProvider | enum | `local` \| `facebook` |
| loginAt | timestamp | — |
| expiresAt | timestamp | refresh token expiry |
| isActive | boolean | false on logout |

### `auth_attempts`
| Column | Type | Notes |
|--------|------|-------|
| email | string | nullable, indexed |
| phone | string | nullable, indexed |
| attemptType | enum | `signup` \| `login` \| `forgot_password` |
| status | enum | `invalid_user` \| `wrong_password` \| `user_already_exists` |

---

## Tech Stack

- NestJS
- PostgreSQL + TypeORM
- Redis (ioredis)
- JWT (`@nestjs/jwt`)
- bcrypt
- Nodemailer (SMTP OTP delivery)
- Facebook Graph API (OAuth)
- class-validator / class-transformer
- Swagger (`@nestjs/swagger`)
- tsconfig-paths

---

## Project Folder Structure

```
src/
├── common/
│   ├── constants/
│   │   └── constants.ts          # AUTH_CONSTANTS, AUTH_PROVIDERS, REDIS_KEYS
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() — extracts JWT payload fields
│   │   └── device.decorator.ts         # @DeviceHeader() — reads device from header/UA
│   ├── entities/
│   │   └── base.entity.ts        # id, createdAt, updatedAt
│   ├── enum/
│   │   └── enum.common.ts        # AttemptType, AttemptStatus, Gender, OtpType
│   ├── filters/
│   │   └── http-exception.filter.ts    # Global exception → consistent error shape
│   ├── guards/
│   │   ├── basic-auth.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── temp-token.guard.ts
│   ├── interceptors/
│   │   ├── request.interceptor.ts      # Logs incoming requests
│   │   └── response.interceptor.ts     # Wraps all responses in standard shape
│   ├── logger/
│   │   ├── logger.module.ts
│   │   └── logger.service.ts           # AppLogger extending NestJS Logger
│   ├── types/
│   │   └── auth.types.ts         # TempTokenData, JwtPayload, RequestWithTempToken
│   ├── utils/
│   │   └── device.util.ts        # Parses User-Agent string into device info
│   └── validators/
│       ├── email-or-phone.validator.ts
│       └── login.validator.ts
├── config/
│   ├── common.config.ts          # COMMON_CONFIG (otp, redis, nodeEnv)
│   ├── env.configuration.ts      # Reads and parses all env vars
│   └── jwt.config.ts             # JWT_CONFIG (secret, expiresIn, refresh*)
├── database/
│   ├── data-source.ts
│   ├── database.config.ts
│   ├── database.module.ts
│   └── migrations/
├── modules/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── create-profile.dto.ts
│   │   │   ├── facebook-login.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── refresh-token.dto.ts
│   │   │   ├── reset-password.dto.ts
│   │   │   ├── send-otp.dto.ts
│   │   │   └── verify-otp.dto.ts
│   │   ├── interfaces/
│   │   │   └── auth-response.interface.ts
│   │   ├── response/
│   │   │   └── auth.response.ts  # MESSAGES constant
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   └── user/
│       ├── entities/
│       │   ├── auth_attempts.entity.ts
│       │   ├── user.entity.ts
│       │   └── user_sessions.entity.ts
│       └── users.module.ts
├── shared/
│   ├── mailer/
│   │   ├── mailer.module.ts
│   │   └── mailer.service.ts     # Nodemailer SMTP — sends OTP emails
│   └── redis/
│       ├── redis.module.ts
│       └── redis.service.ts
├── app.module.ts
└── main.ts
```

---

## Setup Instructions

### Clone Repository

```bash
git clone <your-repo-url>
cd instagram-clone
npm install
```

### Start PostgreSQL

```sql
CREATE DATABASE instagram_clone;
```

### Start Redis

```bash
redis-server
```

Or using Docker:

```bash
docker run -d --name redis -p 6379:6379 redis
```

### Configure Environment Variables

Create a `.env` file in the root:

```env
# App
NODE_ENV=development
PORT=3000

# Basic Auth
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=secret

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=instagram_clone

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=600
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=604800

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OTP
OTP_TTL_SECONDS=600
TEMP_TOKEN_EXPIRES_IN=1200
OTP_RATE_LIMIT_MAX=5
OTP_RATE_LIMIT_WINDOW_SECONDS=300
OTP_MAX_VERIFY_ATTEMPTS=5

# OTP Bypass (dev/qa only)
BYPASS_OTP_ENABLED=true
BYPASS_OTP=123456

# SMTP (OTP email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Facebook OAuth
FACEBOOK_GRAPH_URL=https://graph.facebook.com/me
FACEBOOK_FIELDS=id,name,email
```

### Run Database Migrations

```bash
npm run migration:generate
npm run migration:run
```

### Start Application

```bash
npm run start:dev
```

---

## Swagger API Docs

```
http://localhost:3000/api
```

All endpoints are documented with request/response schemas.
BasicAuth and BearerAuth are both configured in Swagger.

---

## Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migration:generate` | Generate migration from entity changes |
| `npm run migration:run` | Apply pending migrations to DB |
| `npm run migration:revert` | Revert last applied migration |

---

## Internal Working — Step by Step

### OTP Signup
1. Client sends email/phone with BasicAuth credentials
2. Rate limit checked via Redis counter
3. OTP generated, bcrypt-hashed, stored in Redis with TTL (`verified: false`)
4. Short-lived JWT temp token returned to client
5. Client sends OTP + temp token → Guard extracts identifier → Redis fetched
6. bcrypt.compare verifies OTP → Redis updated to `verified: true`
7. Client sends profile data + temp token → Guard validates → Redis checks `verified: true`
8. User saved in PostgreSQL → Redis key deleted → access + refresh tokens returned

### Login
1. Client sends credentials with BasicAuth
2. User fetched by email/phone/username, password bcrypt-compared
3. New `UserSession` created with device, provider, loginAt, expiresAt
4. Refresh token stored in Redis keyed by sessionId
5. Access + refresh tokens returned

### Facebook Login
1. Facebook access token verified against Graph API
2. User looked up by `facebookId`; if not found, looked up by email and linked
3. If no user found, new user created with `provider: facebook`
4. Session created same as login flow

### Token Refresh
1. Refresh token verified against JWT secret
2. Session checked in DB (`isActive: true`)
3. Token string compared with Redis-stored value
4. Old token deleted from Redis; new token pair generated and stored
5. Session `expiresAt` updated

---

## What I Learned from This Project

- How **OTP-based authentication** works in production
- How **Redis** is used for short-lived session management and rate limiting
- How **JWT** enables stateless identity transfer between steps
- How to implement **multi-step auth flows** in NestJS
- How to implement **multi-provider auth** (local + Facebook OAuth)
- How to track **sessions per device** and support logout-all
- How **Guards and Decorators** protect routes cleanly
- How to structure a **modular NestJS backend** at scale
- How to use **TypeORM migrations** for schema management
- How to send **transactional emails** via SMTP with Nodemailer

---

## Made By Deeksha

This **Instagram Clone Backend** demonstrates a **production-grade authentication system**
using NestJS with JWT, Redis, PostgreSQL, SMTP email, and Facebook OAuth.
It implements secure multi-step flows with rate limiting, session tracking,
device awareness, audit logging, and token rotation.
