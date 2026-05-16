---
description: How to perform a semester rollover when new section data is available
---

# Semester Rollover Workflow

When a new semester starts and you have a new Banner JSON data file (e.g., `data_202610.json`):

## Prerequisites
- A new JSON data file in the same format as `data_202520.json`, placed in the project root
- The `courses` table in Supabase must be up to date (the script fetches course IDs from it)

## Steps

### Method 1: Direct Execution (Faster)
// turbo
1. Add your `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Get it from Supabase Dashboard → Settings → API).

2. Run the script with the `--run` flag. **Multiple files can be passed at once:**

**Start of semester (rollover) — resets matches/posts/sections for each term:**
```
node extract-sections.js data_202530.json data_202610.json --rollover --run
```

**Mid-semester sync — upserts sections, removes stale ones:**
```
node extract-sections.js data_202530.json data_202610.json --sync --run
```

**Delete a semester entirely (no replacement data):**
```
node extract-sections.js --delete 202530 --run
```

This connects to Supabase and updates the database directly. No manual SQL steps needed.

### Method 2: Generate SQL (Manual)
If you prefer to review the SQL before running it:

// turbo
1. Run without the `--run` flag:
```
node extract-sections.js data_XXXXXX.json --sync
```
This generates `supabase/semester_sync_XXXXXX.sql`.

2. **Review** the generated SQL.

3. **Run** it in Supabase Dashboard → SQL Editor.

### Verifying
Regardless of method:
1. Check `sections` table count in Supabase
2. Spot-check a few sections for correct campus/time

5. Commit and push:
```
git add -A
git commit -m "chore: semester update XXXXXX"
git push origin main
```

## Multi-Semester Support

The system supports **multiple active semesters** simultaneously (e.g., Summer + Fall during concurrent registration).

### How it works
- Each run of `extract-sections.js` auto-creates/updates a row in the `semesters` table
- The term code is extracted from the filename (e.g., `data_202610.json` → term `202610`, name "Fall 2026")
- When 2 semesters are active, users see a toggle in the bottom navigation bar to switch between them
- When only 1 semester is active, the system behaves exactly as before (no toggle)

### Opening a concurrent semester
```bash
# Both Summer and Fall open at the same time
node extract-sections.js data_202530.json data_202610.json --rollover --run
```

### Closing a semester
```bash
# Delete a semester when its registration period ends
node extract-sections.js --delete 202530 --run
```

This deletes all matches, posts, saved schedules, and sections for that term, then deactivates it. The toggle disappears if only 1 semester remains.

### Term code format
- `XXXXXX` = 4-digit year + 2-digit semester
- `10` = Fall, `20` = Spring, `30` = Summer
- Example: `202610` = Fall 2026, `202530` = Summer 2025

## What the script does
- Connects to Supabase and fetches all course IDs from the `courses` table
- Reads each JSON file and detects the term code automatically
- Ensures a semester row exists for each term
- Extracts only sections for courses that exist in the database
- Maps campus descriptions to `main`/`men`/`women` and filters out non-UOS campuses
- Scopes all sync/rollover/delete operations to the specific term (other terms are untouched)

## Adding new majors
If a new major needs to be supported before rollover:
1. Add the major to the `majors` table
2. Add course entries to the `courses` table
3. Add `major_courses` relationships
4. Run the rollover as normal — the script automatically picks up all courses in the database
