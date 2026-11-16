# Fix Report — Data Mode Switch Review Findings

## Issue 1: Bookings and Predictions behind auth gate in Demo mode

**File changed:** `frontend/src/App.jsx`

### Problem
Both `Bookings` and `Predictions` routes were unconditionally gated behind admin authentication. In Dataset Demo mode these pages serve only local dataset data and do not need database access, so the auth wall was unnecessary and blocked unauthenticated users even when they had selected Demo mode.

### Fix
- Added `const { mode } = useDataMode()` and `const isDemo = mode === DATA_MODES.DEMO` inside `App()`.
- Changed the `useEffect` that triggers the login modal to skip Bookings and Predictions when `isDemo` is true. Only `Settings` remains always protected; Bookings and Predictions are now only gated in Live Database mode.
- Updated the JSX routing conditions from `auth.authenticated ? <Bookings /> : <gate>` to `isDemo || auth.authenticated ? <Bookings /> : <gate>` (and identically for Predictions).
- Updated the gate description text to say "in Live Database mode" so it is accurate.
- `DatasetExplorer` already had no auth gate — no change needed there.

## Issue 2: DatasetExplorer data source badge was hardcoded

**File changed:** `frontend/src/pages/DatasetExplorer.jsx`

### Problem
The page heading rendered `<DataSourceBadge mode={DATA_MODES.DEMO} />` with a hardcoded constant. The badge never changed when the user switched modes.

### Fix
- Added `useDataMode` to the import from `DataModeContext`.
- Called `const { mode } = useDataMode()` at the top of `DatasetExplorer`.
- Replaced `DATA_MODES.DEMO` with `mode` in the heading badge so it reflects the live context value.
- The per-dataset badge inside the detail panel already derives its mode from each dataset's `data_source` field (`real` → `LIVE`, anything else → `DEMO`) and was left unchanged, as that reflects the individual dataset's origin rather than the global switch.

## Verification

Build command: `npm run build` (run in `frontend/`)
Result: **✓ built in 2.28s — 0 errors**

## Pages verified to read mode from context (not hardcoded)

| Page | Source |
|------|--------|
| Movies | `useDataMode()` ✓ |
| Cinemas | `useDataMode()` ✓ |
| Shows | `useDataMode()` ✓ |
| Bookings | `useDataMode()` ✓ |
| Predictions | `useDataMode()` ✓ |
| Dashboard (Overview) | `useDataMode()` ✓ |
| DatasetExplorer | `useDataMode()` ✓ (fixed) |

## DataModeContext verification

`frontend/src/context/DataModeContext.jsx` exports both `useDataMode` and `DataModeProvider` ✓

`DataModeSwitch` calls `setMode()` (which writes to localStorage) on click ✓

localStorage key used: `ticketiq_data_mode` ✓
