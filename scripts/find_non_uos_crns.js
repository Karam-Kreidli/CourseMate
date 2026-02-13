// Script to find CRNs from non-UOS campuses and generate cleanup SQL
const path = require('path');
const d = require(path.join(__dirname, '..', 'data_202520.json'))['202520'];

const allowedCampuses = [
    "UOS Main Campus",
    "UOS Men's Campus",
    "UOS Women's Campus"
];

function decode(s) {
    return s.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

const nonUosCRNs = new Set();
const uosCRNs = new Set();

for (const dept of Object.values(d)) {
    const sections = Array.isArray(dept) ? dept : Object.values(dept).flat();
    for (const s of sections) {
        if (!s.courseReferenceNumber) continue;
        const crn = s.courseReferenceNumber;
        let campus = decode(s.campusDescription || '');
        if (allowedCampuses.includes(campus)) {
            uosCRNs.add(crn);
        } else {
            nonUosCRNs.add(crn);
        }
    }
}

console.log('UOS campus CRNs:', uosCRNs.size);
console.log('Non-UOS campus CRNs:', nonUosCRNs.size);

// Generate SQL to delete non-UOS sections
const nonUosArr = [...nonUosCRNs];
if (nonUosArr.length > 0) {
    const crnList = nonUosArr.map(c => `'${c}'`).join(', ');
    const sql = `-- Delete sections from non-UOS campuses (Al-Dhaid, Khorfakan, FineArts, Medical)\n-- Only keep: UOS Main Campus, UOS Men's Campus, UOS Women's Campus\n\nDELETE FROM sections WHERE crn IN (${crnList});`;
    require('fs').writeFileSync('./supabase/cleanup_non_uos_sections.sql', sql);
    console.log('\nGenerated: supabase/cleanup_non_uos_sections.sql');
    console.log('CRNs to delete:', nonUosArr.length);
} else {
    console.log('\nNo non-UOS sections found in database.');
}
