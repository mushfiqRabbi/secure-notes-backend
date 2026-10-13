# Secure Notes API

REST API for a role-based note-taking app: Express, MongoDB (Mongoose), JWT, bcrypt.

## Run

```bash
npm install
cp .env.example .env        # set JWT_SECRET and MONGO_URI
npm start                   # http://localhost:4000
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-me-please' npm run seed:admin
npm test                    # uses an in-memory MongoDB, nothing to install
```

Requires MongoDB >= 5.0 (`$lookup` with `localField` + `pipeline`).

## Roles

| Role  | Can do |
|-------|--------|
| user  | register/login, CRUD own notes, list own notes, write posts, edit own profile (not role) |
| admin | everything a user can, plus add/update/remove/list users, list everyone's notes |

Registration always creates a `user`; admins are created via the seed script or by another admin.
Admins can **view** others' notes; edit/delete remain owner-only.

## Endpoints

All lists are paginated: `?page=1&limit=20` (limit max 100). Responses: `{items, page, limit, total, pages}`.

| Endpoint | Auth | Query / index used |
|---|---|---|
| `POST /auth/register`, `POST /auth/login` | none | `{email:1}` |
| `GET/PATCH /me` | any | `_id` |
| `POST /notes` | any | - |
| `GET /notes` | any | `{owner:1,_id:-1}` |
| `GET/PATCH/DELETE /notes/:id` | owner (GET: owner or admin) | `_id` |
| `GET /admin/notes[?owner=]` | admin | `_id` / `{owner:1,_id:-1}` |
| `GET /users` | admin | `_id` |
| `GET /users/by-interest[?interest=]` | admin | `{interests:1}` (Scenario 1) |
| `GET/POST/PATCH/DELETE /users[/:id]` | admin | `_id` |
| `POST /posts` | any | - |
| `GET /users/:id/posts` | **public** | `_id` + `{author:1,_id:-1}` (Scenario 2) |

## Indexes (all declared with `schema.index()`)

| Collection | Index | Why it is needed |
|---|---|---|
| users | `{email:1}` unique | login and duplicate check |
| users | `{interests:1}` | Scenario 1 `$match` on an interest (multikey) |
| notes | `{owner:1,_id:-1}` | user's list + admin owner filter + cascade delete; the `{owner}` prefix makes a separate owner index redundant |
| posts | `{author:1,_id:-1}` | Scenario 2 `$lookup` foreign field with newest-first sort |

Everything else (GET by id, admin list of users, admin list of all notes) is served by the default `_id` index.
`tests/indexes.test.js` asserts this exact set and `tests/explain.test.js` proves each query uses an index.

## Aggregations

- **Scenario 1 - users grouped by interests** (`src/services/interestGroups.js`): one `User.aggregate()`;
  `$match` -> `$setUnion` (dedupe) -> `$unwind` -> `$group` -> `$sort` -> `$facet` (page + total groups).
- **Scenario 2 - posts of a user** (`src/services/userPosts.js`): one pipeline starting from `users`:
  `$match {_id}` -> `$lookup` into `posts` (sorted/paginated sub-pipeline) -> `$lookup` count -> `$project`.
