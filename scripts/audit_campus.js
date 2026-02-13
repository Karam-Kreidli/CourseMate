// Audit: Check which campuses the app's major courses have sections on
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

// Read all add_*_courses*.sql files to extract course IDs for each major
const supabaseDir = path.join(__dirname, '..', 'supabase');
const courseFiles = fs.readdirSync(supabaseDir).filter(f => f.startsWith('add_') && f.includes('courses') && f.endsWith('.sql'));

// Extract major_courses INSERT entries: ('MAJOR', 'COURSEID')
const majorCourses = {}; // { major: Set<courseId> }
for (const file of courseFiles) {
    const content = fs.readFileSync(path.join(supabaseDir, file), 'utf-8');
    // Match INSERT INTO major_courses lines
    const matches = content.matchAll(/\('(\w+)',\s*'(\d{7})'\)/g);
    for (const m of matches) {
        const major = m[1];
        const courseId = m[2];
        if (!majorCourses[major]) majorCourses[major] = new Set();
        majorCourses[major].add(courseId);
    }
}

console.log('=== Majors and course counts ===');
for (const [major, courses] of Object.entries(majorCourses)) {
    console.log(`  ${major}: ${courses.size} courses`);
}

// Build a map of courseId (subjectCourse) -> list of { crn, campus, section }
const courseMap = {}; // { courseId: [{ crn, campus, section }] }
for (const dept of Object.values(d)) {
    const sections = Array.isArray(dept) ? dept : Object.values(dept).flat();
    for (const s of sections) {
        if (!s.subjectCourse) continue;
        const courseId = s.subjectCourse;
        const campus = decode(s.campusDescription);
        const crn = s.courseReferenceNumber;
        const section = s.sequenceNumber;
        if (!courseMap[courseId]) courseMap[courseId] = [];
        courseMap[courseId].push({ crn, campus, section });
    }
}

// Now audit: for each major's courses, list which campuses have sections
console.log('\n=== Campus audit per major ===\n');

const issues = [];

for (const [major, courses] of Object.entries(majorCourses)) {
    console.log(`\n--- ${major} ---`);
    const campusCounts = {};
    const nonUosSections = [];

    for (const courseId of courses) {
        const sections = courseMap[courseId] || [];
        for (const s of sections) {
            campusCounts[s.campus] = (campusCounts[s.campus] || 0) + 1;
            if (!allowedCampuses.includes(s.campus)) {
                nonUosSections.push({ courseId, crn: s.crn, section: s.section, campus: s.campus });
            }
        }
    }

    console.log('Campus distribution:');
    for (const [campus, count] of Object.entries(campusCounts).sort((a, b) => b[1] - a[1])) {
        const marker = allowedCampuses.includes(campus) ? '✓' : '✗';
        console.log(`  ${marker} ${campus}: ${count} sections`);
    }

    if (nonUosSections.length > 0) {
        console.log(`\n  ⚠ ${nonUosSections.length} sections on non-UOS campuses:`);
        for (const s of nonUosSections.slice(0, 10)) {
            console.log(`    Course ${s.courseId} Section ${s.section} CRN ${s.crn} → ${s.campus}`);
        }
        if (nonUosSections.length > 10) {
            console.log(`    ... and ${nonUosSections.length - 10} more`);
        }
        issues.push(...nonUosSections);
    } else {
        console.log('  ✓ All sections are on allowed UOS campuses');
    }
}

// Also check: are there courses in majors that have NO sections in JSON at all?
console.log('\n=== Courses with NO sections in JSON ===');
for (const [major, courses] of Object.entries(majorCourses)) {
    const missing = [];
    for (const courseId of courses) {
        if (!courseMap[courseId] || courseMap[courseId].length === 0) {
            missing.push(courseId);
        }
    }
    if (missing.length > 0) {
        console.log(`  ${major}: ${missing.join(', ')}`);
    }
}

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Total non-UOS sections across all majors: ${issues.length}`);
if (issues.length > 0) {
    // Generate the list of CRNs that are in the app's sections table AND are non-UOS
    // Read the add_sections SQL files to find which CRNs are actually in the DB
    const sectionFiles = fs.readdirSync(supabaseDir).filter(f => f.includes('section') && f.endsWith('.sql') && !f.includes('cleanup'));
    const dbCRNs = new Set();
    for (const file of sectionFiles) {
        const content = fs.readFileSync(path.join(supabaseDir, file), 'utf-8');
        const matches = content.matchAll(/'(\d{5})'/g);
        for (const m of matches) {
            dbCRNs.add(m[1]);
        }
    }

    const nonUosInDB = issues.filter(i => dbCRNs.has(i.crn));
    console.log(`Non-UOS sections that are ALSO in the DB SQL files: ${nonUosInDB.length}`);
    if (nonUosInDB.length > 0) {
        console.log('These need to be removed:');
        for (const s of nonUosInDB) {
            console.log(`  Course ${s.courseId} CRN ${s.crn} Section ${s.section} → ${s.campus}`);
        }
    }
}
