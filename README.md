# Employee Management System Backend

Employee Management System (EMS) is a Node.js + Express + Sequelize backend for managing employees, departments, users, roles, and audit logs. It exposes REST API endpoints with JWT authentication, role-based authorization, and CSV export support.

## Demo Live

- Frontend / production demo: https://ems.rayhancreative.web.id
- API base URL: http://localhost:8000 (local development)

## Features

- Authentication and JWT-based session handling
- Role-based access control (RBAC) with configurable permissions for `ADMIN`, `HR`, and `EMPLOYEE`
- User management
- Department management
- Employee management
- Audit log tracking for create/update/delete actions
- CSV export for employees and audit logs
- Dashboard summary for employee and activity insights
- OpenAPI contract available at `/api-docs/openapi.json`

## Tech Stack

- Node.js
- Express
- Sequelize ORM
- PostgreSQL
- JWT
- Zod validation
- ExcelJS for CSV export
- CORS, Helmet, rate limiting

## Project Structure

```bash
.
├── config/
│   └── config.js
├── db/
│   ├── migrations/
│   ├── models/
│   └── seeders/
├── public/
│   └── assets/
│       └── erd.png
├── src/
│   ├── docs/
│   ├── middleware/
│   ├── modules/
│   ├── routes.js
│   └── utils/
├── index.js
├── package.json
├── .env.example
├── README.md
└── .gitignore
```

## ERD / Database Design

The ERD (Entity Relationship Diagram) shows the structure of the database and the relationships between different entities.

The ERD image is already available here:

<p align="center">
  <img src="./public/assets/erd.png" alt="ERD" width="900">
</p>

You can also open it visually in the project or share it with the team for database reference.

## Local Setup

### 1) Clone the project

```bash
git clone <repository-url>
cd employee-management-system
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment variables

Copy `.env.example` to `.env` and update the values as needed.

```bash
copy .env.example .env
```

Example:

```env
NODE_ENV=development
PORT=8000
JWT_KEY=your_jwt_secret
DB_USER=postgres
DB_PASS=postgres
DB_NAME=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONNECTION=postgresql
```

### 4) Create database and run migrations

```bash
npx sequelize-cli db:migrate
```

### 5) Seed the database

```bash
npm run seed
```

### 6) Run the server

Development mode:

```bash
npm run dev
```

Or direct run:

```bash
npm start
```

The application will run on:

```bash
http://localhost:8000
```

### 7) Health check

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "success": true,
  "message": "OK",
  "metadata": {},
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-10-08T00:00:00.000Z"
  }
}
```

## API Documentation

OpenAPI specification is available here:

- `http://localhost:8000/api-docs/openapi.json`

This is the contract used for frontend integration and documentation.

## Main API Endpoints

### Auth

- `POST /api/v1/auth/login` — login and receive JWT token
- `GET /api/v1/auth/get-me` — get current logged-in user
- `POST /api/v1/auth/logout` — clear auth token

### Dashboard

- `GET /api/v1/dashboard` — summary of employee count, department overview, and recent activity

### Roles

- `GET /api/v1/roles`
- `POST /api/v1/roles/create`
- `GET /api/v1/roles/:id/detail`
- `GET /api/v1/roles/:id/permissions`
- `PUT /api/v1/roles/:id/update`
- `PUT /api/v1/roles/:id/permissions`
- `DELETE /api/v1/roles/:id/delete`

### Users

- `GET /api/v1/users`
- `POST /api/v1/users/create`
- `GET /api/v1/users/:id/detail`
- `PUT /api/v1/users/:id/update`
- `DELETE /api/v1/users/:id/delete`
- `PATCH /api/v1/users/:id/status`

### Departments

- `GET /api/v1/departments`
- `POST /api/v1/departments/create`
- `GET /api/v1/departments/:id/detail`
- `PUT /api/v1/departments/:id/update`
- `DELETE /api/v1/departments/:id/delete`

### Employees

