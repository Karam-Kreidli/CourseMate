-- =====================================================
-- MAJORS - Major-Based Course Filtering
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Create majors table
CREATE TABLE IF NOT EXISTS majors (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    college TEXT
);

-- STEP 2: Insert the three majors
INSERT INTO majors (code, name, college) VALUES
    ('CS', 'Computer Science', 'College of Computing and Informatics'),
    ('CE', 'Computer Engineering', 'College of Engineering'),
    ('CYBER', 'Cybersecurity Engineering', 'College of Computing and Informatics')
ON CONFLICT (code) DO NOTHING;

-- STEP 3: Create major_courses junction table
CREATE TABLE IF NOT EXISTS major_courses (
    major_code TEXT REFERENCES majors(code) ON DELETE CASCADE,
    course_id TEXT REFERENCES courses(course_id) ON DELETE CASCADE,
    PRIMARY KEY (major_code, course_id)
);

-- STEP 4: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_major_courses_major ON major_courses(major_code);
CREATE INDEX IF NOT EXISTS idx_major_courses_course ON major_courses(course_id);

-- STEP 5: Enable RLS
ALTER TABLE majors ENABLE ROW LEVEL SECURITY;
ALTER TABLE major_courses ENABLE ROW LEVEL SECURITY;

-- STEP 6: RLS Policies - everyone can read majors and major_courses
CREATE POLICY "Majors are viewable by everyone" ON majors
    FOR SELECT USING (true);

CREATE POLICY "Major courses are viewable by everyone" ON major_courses
    FOR SELECT USING (true);

-- STEP 7: Add foreign key constraint to profiles.major
-- First update any existing NULL values or invalid values
UPDATE profiles SET major = NULL WHERE major IS NOT NULL AND major NOT IN ('CS', 'CE', 'CYBER', 'MATH');

-- Note: If you have existing users without a major, they'll need to update their profile
-- The app will prompt them to select a major

-- =====================================================
-- NEXT STEP: Populate major_courses with course IDs
-- You'll need to run INSERT statements like:
-- INSERT INTO major_courses (major_code, course_id) VALUES ('CS', '1234567');
-- =====================================================
