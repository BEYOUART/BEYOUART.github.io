# beyouart website

This project uses a Node.js backend for visitor tracking and protected admin access.

## Run locally

Preferred (do not expose plaintext in process env/history):

```bash
ADMIN_PASSWORD_HASH=<sha256-hex> npm start
```

Alternative:

```bash
ADMIN_PASSWORD=your-strong-password npm start
```

By default this runs on `http://localhost:8000`.

## Configuration

- `ADMIN_PASSWORD_HASH` (**preferred**): SHA-256 hex of your admin password.
- `ADMIN_PASSWORD` (optional fallback): plaintext admin password.
- If both `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD` are set, they must match the same password or startup will fail with a clear error.
- `PORT` (optional): server port (default `8000`)
- `HOST` (optional): bind host (default `0.0.0.0`)

## Security notes

- Never place real passwords/secrets in repository files, PR descriptions, or public docs.
- Rotate your password immediately if it was ever shared.
- The known old code `68952026` is blocked from being used as server password.
- In production, provide secrets via secure environment configuration.

## Backend API

- `POST /api/track` — records visitor IP + timestamp + visit count
- `POST /api/admin/login` — returns bearer token when password is correct
- `GET /api/admin/visitors` — returns visitor list (requires bearer token)
- `POST /api/admin/logout` — invalidates current bearer token
