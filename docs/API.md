# API Reference

Base URL: `http://localhost:4005`

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Auth

### Register
```
POST /auth/register
Content-Type: application/json

{
  "name": "Alice Recruiter",
  "email": "alice@example.com",
  "password": "123456",
  "companyName": "Acme Corp"
}

Response 201:
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "alice@example.com",
    "name": "Alice Recruiter",
    "companyId": "uuid",
    "company": { "id": "uuid", "name": "Acme Corp", ... }
  }
}
```

### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "123456"
}

Response 200: (same as register)
```

### Get Current User
```
GET /auth/me
Authorization: Bearer <token>

Response 200:
{ "id": "uuid", "email": "...", "name": "...", "companyId": "uuid" }
```

---

## Jobs

### Create Job (Protected)
```
POST /jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Senior Backend Engineer",
  "description": "## About the Role\n\nMarkdown content...",
  "requirements": ["4+ years Node.js", "PostgreSQL", "Docker"],
  "screeningCriteria": "Prefer fintech experience. Red flag: job hopping."
}

Response 201: Job object
```

### List Company Jobs (Protected)
```
GET /jobs
Authorization: Bearer <token>

Response 200: Job[] (your company only)
```

### List Public Jobs (Paginated)
```
GET /jobs/public?page=1&limit=10

Response 200:
{
  "data": Job[],
  "total": 44,
  "hasMore": true
}
```

### Get Job Detail
```
GET /jobs/:id

Response 200: Job with candidates[] and company
```

### Update Job (Protected)
```
PATCH /jobs/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated markdown...",
  "requirements": ["updated"],
  "screeningCriteria": "updated criteria"
}

Response 200: Updated Job
```

### Toggle Active/Inactive (Protected)
```
PATCH /jobs/:id/toggle
Authorization: Bearer <token>
Content-Type: application/json

{ "isActive": false }

Response 200: Updated Job
```

### Delete Job (Protected)
```
DELETE /jobs/:id
Authorization: Bearer <token>

Response 200
```

---

## Candidates

### Upload CV
```
POST /jobs/:jobId/candidates/upload
Content-Type: multipart/form-data

Fields:
  cv: (PDF file, required)
  name: "Candidate Name" (optional, overrides AI-parsed name)
  email: "candidate@email.com" (optional, overrides AI-parsed email)

Response 201: Candidate object (status: "uploaded")
```

### List Candidates for Job
```
GET /jobs/:jobId/candidates

Response 200: Candidate[] (newest first)
```

### Get Candidate Detail
```
GET /jobs/:jobId/candidates/:id

Response 200: Candidate with job relation
```

### Get CV Download URL
```
GET /jobs/:jobId/candidates/:id/cv-url

Response 200: { "url": "https://minio-presigned-url..." }
```

### Retry Failed Processing
```
POST /jobs/:jobId/candidates/:id/retry

Response 200: Candidate (status reset to "uploaded", retryCount incremented)
Max 3 retries.
```

### Re-enrich (GitHub + LinkedIn)
```
POST /jobs/:jobId/candidates/:id/re-enrich

Response 200: Candidate (re-queued for enrichment + re-scoring)
```

### Extended Enrichment
```
POST /jobs/:jobId/candidates/:id/extended-enrich
Content-Type: application/json

{
  "types": ["portfolio", "liveProjects", "blog", "stackoverflow", "verification"]
}

Available types:
  - portfolio: Analyze personal website
  - liveProjects: Check deployed apps
  - blog: Analyze blog posts
  - stackoverflow: Check SO profile
  - verification: Verify work history

Response 200: Candidate (queued for extended enrichment)
```

### Delete Candidate
```
DELETE /jobs/:jobId/candidates/:id

Response 200
```

---

## Monitoring

### Bull Board Dashboard
```
GET /queues/

Opens Bull Board UI — view queue status, jobs, retries, failures.
```

---

## Candidate Status Flow

```
uploaded    → CV received, queued for processing
parsed      → PDF text extracted, AI parsing complete
enriching   → Fetching GitHub/LinkedIn/extended data
enriched    → External data collected
scoring     → AI generating match score
completed   → Done, score available
error       → Processing failed (retry available)
```

---

## Error Responses

```json
// 400 Bad Request
{ "statusCode": 400, "message": "Validation failed" }

// 401 Unauthorized
{ "statusCode": 401, "message": "Unauthorized" }

// 404 Not Found
{ "statusCode": 404, "message": "Job not found" }

// 409 Conflict
{ "statusCode": 409, "message": "Email already registered" }
```
