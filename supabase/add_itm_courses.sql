-- =====================================================
-- INFORMATION TECHNOLOGY MULTIMEDIA MAJOR COURSES
-- Run this AFTER add_majors.sql
-- =====================================================

-- STEP 1: Add Information Technology Multimedia major
INSERT INTO majors (code, name, college) VALUES
    ('ITM', 'Information Technology Multimedia', 'College of Computing and Informatics')
ON CONFLICT (code) DO NOTHING;

-- STEP 2: Add missing courses that don't exist yet
INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES

-- Computer Science - ITM specific courses not yet in DB
('1501242', '1501', 'Department of Computer Science', '242', 'Interactive Multimedia'),
('1501246', '1501', 'Department of Computer Science', '246', 'Digital Animation'),
('1501330', '1501', 'Department of Computer Science', '330', 'Introduction to Artif.Intelig.'),
('1501341', '1501', 'Department of Computer Science', '341', 'Multimedia Prog.and Design'),
('1501342', '1501', 'Department of Computer Science', '342', '2d/3d Animation'),
('1501343', '1501', 'Department of Computer Science', '343', 'Interactive 3D Design'),
('1501361', '1501', 'Department of Computer Science', '361', 'Obj. On.Software Design & Imp'),
('1501393', '1501', 'Department of Computer Science', '393', 'Multimedia Junior Project'),
('1501394', '1501', 'Department of Computer Science', '394', 'Practical Training'),
('1501396', '1501', 'Department of Computer Science', '396', 'Web Design and Programming'),
('1501444', '1501', 'Department of Computer Science', '444', 'Game Design and Development'),
('1501445', '1501', 'Department of Computer Science', '445', 'IT Application in E.Comm.'),
('1501460', '1501', 'Department of Computer Science', '460', 'Development of Web Applica.'),
('1501494', '1501', 'Department of Computer Science', '494', 'Multimedia Senior Project'),
('1501496', '1501', 'Department of Computer Science', '496', 'Multimedia Senior Project')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name;

-- STEP 3: Add major_courses relationships for Information Technology Multimedia
INSERT INTO major_courses (major_code, course_id) VALUES

-- Sharia & Islamic Studies (General Education)
('ITM', '0103103'),
('ITM', '0103104'),
('ITM', '0104100'),
('ITM', '0104130'),

-- Arts & Humanities
('ITM', '0201102'),
('ITM', '0201140'),
('ITM', '0202112'),
('ITM', '0202130'),
('ITM', '0202227'),
('ITM', '0203100'),
('ITM', '0203102'),
('ITM', '0203200'),
('ITM', '0204102'),
('ITM', '0204103'),
('ITM', '0206102'),
('ITM', '0206103'),

-- Business Administration
('ITM', '0302150'),
('ITM', '0302200'),
('ITM', '0308131'),
('ITM', '0308150'),

-- Sciences
('ITM', '0401142'),
('ITM', '0406102'),

-- Health Sciences
('ITM', '0503101'),
('ITM', '0505100'),
('ITM', '0505101'),
('ITM', '0507101'),

-- Law
('ITM', '0601109'),
('ITM', '0602246'),

-- Fine Arts & Design
('ITM', '0700100'),

-- Communication
('ITM', '0800107'),

-- Medicine
('ITM', '0900107'),

-- Education
('ITM', '1602100'),

-- Mathematics
('ITM', '1440131'),
('ITM', '1440132'),
('ITM', '1440211'),
('ITM', '1440281'),

-- Management
('ITM', '0302170'),

-- Computer Science / IT Core
('ITM', '1501100'),
('ITM', '1501116'),
('ITM', '1501211'),
('ITM', '1501215'),
('ITM', '1501242'),
('ITM', '1501246'),
('ITM', '1501250'),
('ITM', '1501252'),
('ITM', '1501263'),
('ITM', '1501279'),
('ITM', '1501319'),
('ITM', '1501322'),
('ITM', '1501330'),
('ITM', '1501341'),
('ITM', '1501342'),
('ITM', '1501343'),
('ITM', '1501344'),
('ITM', '1501352'),
('ITM', '1501361'),
('ITM', '1501365'),
('ITM', '1501366'),
('ITM', '1501370'),
('ITM', '1501393'),
('ITM', '1501394'),
('ITM', '1501396'),
('ITM', '1501433'),
('ITM', '1501440'),
('ITM', '1501441'),
('ITM', '1501442'),
('ITM', '1501443'),
('ITM', '1501444'),
('ITM', '1501445'),
('ITM', '1501452'),
('ITM', '1501454'),
('ITM', '1501455'),
('ITM', '1501457'),
('ITM', '1501458'),
('ITM', '1501459'),
('ITM', '1501460'),
('ITM', '1501465'),
('ITM', '1501490'),
('ITM', '1501491'),
('ITM', '1501492'),
('ITM', '1501494'),
('ITM', '1501496')

ON CONFLICT (major_code, course_id) DO NOTHING;
