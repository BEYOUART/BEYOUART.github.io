# beyouart website

This project uses a Node.js backend for visitor tracking and protected admin access.

If the storefront is hosted on a different domain than the Node backend (for example GitHub Pages for the site and Render for the API), open `admin.html`, enter the backend origin in the new **Backend URL** field, and save it before logging in.

## Run locally

Preferred (do not expose plaintext in process env/history):

```bash
ADMIN_PASSWORD_HASH=<sha256-hex> npm start
# legacy alias also supported: ADMIN_CODE_HASH=<sha256-hex> npm start
```

Alternative:

```bash
ADMIN_PASSWORD=your-strong-password npm start
# legacy alias also supported: ADMIN_CODE=your-strong-password npm start
```

By default this runs on `http://localhost:8000`.

## Configuration

- `ADMIN_PASSWORD_HASH` (**preferred**): SHA-256 hex of your admin password.
- `ADMIN_PASSWORD` (optional fallback): plaintext admin password.
- Legacy aliases also supported: `ADMIN_CODE_HASH` (same as `ADMIN_PASSWORD_HASH`) and `ADMIN_CODE` (same as `ADMIN_PASSWORD`).
- If both plaintext and hash are provided (including alias combinations), they must match the same password or startup will fail with a clear error.
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

## Separate frontend/backend hosting

- The admin page stores a backend origin in browser `localStorage` under `beyouartApiBaseUrl`.
- Leave the field blank / click **Use this website** if the HTML site and Node backend are on the same domain.
- If the HTML site is on `beyouart.com` but the backend is on Render, save the Render service origin (for example `https://your-service.onrender.com`) in the admin page before trying to log in.
