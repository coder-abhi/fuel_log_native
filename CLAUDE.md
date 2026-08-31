# MileTrack

Android-only React Native (Expo, managed) app that calculates real fuel mileage
(km/l) from manually logged odometer readings and fill-ups, and estimates
remaining fuel / range. Fully offline, no auth, no network.

## Stack

- Expo SDK 54 (`expo` ~54.0.37), React Native 0.81, React 19.1, TypeScript (strict)
- Navigation: **expo-router** (file-based, `app/`)
- Bottom sheets: **@gorhom/bottom-sheet** v5 (+ reanimated 4 / worklets, gesture-handler)
- State: **zustand** (`src/store/appStore.ts`), prefs persisted via AsyncStorage
- DB: **expo-sqlite** with a hand-written typed DAO (`src/db/`) + `PRAGMA user_version` migrations
- Charts: custom **react-native-svg** (no charting lib)
- Dates: `@react-native-community/datetimepicker` (Android imperative API)
- Icons: `@expo/vector-icons` / MaterialCommunityIcons

## Layout

- `src/calc/` — **pure, framework-free** mileage / fuel / stats logic. The most
  important code in the app. Unit-tested with ts-jest (`npm test`, config in
  `jest.config.js` + `tsconfig.jest.json`). No React/RN imports allowed here.
- `src/db/` — SQLite client + one DAO module per table. Rows are snake_case /
  0-1 ints / ISO text; DAOs map to the camelCase domain types from `src/calc`.
- `src/store/appStore.ts` — ties DB + calc together. Every mutation writes to
  SQLite then reloads the raw arrays; screens derive everything via
  `useVehicleStats()` + useMemo, so edits auto-recalculate with no manual step.
- `src/sheets/` — Add Fuel / Log Odometer / Log Service bottom sheets, mounted
  once by `SheetsProvider`; `useSheets()` opens them (also for edit, pre-filled).
- `src/components/` — UI primitives (`ui/`), charts (`charts/`), shared rows.
- `app/` — routes: `(tabs)/` = Home / History / Stats / Vehicles;
  `onboarding.tsx` = forced first-vehicle screen; `vehicle/[id].tsx` = vehicle
  settings (also handles `id === "new"`).

## Commands

- `npm start` / `npm run android` — Expo dev server / open on Android
- `npm test` — calc unit tests (the only tests; UI is verified manually)
- `npm run typecheck` — `tsc --noEmit`
- `npx expo export --platform android` — full Metro bundle (CI smoke check)

## Notable decisions / scope

- Low-fuel **notification is intentionally not implemented** in v1 (deferred).
  `estimateRemainingFuel()` still returns `atOrBelowReserve` for later wiring.
- First launch shows a mandatory add-vehicle screen (no sample seed).
- Mileage math excludes an interval when its later entry is
  `excludedFromMileage`, or (defensively) when `deltaKm <= 0`.
- Driving-pattern distance always counts, even for excluded intervals.
- Only the service-interval bar chart is required; the trend sparkline is a
  lightweight extra.
