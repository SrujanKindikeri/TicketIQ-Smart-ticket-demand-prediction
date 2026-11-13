# TicketIQ — Implementation Guide

## Overview

TicketIQ is a full-stack cinema ticket booking system built with Django 5.2 + Django REST Framework on the backend and React 19 + Vite on the frontend, backed by PostgreSQL. It supports seat layout management, real-time seat availability, a full customer booking flow with payment via Razorpay, digital PDF tickets with QR codes, and admin booking management.

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd TicketIQ
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Configure environment variables

Copy `.env.example` to `.env` at the project root (same directory as `backend/`) and fill in the values:

```
DJANGO_SECRET_KEY=your-secret-key
DB_NAME=ticketiq_db
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
```

### 5. Create the PostgreSQL database

```sql
CREATE DATABASE ticketiq_db;
```

### 6. Run migrations

```bash
python backend/manage.py migrate
```

### 7. Create a superuser (optional, for admin access)

```bash
python backend/manage.py createsuperuser
```

### 8. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running

### Backend

```bash
cd backend
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api/`.

### Frontend

```bash
cd frontend
npm run dev
```

The frontend dev server runs at `http://localhost:5173`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | Yes | Django secret key for cryptographic signing |
| `DB_NAME` | Yes | PostgreSQL database name |
| `DB_USER` | Yes | PostgreSQL username |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `DB_HOST` | Yes | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | Yes | PostgreSQL port (default: `5432`) |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key ID (use `rzp_test_*` for test mode) |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API secret (backend only, never in frontend) |
| `VITE_RAZORPAY_KEY_ID` | Yes | Razorpay key ID exposed to frontend via Vite |

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/cinemas/` | Public | List all cinemas |
| POST | `/api/cinemas/` | Admin | Create cinema |
| GET | `/api/movies/` | Public | List all movies |
| POST | `/api/movies/` | Admin | Create movie |
| GET | `/api/shows/` | Public | List all shows |
| GET | `/api/shows/upcoming/` | Public | Upcoming shows |
| GET | `/api/shows/<id>/availability/` | Public | Seat availability for a show |
| POST | `/api/shows/<id>/hold/` | Public | Hold seats temporarily (5 min) |
| DELETE | `/api/shows/<id>/hold/` | Public | Release held seats by token |
| POST | `/api/bookings/create/` | Public | Create booking from held seats |
| GET | `/api/bookings/my/?email=<email>` | Authenticated | Customer booking history |
| POST | `/api/bookings/<pk>/cancel/` | Admin | Cancel a booking |
| GET | `/api/bookings/stats/` | Admin | Booking statistics |
| POST | `/api/payments/verify/` | Public | Verify Razorpay payment signature |
| GET | `/api/bookings/<ref>/ticket/` | Public | Download PDF ticket |
| GET | `/api/bookings/<ref>/verify/` | Public | Verify booking reference (no PII) |
| GET | `/api/admin/bookings/` | Admin | Filtered admin booking list |
| GET | `/api/admin/bookings/stats/` | Admin | Admin booking statistics |
| POST | `/api/seats/generate/` | Admin | Generate seat layout for a cinema |
| GET | `/api/seats/layout/?cinema=<id>` | Admin | Get seat layout |
| GET | `/api/cinemas/<id>/seats/` | Admin | All seats (incl. inactive) |
| GET | `/api/cinemas/<id>/capacity/` | Public | Active seat count |
| GET | `/api/dashboard/` | Public | Dashboard summary statistics |
| GET | `/api/predictions/` | Admin | Demand predictions |

---

## Payment Integration

### Razorpay Setup

1. Create a Razorpay account at [razorpay.com](https://razorpay.com).
2. Under **Settings → API Keys**, generate a key pair.
3. For development, use Test Mode keys (prefix `rzp_test_`).
4. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`.
5. Set `VITE_RAZORPAY_KEY_ID` to the same Key ID for the frontend.

### Test Mode Fallback

When `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are not set or the `razorpay` package is unavailable, the backend automatically falls back to **mock mode**:

- `razorpay_order_id` is generated as `mock_order_<hex>`.
- Payment verification skips the HMAC signature check for `mock_order_*` IDs.
- The booking is confirmed immediately.

This allows end-to-end testing without real credentials. It is clearly identified by the `mock_order_` prefix.

### Workflow

1. Frontend POSTs held seats to `/api/bookings/create/` → receives `razorpay_order_id`.
2. Frontend opens Razorpay Checkout with `order_id` and `key_id`.
3. On payment success, frontend POSTs `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` to `/api/payments/verify/`.
4. Backend verifies the HMAC-SHA256 signature and confirms the booking.
5. Frontend redirects to the confirmation page.

---

## Booking Flow

| Step | Action |
|---|---|
| 1 | Customer selects a movie |
| 2 | Customer selects a cinema |
| 3 | Customer selects a date |
| 4 | Customer selects a showtime |
| 5 | Seat selection map loads from `/api/shows/<id>/availability/` |
| 6 | Customer selects seats (available seats only) |
| 7 | Frontend POSTs to `/api/shows/<id>/hold/` → receives `session_token` (5-min TTL) |
| 8 | Customer enters name, email, phone |
| 9 | Booking summary displayed |
| 10 | Customer clicks Pay → Razorpay Checkout opens |
| 11 | Backend verifies signature via `/api/payments/verify/` → booking confirmed |
| 12 | Booking confirmation page shown; PDF ticket downloadable via `/api/bookings/<ref>/ticket/` |

---

## Testing

```bash
# From the TicketIQ project root (venv activated)
python backend/manage.py test cinema_core
```

The test suite runs 18 tests across 5 modules:

| Module | Tests |
|---|---|
| `test_seats.py` | Seat generation count, idempotency, invalid cinema |
| `test_availability.py` | Seat list, hold creation, double-hold prevention, expired hold release, foreign seat validation |
| `test_booking.py` | Full booking from hold, payment verification, cancel releases seats, double cancel, PDF ticket content-type |
| `test_auth.py` | Admin bookings requires staff, my-bookings returns only own, seat generate requires staff |
| `test_ticket.py` | Verify endpoint returns no PII, nonexistent reference returns 404 |
