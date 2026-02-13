// Generate a single SQL migration that:
// 1. Adds campus column to sections
// 2. Updates existing sections with campus values from JSON
// 3. Deletes non-UOS campus sections
const path = require('path');
const fs = require('fs');
const d = require(path.join(__dirname, '..', 'data_202520.json'))['202520'];

const allowedCampuses = [
    "UOS Main Campus",
    "UOS Men's Campus",
    "UOS Women's Campus"
];

function decode(s) {
    return (s || '').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

// Build CRN -> campus map from JSON
const crnToCampus = {};
for (const dept of Object.values(d)) {
    const sections = Array.isArray(dept) ? dept : Object.values(dept).flat();
    for (const s of sections) {
        if (!s.courseReferenceNumber) continue;
        crnToCampus[s.courseReferenceNumber] = decode(s.campusDescription);
    }
}

// Read all section SQL files to find CRNs in the database
const supabaseDir = path.join(__dirname, '..', 'supabase');
const sectionFiles = fs.readdirSync(supabaseDir).filter(f =>
    f.includes('section') && f.endsWith('.sql') && !f.includes('cleanup') && !f.includes('campus')
);

const dbCRNs = new Set();
for (const file of sectionFiles) {
    const content = fs.readFileSync(path.join(supabaseDir, file), 'utf-8');
    const matches = [...content.matchAll(/'(\d{5})'/g)];
    for (const m of matches) dbCRNs.add(m[1]);
}

// Categorize DB CRNs
const updateStatements = [];
const deleteCRNs = [];

for (const crn of dbCRNs) {
    const campus = crnToCampus[crn];
    if (!campus) continue; // CRN not found in JSON, skip

    if (allowedCampuses.includes(campus)) {
        // Map campus to short value for storage
        let campusValue;
        if (campus === "UOS Main Campus") campusValue = "main";
        else if (campus === "UOS Men's Campus") campusValue = "men";
        else if (campus === "UOS Women's Campus") campusValue = "women";

        updateStatements.push(`  WHEN '${crn}' THEN '${campusValue}'`);
    } else {
        deleteCRNs.push(`'${crn}'`);
    }
}

// Build the SQL
let sql = `-- =====================================================
-- Campus Migration for Sections Table
-- Adds campus column, populates from data, removes non-UOS sections
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Add campus column
ALTER TABLE sections ADD COLUMN IF NOT EXISTS campus TEXT;

-- STEP 2: Update existing sections with campus values
-- Values: 'main' = UOS Main Campus, 'men' = UOS Men's Campus, 'women' = UOS Women's Campus
UPDATE sections SET campus = CASE crn
${updateStatements.join('\n')}
  ELSE campus
END;

-- STEP 3: Delete sections from non-UOS campuses (Medical, FineArts, Al-Dhaid, Khorfakan)
DELETE FROM sections WHERE crn IN (${deleteCRNs.join(', ')});

-- STEP 4: Add a check constraint for valid campus values
ALTER TABLE sections ADD CONSTRAINT sections_campus_check CHECK (campus IN ('main', 'men', 'women'));
`;

const outPath = path.join(supabaseDir, 'add_campus_to_sections.sql');
fs.writeFileSync(outPath, sql);

console.log(`Generated: supabase/add_campus_to_sections.sql`);
console.log(`  - ${updateStatements.length} sections will get campus values`);
console.log(`  - ${deleteCRNs.length} non-UOS sections will be deleted`);
