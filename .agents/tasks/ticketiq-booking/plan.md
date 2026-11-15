# TicketIQ Booking System — Implementation Plan

This plan is decomposed into four sequential FEATs. See the companion FEAT files in `features/`
for per-feature step detail. The sections below give the full ordered plan in one place for
reference; the workflow steps drive execution via the FEAT files.

---

## FEAT-001 — Backend models, migration and Python dependencies

### What
Add the missing fields to `Booking`, create the new `Payment` and `BookingSeat` models,
run the migration, and write `requirements.txt` with the new packages.

### Files
- `backend/cinema_core/models.py` — extend Booking; add Payment, BookingSeat
- `backend/cinema_core/migrations/0003_booking_additions_payment_bookingseat.py` — generated
- `backend/requirements.txt` — created

### Steps
1. In `models.py` add to `Booking.Status`: `PENDING = "pending", "Pending"` and change
   `default=Status.PENDING` on the status field. Add fields:
   - `customer_phone = CharField(max_length=20, blank=True)`
   - `booking_reference = UUIDField(default=uuid.uuid4, unique=True, db_index=True)`
   - `payment_status = CharField(max_length=20, choices=[("pending","Pending"),("paid","Paid"),("failed","Failed")], default="pending")`
2. Add `Payment` model: `booking` OneToOneField→Booking (CASCADE), `razorpay_order_id` CharField(100),
   `razorpay_payment_id` CharField(100, blank=True), `razorpay_signature` CharField(255, blank=True),
   `status` CharField choices pending/paid/failed default pending, `amount` DecimalField(10,2),
   `created_at` auto_now_add, `updated_at` auto_now.
3. Add `BookingSeat` model: `booking` FK→Booking (CASCADE), `seat` FK→CinemaSeat (PROTECT),
   `price_at_booking` DecimalField(10,2). UniqueConstraint on (booking, seat) named
   `unique_booking_seat`.
