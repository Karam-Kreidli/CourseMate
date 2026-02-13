-- =====================================================
-- BIOMEDICAL INFORMATICS MAJOR COURSES
-- Run this AFTER add_majors.sql
-- =====================================================

-- STEP 1: Add Biomedical Informatics major
INSERT INTO majors (code, name, college) VALUES
    ('BI', 'Biomedical Informatics', 'College of Computing and Informatics')
ON CONFLICT (code) DO NOTHING;

-- STEP 2: Add missing courses that don't exist yet
INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
-- College of Health Sciences
('0904252', '0904', 'College of Health Sciences', '252', 'Biostatistics'),
('0900101', '0900', 'College of Medicine', '101', 'Human Biology'),
('0900307', '0900', 'College of Medicine', '307', 'Intro. to Sys. Bio. Modelling'),
('0900324', '0900', 'College of Medicine', '324', 'Biomedical Ethics'),
('0900409', '0900', 'College of Medicine', '409', 'Computational Genomics'),
('0900412', '0900', 'College of Medicine', '412', 'Statistical Genomics'),

-- Chemistry
('1426155', '1420', 'Department of Chemistry', '155', 'General Chemistry for HS'),

-- Physics
('1430107', '1430', 'Department of Physics', '107', 'Physics for Health Sci.'),

-- Mathematics
('1440163', '1440', 'Department of Mathematics', '163', 'Calc. I for Health Sc.'),
('1440211', '1440', 'Department of Mathematics', '211', 'Linear Algebra I'),

-- Biology
('1450101', '1450', 'Department of Biology', '101', 'General Biology 1'),
('1450102', '1450', 'Department of Biology', '102', 'General Biology 2'),
('1450107', '1450', 'Department of Biology', '107', 'General Biology Lab'),
('1450302', '1450', 'Department of Biology', '302', 'Biometrics'),
('1450303', '1450', 'Department of Biology', '303', 'Bioinformatics Lab'),
('1450341', '1450', 'Department of Biology', '341', 'Molecular Genetics'),
('1450453', '1450', 'Department of Biology', '453', 'Protein Biochemistry & Eng.'),

-- Computer Science - Biomedical Informatics specific
('1501250', '1501', 'Department of Computer Science', '250', 'Networking Fundamentals'),
('1501279', '1501', 'Department of Computer Science', '279', 'Discrete Structures'),
('1501318', '1501', 'Department of Computer Science', '318', 'Programming for Bioinformatics'),
('1501330', '1501', 'Department of Computer Science', '330', 'Introduction to Artif.Intelig.'),
('1501332', '1501', 'Department of Computer Science', '332', 'Machine Learning for Bioinfor.'),
('1501364', '1501', 'Department of Computer Science', '364', 'Big Data Analytics'),
('1501391', '1501', 'Department of Computer Science', '391', 'Junior Project in Bioinfor.'),
('1501392', '1501', 'Department of Computer Science', '392', 'Practical Training - BI'),
('1501435', '1501', 'Department of Computer Science', '435', 'Medical Image Processing'),
('1501497', '1501', 'Department of Computer Science', '497', 'Senior Project in Bioinfor.'),
('1501452', '1501', 'Department of Computer Science', '452', 'Introduction to IoT Systems'),
('1501454', '1501', 'Department of Computer Science', '454', 'Cloud Computing'),
('1501455', '1501', 'Department of Computer Science', '455', 'Database Security'),
('1501458', '1501', 'Department of Computer Science', '458', 'Mobile Application & Design'),
('1501459', '1501', 'Department of Computer Science', '459', 'Information Security'),
('1501460', '1501', 'Department of Computer Science', '460', 'Development of Web Applica.'),
('1501490', '1501', 'Department of Computer Science', '490', 'Topics in Computer Science I'),
('1501491', '1501', 'Department of Computer Science', '491', 'Topics in Computer Science II'),
('1501492', '1501', 'Department of Computer Science', '492', 'Special Topics in IT'),

-- Computer Engineering
('1502442', '1502', 'Department of Computer Engineering', '442', 'Network Programming'),

-- Data Mining (using existing course_id format)
('1501458DM', '1501', 'Department of Computer Science', '458', 'Data Mining')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name;

-- STEP 3: Add major_courses relationships for Biomedical Informatics
INSERT INTO major_courses (major_code, course_id) VALUES
-- General Education (Sharia & Islamic Studies)
('BI', '0103103'),
('BI', '0103104'),
('BI', '0104100'),
('BI', '0104130'),

-- Arts & Humanities
('BI', '0201140'),
('BI', '0202112'),
('BI', '0202130'),
('BI', '0202227'),
('BI', '0203100'),
('BI', '0203200'),
('BI', '0204102'),
('BI', '0204103'),
('BI', '0206102'),
('BI', '0206103'),

-- Business Administration
('BI', '0302150'),
('BI', '0302200'),
('BI', '0308131'),
('BI', '0308150'),

-- Sciences
('BI', '0401142'),
('BI', '0406102'),

-- Health Sciences
('BI', '0503101'),
('BI', '0505100'),
('BI', '0505101'),
('BI', '0507101'),

-- Law
('BI', '0601109'),
('BI', '0602246'),

-- Fine Arts & Design
('BI', '0700100'),

-- Communication
('BI', '0800107'),

-- Medicine
('BI', '0900107'),

-- Education
('BI', '1602100'),

-- Computer Science Core
('BI', '1501116'),
('BI', '1501211'),
('BI', '1501215'),
('BI', '1501250'),
('BI', '1501263'),
('BI', '1501279'),
('BI', '1501318'),
('BI', '1501330'),
('BI', '1501332'),
('BI', '1501364'),
('BI', '1501371'),
('BI', '1501391'),
('BI', '1501392'),
('BI', '1501435'),
('BI', '1501452'),
('BI', '1501454'),
('BI', '1501455'),
('BI', '1501458'),
('BI', '1501459'),
('BI', '1501460'),
('BI', '1501490'),
('BI', '1501491'),
('BI', '1501492'),
('BI', '1501497'),

-- Computer Engineering
('BI', '1502201'),
('BI', '1502442'),

-- Chemistry
('BI', '1420101'),
('BI', '1426155'),

-- Physics
('BI', '1430107'),

-- Mathematics
('BI', '1440163'),
('BI', '1440211'),

-- Biology
('BI', '1450101'),
('BI', '1450102'),
('BI', '1450107'),
('BI', '1450302'),
('BI', '1450303'),
('BI', '1450341'),
('BI', '1450453'),

-- Biostatistics & Medical
('BI', '0904252'),
('BI', '0900101'),
('BI', '0900107'),
('BI', '0900307'),
('BI', '0900324'),
('BI', '0900409'),
('BI', '0900412')

ON CONFLICT (major_code, course_id) DO NOTHING;
