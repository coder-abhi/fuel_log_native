# MileTrack

A fast, offline, Android-only fuel-mileage tracker built with Expo + React Native.

Mechanical fuel gauges lie. MileTrack works out your **real** km/litre from the
odometer readings and fill-ups you log by hand, and estimates how much fuel and
range you have left.

## Run it

```bash
npm install
npm start        # then press "a" for Android, or scan the QR with Expo Go
```

Requires an Android device/emulator with **Expo Go** (SDK 54) or a dev build.

## Develop

```bash
npm test            # pure calculation unit tests (Jest / ts-jest)
npm run typecheck   # tsc --noEmit
```

## What's inside

| Area | Where |
| --- | --- |
| Mileage / fuel / stats math (pure, tested) | `src/calc/` |
| SQLite schema + typed DAO | `src/db/` |
| App state (zustand) | `src/store/appStore.ts` |
| Add Fuel / Log Odometer / Log Service sheets | `src/sheets/` |
| Screens (expo-router) | `app/` |

See [CLAUDE.md](./CLAUDE.md) for architecture notes and scope decisions.

## Scope (v1)

Included: multi-vehicle CRUD, fuel / odometer / service logging with past
date-times and edit-in-place, lifetime & since-service mileage, service-interval
bar chart, remaining-fuel / range estimate, driving-pattern stats, unified
history with filters.

Deferred / out of scope: the low-fuel local notification (logic is in place,
not wired), OCR, GPS, cloud sync / accounts, EVs, iOS tuning.