- `GET /api/v1/employees`
- `POST /api/v1/employees/create`
- `GET /api/v1/employees/:id/detail`
- `PUT /api/v1/employees/:id/update`
- `DELETE /api/v1/employees/:id/delete`
- `PATCH /api/v1/employees/:id/status`
- `GET /api/v1/employees/export`

### Audit Logs

- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/export`

## Common Query Parameters

The list endpoints support pagination, sorting, and filtering.

### Pagination

- `page` — default `1`
- `per_page` — default `10`, max `100`

### Search

- `q` — free text search

### Sorting

- `sort_by`
- `sort_order` — `ASC` or `DESC`

### Examples

```bash
GET /api/v1/employees?page=1&per_page=10&q=ali
GET /api/v1/users?role=ADMIN&status=true
GET /api/v1/departments?sort_by=name&sort_order=ASC
GET /api/v1/audit-logs?action=CREATE&date_from=2026-10-01
```

## Role Model

Supported roles in the system:

- `ADMIN`
- `HR`
- `EMPLOYEE`

Access is controlled using JWT and granular permissions assigned to each role.

### RBAC Feature Overview

The RBAC feature controls access to API resources through permissions assigned to roles. Each permission represents an action on a resource, using a key such as `employee.read`, `employee.create`, or `audit_log.export`. A role can hold multiple permissions, and each user receives the permissions associated with their role.

After authentication, the backend checks the user's active status, role status, and required permission before allowing access to a protected endpoint. Requests without a valid session receive `401 Unauthorized`; authenticated users without the required permission receive `403 Forbidden`. This authorization is enforced by the backend and cannot be bypassed by changing the frontend UI.

The login and `GET /api/v1/auth/get-me` responses include the user's role and permission keys. The frontend can use these keys to show or hide menus, pages, and actions, while still treating the API response as the final authorization decision. For example, the `employee.create` permission can control visibility of the create-employee action.

Administrators can manage roles and their assigned permissions through the role endpoints. `GET /api/v1/roles/:id/permissions` returns permissions assigned to a role, and `PUT /api/v1/roles/:id/permissions` replaces that role's permission list using permission database IDs.

## Frontend Integration Guide

### 1) Authentication

Call the login endpoint and send credentials with every subsequent request:

```js
const response = await fetch(`${API_URL}/api/v1/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
```

The backend sets an HttpOnly `token` cookie. The FE should use `credentials: 'include'` and should not store the token in `localStorage`.

After refresh or application startup, call:

```text
GET /api/v1/auth/get-me
```

Use the response to restore the authenticated user and role. Logout must call:

```text
POST /api/v1/auth/logout
```

### 2) API client

Every protected request must include credentials. Centralize this behavior in one API client so that `401` and `403` are handled consistently.

```js
await fetch(`${API_URL}/api/v1/employees`, {
  credentials: 'include'
})
```

Expected handling:

- `401` — clear the local session and redirect to login.
- `403` — keep the session, but show an access-denied state and hide or disable the action.
- `422` or `400` — show field or request validation errors.

### 3) Permission-based UI

Do not use only role names to decide whether a button or menu item is visible. Use permission keys:

```js
const can = (permission) => currentUserPermissions.includes(permission)

if (can('employee.create')) {
  // Render the create employee action.
}
```

The main permission keys are:

```text
dashboard.read
user.read              user.create       user.update       user.delete
role.read              role.create       role.update       role.delete
role.permission.assign
department.read        department.create department.update department.delete
employee.read          employee.create   employee.update   employee.delete
employee.export
audit_log.read         audit_log.export
```

The FE must still handle `403` from the API. UI guards improve the experience but are not a security boundary.

### 4) Current permission limitation

The current `GET /api/v1/auth/get-me` response contains the user's role but does not yet contain the resolved permission list. Until a current-user permission endpoint is available, the FE should:

1. Use the role as a temporary UI fallback.
2. Treat the API response as the final authorization decision.
3. Request a BE endpoint such as `GET /api/v1/auth/permissions` for permission-based UI guards.

For the admin role-management screen, the available endpoints are:

```text
GET /api/v1/roles/:id/permissions
PUT /api/v1/roles/:id/permissions
```

The update request replaces the complete permission list:

```json
{
  "permission_ids": ["permission-id-1", "permission-id-2"]
}
```

### 5) Recommended FE screens

- Login and session-expired state
- Dashboard based on `dashboard.read`
- Employee list, detail, create, edit, delete, and export states
- User and role management restricted by their permission keys
- Role permission editor with grouped permissions by resource
- Empty, loading, validation-error, unauthorized, and forbidden states

### 6) FE delivery checklist

- [ ] Configure the API base URL per environment.
- [ ] Enable `credentials: 'include'` on the API client.
- [ ] Restore the session with `GET /api/v1/auth/get-me` on app startup.
- [ ] Add centralized `401` and `403` handling.
- [ ] Add permission helpers for menu, route, and action guards.
- [ ] Do not persist the JWT in `localStorage`.
- [ ] Test the UI with `ADMIN`, `HR`, and `EMPLOYEE` accounts.

## Next Features

Planned improvements for the next development cycle:

- [x] **Granular RBAC permissions** — define permissions per resource and action, such as `employee.read`, `employee.create`, and `audit_log.export`.
- [x] **Role and permission management** — allow administrators to create custom roles and assign permissions without changing application code.
- [ ] **Permission-aware API documentation** — document the required role or permission for each protected endpoint in the OpenAPI specification.
- [ ] **Automated authentication and authorization tests** — cover login, token validation, role restrictions, permission checks, and unauthorized access responses.
- [ ] **Refresh token and session management** — support secure token renewal and server-side session revocation.
- [ ] **Employee data import** — add validated CSV/XLSX import with a preview step and an import result report.
- [ ] **Notifications** — provide email or in-app notifications for account status changes, employee updates, and important audit events.
- [ ] **Soft delete and data recovery** — preserve deleted records where required and provide a controlled recovery workflow.
- [ ] **Production observability** — add structured logging, metrics, error tracking, and health checks for dependent services.

## Running Tests

The project uses Node's built-in test runner for focused automated tests. Manual smoke testing is still recommended for API integration.

Recommended local validation flow:

```bash
npm install
npx sequelize-cli db:migrate
npm run seed
npm test
npm run dev
```

Then test the following endpoints:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/auth/login
curl http://localhost:8000/api/v1/dashboard
```

If you want to add automated tests later, this project is structured to support it with a dedicated `test/` folder and a standard Node.js test runner.

## Environment Notes

- The backend expects PostgreSQL to be running locally or in your target environment.
- JWT secret and DB credentials must be valid in `.env`.
- `NODE_ENV` should be set according to the environment (`development`, `production`, etc.).

## Production / Deployment Notes

### Deployment Architecture

The production application is deployed across three services:

- **Supabase** hosts the PostgreSQL database used by the backend.
- **Railway** hosts this Node.js/Express backend and connects to Supabase using database environment variables.
- **Vercel** hosts the frontend and communicates with the backend through its production API URL.

The database password and JWT secret are configured as environment variables on Railway, not committed to this repository or exposed to the frontend. The backend's `ALLOWED_ORIGINS` must include the production Vercel frontend origin so credentialed API requests can pass CORS checks.

- Ensure the database is migrated and seeded before deployment.
- Set `JWT_KEY` securely in production.
- Configure environment-specific `PORT`, `DB_*`, and `NODE_ENV` values.
- Configure Supabase SSL settings and use the connection details provided by the Supabase project.

## Useful Commands

```bash
npm install
npm run dev
npm start
npm run migrate
npm run seed
npm run seed:undo
npm run migrate:undo
```

## Contact / Maintainer

For questions or technical support, contact the project maintainer or the development team managing this repository.

## License

This project is intended for internal or project-based use unless otherwise specified by the repository owner.
