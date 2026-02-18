-- =====================================================
-- POPULATE CYBERSECURITY MAJOR COURSES
-- Run this AFTER add_majors.sql
-- =====================================================

INSERT INTO major_courses (major_code, course_id) VALUES
-- Electrical Engineering
('CYBER', '0402340'),

-- Physics
('CYBER', '1430115'),
('CYBER', '1430116'),
('CYBER', '1430117'),
('CYBER', '1430118'),

-- Mathematics
('CYBER', '1440133'),
('CYBER', '1440161'),
('CYBER', '1440261'),

-- Computer Science
('CYBER', '1501100'),
('CYBER', '1501116'),
('CYBER', '1501211'),
('CYBER', '1501215'),

-- Computer Engineering (Core Cybersecurity)
('CYBER', '1502111'),
('CYBER', '1502170'),
('CYBER', '1502201'),
('CYBER', '1502202'),
('CYBER', '1502214'),
('CYBER', '1502220'),
('CYBER', '1502232'),
('CYBER', '1502250'),
('CYBER', '1502252'),
('CYBER', '1502270'),
('CYBER', '1502271'),
('CYBER', '1502300'),
('CYBER', '1502326'),
('CYBER', '1502340'),
('CYBER', '1502346'),
('CYBER', '1502347'),
('CYBER', '1502370'),
('CYBER', '1502371'),
('CYBER', '1502372'),
('CYBER', '1502373'),
('CYBER', '1502410'),
('CYBER', '1502442'),
('CYBER', '1502444'),
('CYBER', '1502450'),
('CYBER', '1502461'),
('CYBER', '1502470'),
('CYBER', '1502471'),
('CYBER', '1502473'),
('CYBER', '1502474'),
('CYBER', '1502494'),
('CYBER', '1502495'),
('CYBER', '1502496'),

-- General Education (Sharia & Islamic Studies)
('CYBER', '0103103'),
('CYBER', '0103104'),
('CYBER', '0104100'),
('CYBER', '0104130'),

-- Arts & Humanities
('CYBER', '0201102'),
('CYBER', '0201140'),
('CYBER', '0202112'),
('CYBER', '0202130'),
('CYBER', '0202227'),
('CYBER', '0203100'),
('CYBER', '0203102'),
('CYBER', '0203200'),
('CYBER', '0204102'),
('CYBER', '0204103'),
('CYBER', '0206102'),
('CYBER', '0206103'),

-- Business Administration
('CYBER', '0302150'),
('CYBER', '0302200'),
('CYBER', '0308131'),
('CYBER', '0308150'),

-- Sciences
('CYBER', '0401142'),
('CYBER', '0406102'),

-- Health Sciences
('CYBER', '0503101'),
('CYBER', '0505100'),
('CYBER', '0505101'),
('CYBER', '0507101'),

-- Law
('CYBER', '0601109'),
('CYBER', '0602246'),

-- Fine Arts & Design
('CYBER', '0700100'),

-- Communication
('CYBER', '0800107'),

-- Medicine
('CYBER', '0900107'),

-- Education
('CYBER', '1602100')

ON CONFLICT (major_code, course_id) DO NOTHING;
