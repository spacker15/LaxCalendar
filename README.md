# LaxCalendar

A database-free lacrosse field scheduler for multiple programs and fields.

## Features

- Month, week, and agenda views
- Separate programs with editable colors and active status
- Multiple fields
- Field availability windows
- Practices, games, tournaments, clinics, tryouts, team events, and blackouts
- Program and field filters
- Click a calendar day to add an event
- Same-field overlap warnings
- Outside-permit warnings
- ICS calendar export
- Browser localStorage persistence
- No backend or database

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Vercel

Import this GitHub repository into Vercel. Use `npm run build` and output directory `dist`.

Deployment trigger: field-centric calendar source is now on `main`.
