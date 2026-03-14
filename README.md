# beyouart website

This project uses a small Node.js backend instead of client-only admin logic.

## Run locally

```bash
ADMIN_PASSWORD=your-strong-password npm start
```

By default this runs on `http://localhost:8000`.

## Configuration

- `ADMIN_PASSWORD` (**required**): admin keypad password. Do not commit this value.
- `PORT` (optional): server port (default `8000`)
- `HOST` (optional): bind host (default `0.0.0.0`)

## Security note

- Never place real passwords/secrets in repository files, PR descriptions, or public docs.
- In production, provide `ADMIN_PASSWORD` via secure environment configuration.

## Backend API

- `POST /api/track` — records visitor IP + timestamp + visit count
- `POST /api/admin/login` — returns bearer token when password is correct
- `GET /api/admin/visitors` — returns visitor list (requires bearer token)
- `POST /api/admin/logout` — invalidates current bearer token
