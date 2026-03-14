# beyouart website

This project now uses a small Node.js backend instead of client-only admin logic.

## Run locally

```bash
npm start
```

By default this runs on `http://localhost:8000`.

## Configuration

- `PORT` (optional): server port (default `8000`)
- `HOST` (optional): bind host (default `0.0.0.0`)
- `ADMIN_PASSWORD` (optional): admin keypad password (default `68952026`)

## Backend API

- `POST /api/track` — records visitor IP + timestamp + visit count
- `POST /api/admin/login` — returns bearer token when password is correct
- `GET /api/admin/visitors` — returns visitor list (requires bearer token)
- `POST /api/admin/logout` — invalidates current bearer token