4. Run `python backend/manage.py makemigrations cinema_core` from the TicketIQ root.
5. Run `python backend/manage.py migrate`.
6. Write `backend/requirements.txt` listing pinned versions of all packages in the venv
   (use `pip freeze` output from the venv) plus `razorpay==1.4.2`, `reportlab==4.2.5`,
   `qrcode[pil]==8.1`, `Pillow==11.3.0` (Pillow 13 already installed — keep what's installed).

### Verify
`python backend/manage.py check` exits 0.
`python backend/manage.py showmigrations cinema_core` shows 0003 as applied `[X]`.

---

## FEAT-002 — Backend APIs (new booking endpoints)

### What
Add all new views to `backend/cinema_core/views_booking.py` and register them in
`backend/cinema_core/urls.py`. Add new serializers to `backend/cinema_core/serializers.py`.
Update `backend/cinema_core/admin.py` to register new models.

### New endpoints

| Method | URL | Permission | Description |
|--------|-----|-----------|-------------|
| GET | `/api/shows/<id>/availability/` | AllowAny | Seat status map; releases expired holds |
| POST | `/api/shows/<id>/hold/` | AllowAny | Hold seats 5 min; returns session_token (= hold_token UUID) |
| DELETE | `/api/shows/<id>/hold/` | AllowAny | Release hold by hold_token in body |
| POST | `/api/bookings/create/` | AllowAny | Create booking from hold; creates Razorpay order (or mock) |
| POST | `/api/payments/verify/` | AllowAny | Verify Razorpay HMAC-SHA256; confirm booking |
| GET | `/api/bookings/<ref>/ticket/` | AllowAny | PDF ticket (reportlab + qrcode) |
| GET | `/api/bookings/<ref>/verify/` | AllowAny | Validate reference; returns show/seat info, no PII |
| POST | `/api/bookings/<id>/cancel/` | AllowAny | Cancel + release seats (extends existing cancel action) |
| GET | `/api/bookings/my/` | IsAuthenticated | Customer's own bookings by email query param |
| GET | `/api/admin/bookings/` | IsAdminUser | Paginated, filterable booking list |
| GET | `/api/admin/bookings/stats/` | IsAdminUser | Aggregate stats |
| GET | `/api/cinemas/<id>/seats/` | IsAdminUser | All seats (including inactive) |
| GET | `/api/cinemas/<id>/capacity/` | AllowAny | Total active seat count |

### Implementation notes
- `POST /api/shows/<id>/hold/`: Create one `SeatReservation` per requested seat with
  `status=HELD`, `hold_token=uuid.uuid4()` (same token for all seats in the batch),
  `expires_at=now+5min`. Use `select_for_update()`. Return `{session_token, expires_at, seats}`.
  `session_token` in the response = the `hold_token` UUID. Reject if any seat already has a
  non-expired reservation.
- `POST /api/bookings/create/`: Accept `{hold_token, customer_name, customer_email,
  customer_phone}`. Validate held seats still belong to that token and not expired.
  In one transaction: create `Booking` (status=pending, payment_status=pending), create
  `BookingSeat` rows, update `SeatReservation.booking=booking, status=booked`. Attempt to
  create Razorpay order via `razorpay.Client`; if `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
  env vars are absent or the call fails, return a mock order id (`mock_order_<uuid>`).
  Return `{booking_id, booking_reference, razorpay_order_id, razorpay_key_id}`.
- `POST /api/payments/verify/`: Accept `{razorpay_order_id, razorpay_payment_id,
  razorpay_signature}`. For real credentials verify HMAC-SHA256; for mock orders
  (`mock_order_` prefix) skip signature check. Update `Payment.status=paid`,
  `Booking.status=confirmed`, `Booking.payment_status=paid`. Idempotent — return success if
  already confirmed. Return `{success: true, booking_reference}`.
- `GET /api/bookings/<ref>/ticket/`: `<ref>` is the UUID booking_reference string.
  Build PDF with reportlab (A4): TicketIQ header, booking_reference as text + as QR code
  (encode only the reference UUID), movie/cinema/show/seats/amount.
  Return as `application/pdf` with `Content-Disposition: attachment`.
- `POST /api/bookings/<id>/cancel/`: Extend the existing `BookingViewSet.cancel` action to
  also delete `BookingSeat` rows and decrement `show.tickets_booked`. The existing action
  already deletes `SeatReservation` rows. Add deletion of `BookingSeat.objects.filter(booking=booking)`.
  Change Booking.status to CANCELLED and payment_status to "failed" if was pending.
- `GET /api/bookings/my/`: Accepts `?email=` query param (no auth session in current stack —
  the brief says "auth required (session)" but DRF is configured with SessionAuthentication;
  for the customer flow there is no login UI yet, so accept email as identifier and annotate
  note in code for future upgrade). Return paginated with seat details.
- `/api/admin/bookings/stats/`: Reuse `BookingViewSet.stats` logic but under admin namespace;
  add per-movie and per-cinema breakdown.

### Serializers to add
- `PaymentSerializer` — all fields read-only except status
- `BookingSeatSerializer` — booking, seat, seat_label (SerializerMethodField), category, price_at_booking
- `BookingDetailSerializer` — full Booking with nested seat list and payment info
- `SeatAvailabilitySerializer` — seat id, row, seat_number, label, category, price, status

### Files
- `backend/cinema_core/views_booking.py` — new file, all new views
- `backend/cinema_core/serializers.py` — append new serializers
- `backend/cinema_core/urls.py` — add new URL patterns
- `backend/cinema_core/admin.py` — register Payment, BookingSeat

### Verify
`python backend/manage.py check` exits 0.
`curl http://127.0.0.1:8000/api/shows/1/availability/` returns 200 or 404 (no 500).

---

## FEAT-003 — Frontend booking pages

### What
Create 7 new pages in `frontend/src/pages/` and wire them into `App.jsx` via extended state
machine. Keep existing sidebar nav and state machine intact.

### Pages
1. `MovieSelection.jsx / .css` — grid of active movies with "Book Now" button per card.
   Reuses movie-card visual style from Movies.jsx. Calls `GET /api/movies/?is_active=true`.
2. `ShowtimeSelection.jsx / .css` — given a selected movie, shows cinemas and showtimes.
   Calls `GET /api/shows/?movie=<id>`. Groups by cinema then date. User picks a show.
3. `SeatSelection.jsx / .css` — full interactive seat map for a show.
   Calls `GET /api/shows/<id>/availability/` on load and polls every 30s.
   Renders each seat as a `<button>` colour-coded: available (grey), selected (blue `#007AFF`),
   held by another (orange `#FF9500`), booked (red/muted `#636366`). Premium/Gold/Silver
   distinguished by row-label legend. User clicks to select/deselect available seats.
   Shows selected count, per-category price breakdown, total. "Continue" button calls
   `POST /api/shows/<id>/hold/` and transitions to Checkout.
4. `Checkout.jsx / .css` — customer details form (name, email, phone) + booking summary.
   On submit calls `POST /api/bookings/create/`. On success, opens Razorpay checkout JS
   (loaded via `<script>` tag with `VITE_RAZORPAY_KEY_ID` env var; if key absent, shows
   "Test mode — click to simulate payment" button that calls `POST /api/payments/verify/`
   with the mock order id). After payment handler success calls verify endpoint.
5. `BookingConfirmation.jsx / .css` — success screen showing booking reference, movie,
   cinema, seats, amount, QR code preview, download ticket button
   (`GET /api/bookings/<ref>/ticket/`).
6. `MyBookings.jsx / .css` — customer view: input email, fetch
   `GET /api/bookings/my/?email=<email>`. Shows upcoming and past bookings.
   Each row has "Download Ticket" and "Cancel" actions.
7. `Bookings.jsx / .css` — admin view replacing the current PlaceholderPage for "Bookings".
   Calls `GET /api/admin/bookings/` with filter params and `GET /api/admin/bookings/stats/`.
   Table with search/filter toolbar, status badges, cancel button per row.

### App.jsx changes
- Import all 7 new pages.
- Add `"My Bookings"` to nav (icon: `Ticket`), insert after Shows in nav array.
- Add booking flow state to App: `bookingStep` (null | "movie" | "showtime" | "seat" |
  "checkout" | "confirmation"), `selectedMovie`, `selectedShow`, `heldSeats`, `sessionToken`,
  `bookingRef`. All initialized to null/empty.
- When nav item "Movies" is clicked AND user clicks "Book Now" on a movie card, set
  `bookingStep="movie"` and render `<MovieSelection>` instead of the existing admin Movies page.
  Decision: add a separate "Book Tickets" nav item (icon: `ShoppingCart`) so the existing
  admin Movies page is undisturbed. The booking flow nav item sets `bookingStep="movie"`.
- Booking flow renders in the content area replacing the main page component when
  `bookingStep !== null`.
- Each flow page receives: `onBack` (go to previous step), `onNext(data)` (go to next step
  with data), and the accumulated booking state as props.
- "Bookings" nav item now renders `<Bookings>` (admin) instead of PlaceholderPage.
- "My Bookings" nav item renders `<MyBookings>`.
- Add `VITE_RAZORPAY_KEY_ID` to `frontend/.env.example` (new file) with placeholder.

### CSS design rules (match existing pages)
- Background: `#ffffff` / `#f5f5f7` (Apple system grey).
- Font: `-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`.
- Primary button: `background #007AFF`, white text, `border-radius 10px`.
- Cards: `border: 1px solid #e5e5ea`, `border-radius: 14px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.06)`.
- Status badges: colour-coded via CSS classes matching pattern in Shows.jsx (`.shows-source`).

### Files
- `frontend/src/pages/MovieSelection.jsx` + `MovieSelection.css`
- `frontend/src/pages/ShowtimeSelection.jsx` + `ShowtimeSelection.css`
- `frontend/src/pages/SeatSelection.jsx` + `SeatSelection.css`
- `frontend/src/pages/Checkout.jsx` + `Checkout.css`
- `frontend/src/pages/BookingConfirmation.jsx` + `BookingConfirmation.css`
- `frontend/src/pages/MyBookings.jsx` + `MyBookings.css`
- `frontend/src/pages/Bookings.jsx` + `Bookings.css`
- `frontend/src/App.jsx` — updated
- `frontend/.env.example` — new

### Verify
`cd frontend && npm run build` completes with 0 errors.

---

## FEAT-004 — Tests, verification and deliverable

### What
Convert the empty `cinema_core/tests.py` to a package. Write test modules. Run final checks.
Write `IMPLEMENTATION.md`.

### Test modules

**`backend/cinema_core/tests/__init__.py`** — empty

**`backend/cinema_core/tests/test_seats.py`**
- `test_seat_generation_creates_correct_count` — POST `/api/seats/generate/` with valid params,
  assert created_seats == rows × seats_per_row.
- `test_seat_generation_is_idempotent` — call generate twice, assert second call created_seats == 0.
- `test_seat_requires_valid_cinema` — generate with nonexistent cinema_id returns 400.

**`backend/cinema_core/tests/test_availability.py`**
- `test_availability_returns_all_seats` — GET `/api/shows/<id>/availability/` returns seat list.
- `test_hold_creates_reservation` — POST hold, assert SeatReservation exists with HELD status.
- `test_hold_prevents_double_booking` — two requests for same seat; second returns 409.
- `test_expired_hold_is_released` — set expires_at in past, GET availability, assert seat available.
- `test_hold_validates_seat_belongs_to_show_cinema` — seat from different cinema returns 400.

**`backend/cinema_core/tests/test_booking.py`**
- `test_create_booking_from_hold` — full flow: hold → create booking → assert Booking+BookingSeat.
- `test_payment_verify_confirms_booking` — POST verify with mock order, assert status confirmed.
- `test_cancel_releases_seats` — confirm booking, cancel, assert SeatReservation deleted.
- `test_cancel_already_cancelled` — idempotent cancel returns success message.
- `test_pdf_ticket_returns_pdf` — GET ticket endpoint returns content-type application/pdf.

**`backend/cinema_core/tests/test_auth.py`**
- `test_admin_bookings_requires_staff` — anonymous GET `/api/admin/bookings/` returns 403.
- `test_my_bookings_returns_only_own` — bookings for email A not visible when querying email B.
- `test_seat_generate_requires_staff` — anonymous POST generate returns 403.

**`backend/cinema_core/tests/test_ticket.py`**
- `test_verify_booking_reference_returns_no_pii` — GET `/api/bookings/<ref>/verify/` response
  does not contain customer_email or customer_phone.
- `test_verify_nonexistent_ref_returns_404` — random UUID returns 404.

### Final verification steps
1. Delete `backend/cinema_core/tests.py` (replaced by package).
2. `python backend/manage.py check` — must exit 0.
3. `python backend/manage.py test cinema_core` — all tests pass.
4. `cd frontend && npm run build` — must exit 0.
5. Write `c:\Users\kindi\OneDrive\Documents\TicketIQ\IMPLEMENTATION.md` documenting all
   endpoints, env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID`),
   how to run backend (`cd backend && python manage.py runserver`) and frontend
   (`cd frontend && npm run dev`), and test mode instructions.

### Files
- `backend/cinema_core/tests/__init__.py`
- `backend/cinema_core/tests/test_seats.py`
- `backend/cinema_core/tests/test_availability.py`
- `backend/cinema_core/tests/test_booking.py`
- `backend/cinema_core/tests/test_auth.py`
- `backend/cinema_core/tests/test_ticket.py`
- `backend/cinema_core/tests.py` — deleted
- `c:\Users\kindi\OneDrive\Documents\TicketIQ\IMPLEMENTATION.md`

### Verify
`python backend/manage.py test cinema_core` — all tests pass (or clearly documented skips for
Razorpay live tests).
`cd frontend && npm run build` — 0 errors.

---

## Digest

| File | Block / change | Test coverage | Verified today |
|------|---------------|---------------|----------------|
| `backend/cinema_core/models.py` | `Booking` class (lines ~85–110): add 3 fields + PENDING status. Add `Payment` model (new). Add `BookingSeat` model (new). | test_booking.py | `manage.py check` passes today |
| `backend/cinema_core/migrations/0003_*.py` | Generated by makemigrations | — | Must run migrate after generation |
| `backend/cinema_core/serializers.py` | Append `PaymentSerializer`, `BookingSeatSerializer`, `BookingDetailSerializer`, `SeatAvailabilitySerializer` after existing `SeatReservationSerializer` | test_booking.py, test_availability.py | — |
| `backend/cinema_core/views_booking.py` | New file: `ShowAvailabilityView`, `HoldSeatsView`, `CreateBookingView`, `PaymentVerifyView`, `TicketView`, `BookingVerifyView`, `MyBookingsView`, `AdminBookingsView`, `AdminBookingStatsView`, `CinemaSeatListView`, `CinemaCapacityView` | test_availability.py, test_booking.py, test_auth.py, test_ticket.py | — |
| `backend/cinema_core/views.py` | `BookingViewSet.cancel` action (~line 150): add `BookingSeat.objects.filter(booking=booking).delete()` | test_booking.py | Existing `cancel` action present and confirmed at line ~128 |
| `backend/cinema_core/urls.py` | Add 13 new `path()` entries for all new endpoints | all test modules | Existing 4 patterns confirmed |
| `backend/cinema_core/admin.py` | Register `Payment`, `BookingSeat` | — | File exists (empty register) |
| `backend/requirements.txt` | New file: pinned deps including razorpay==1.4.2, reportlab==4.2.5, qrcode[pil]==8.1 | — | Pillow 13.0.0 and psycopg 3.3.9 confirmed in venv |
| `frontend/src/App.jsx` | Import 7 new pages. Add "Book Tickets" + "My Bookings" to nav. Add `bookingStep` + booking state. Render booking flow when `bookingStep !== null`. Render `<Bookings>` for "Bookings" nav item. | npm run build | Existing 4 page renderers confirmed |
| `frontend/src/pages/MovieSelection.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/ShowtimeSelection.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/SeatSelection.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/Checkout.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/BookingConfirmation.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/MyBookings.jsx` + `.css` | New file | npm run build | — |
| `frontend/src/pages/Bookings.jsx` + `.css` | New file | npm run build | — |
| `frontend/.env.example` | New file: `VITE_RAZORPAY_KEY_ID=your_key_here` | — | — |
| `backend/cinema_core/tests/__init__.py` | Empty | — | — |
| `backend/cinema_core/tests/test_seats.py` | 3 test cases | `manage.py test cinema_core` | — |
| `backend/cinema_core/tests/test_availability.py` | 5 test cases | `manage.py test cinema_core` | — |
| `backend/cinema_core/tests/test_booking.py` | 5 test cases | `manage.py test cinema_core` | — |
| `backend/cinema_core/tests/test_auth.py` | 3 test cases | `manage.py test cinema_core` | — |
| `backend/cinema_core/tests/test_ticket.py` | 2 test cases | `manage.py test cinema_core` | — |
| `IMPLEMENTATION.md` | New file at repo root | — | — |

**Build command:** `python backend/manage.py check` / `python backend/manage.py test cinema_core`
**Frontend build:** `cd frontend && npm run build`
**Tests passing today:** `python backend/manage.py check` exits 0 (confirmed by existing migrations).
**Venv confirmed packages:** Django 5.2.19, DRF 3.18.3, psycopg 3.3.9, Pillow 13.0.0, python-dotenv present.
**Missing packages (must install):** razorpay, reportlab, qrcode — not found in venv.
