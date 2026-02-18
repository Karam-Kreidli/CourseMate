-- =====================================================
-- COMMON ELECTIVES (Non-CS Majors)
-- Adds Astro, Biology, and AI to all majors except CS
-- =====================================================

-- STEP 1: Ensure courses exist
INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
('1430101', '1430', 'Department of Physics', '101', 'Astro & Space Sciences'),
('1450100', '1450', 'Department of Applied Biology', '100', 'Biology and Society'),
('1502133', '1502', 'Department of Computer Engineering', '133', 'Introduction to AI')
ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    college_name = EXCLUDED.college_name;

-- STEP 2: Link these courses to ALL majors EXCEPT 'CS'
-- We use a dynamic insert to select all majors except CS and pair them with these 3 courses.

-- 1430101: Astro & Space Sciences
INSERT INTO major_courses (major_code, course_id)
SELECT code, '1430101'
FROM majors
WHERE code != 'CS'
ON CONFLICT (major_code, course_id) DO NOTHING;

-- 1450100: Biology and Society
INSERT INTO major_courses (major_code, course_id)
SELECT code, '1450100'
FROM majors
WHERE code != 'CS'
ON CONFLICT (major_code, course_id) DO NOTHING;

-- 1502133: Introduction to AI
INSERT INTO major_courses (major_code, course_id)
SELECT code, '1502133'
FROM majors
WHERE code != 'CS'
ON CONFLICT (major_code, course_id) DO NOTHING;
