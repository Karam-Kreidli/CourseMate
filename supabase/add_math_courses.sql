-- =====================================================
-- POPULATE MATHEMATICS MAJOR COURSES
-- Run this AFTER add_math_courses_missing.sql
-- =====================================================

-- First, add MATH major to majors table
INSERT INTO majors (code, name, college) VALUES
    ('MATH', 'Mathematics', 'College of Sciences')
ON CONFLICT (code) DO NOTHING;

-- Now add course relationships
INSERT INTO major_courses (major_code, course_id) VALUES
-- Computer Science
('MATH', '1501116'),
('MATH', '1501211'),
('MATH', '1501215'),
('MATH', '1501246'),
('MATH', '1501263'),
('MATH', '1501100'),
('MATH', '1501333'),
('MATH', '1501352'),
('MATH', '1501366'),
('MATH', '1501440'),

-- Computer Engineering
('MATH', '1502333'),

-- Sharia & Islamic Studies
('MATH', '0103103'),
('MATH', '0103104'),
('MATH', '0104100'),
('MATH', '0104130'),

-- Arts & Humanities
('MATH', '0201102'),
('MATH', '0201140'),
('MATH', '0202112'),
('MATH', '0202130'),
('MATH', '0202227'),
('MATH', '0203100'),
('MATH', '0203200'),
('MATH', '0204102'),
('MATH', '0204103'),
('MATH', '0206102'),
('MATH', '0206103'),

-- Business Administration
('MATH', '0302150'),
('MATH', '0302200'),
('MATH', '0308131'),
('MATH', '0308150'),

-- Sciences
('MATH', '0401142'),
('MATH', '0406102'),

-- Health Sciences
('MATH', '0503101'),
('MATH', '0505100'),
('MATH', '0505101'),
('MATH', '0507101'),

-- Law
('MATH', '0601109'),
('MATH', '0602246'),

-- Fine Arts & Design
('MATH', '0700100'),

-- Communication
('MATH', '0800107'),

-- Medicine
('MATH', '0900107'),

-- Education
('MATH', '1602100'),

-- Chemistry
('MATH', '1420101'),
('MATH', '1420102'),

-- Physics
('MATH', '1430110'),
('MATH', '1430116'),

-- Mathematics Core
('MATH', '1440131'),
('MATH', '1440132'),
('MATH', '1440211'),
('MATH', '1440231'),
('MATH', '1440232'),
('MATH', '1440233'),
('MATH', '1440241'),
('MATH', '1440251'),
('MATH', '1440281'),
('MATH', '1440311'),
('MATH', '1440321'),
('MATH', '1440331'),
('MATH', '1440332'),
('MATH', '1440371'),
('MATH', '1440372'),
('MATH', '1440381'),
('MATH', '1440461'),
('MATH', '1440492'),

-- Mathematics Electives
('MATH', '1440235'),
('MATH', '1440312'),
('MATH', '1440313'),
('MATH', '1440341'),
('MATH', '1440343'),
('MATH', '1440421'),
('MATH', '1440431'),
('MATH', '1440441'),
('MATH', '1440451'),
('MATH', '1440471'),
('MATH', '1440472'),
('MATH', '1440481'),
('MATH', '1440491')

ON CONFLICT (major_code, course_id) DO NOTHING;
