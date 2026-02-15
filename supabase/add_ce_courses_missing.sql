-- =====================================================
-- ADD MISSING COMPUTER ENGINEERING COURSES
-- Based on the provided curriculum list
-- =====================================================

-- 1. CLEANUP OLD DATA FIRST
-- Reset CE major courses
DELETE FROM major_courses WHERE major_code = 'CE';

-- Delete orphaned courses (courses not linked to any major)
-- This removes any "wrong" courses that were only linked to CE
DELETE FROM courses 
WHERE course_id NOT IN (SELECT DISTINCT course_id FROM major_courses);

-- Explicitly remove wrong course if it still exists
DELETE FROM courses WHERE course_id = '1802100';


-- 2. INSERT COURSES
INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
-- Electrical Engineering (0402)
('0402202', '0402', 'Department of Electrical Engineering', '202', 'Circuit Analysis I'),
('0402203', '0402', 'Department of Electrical Engineering', '203', 'Circuit Analysis I Laboratory'),
('0402240', '0402', 'Department of Electrical Engineering', '240', 'Signals and Systems'),
('0402241', '0402', 'Department of Electrical Engineering', '241', 'Random Signal Theory'),
('0402250', '0402', 'Department of Electrical Engineering', '250', 'Fund. of Elec. Circuits'),
('0402251', '0402', 'Department of Electrical Engineering', '251', 'Fund. of Elec. Circuits Lab.'),
('0402340', '0402', 'Department of Electrical Engineering', '340', 'Eng. Comp. & Linear Algebra'),
('0402346', '0402', 'Department of Electrical Engineering', '346', 'Telecommunication Systems 1'),
('0402347', '0402', 'Department of Electrical Engineering', '347', 'Telecommunication Systems Lab'),
('0402330', '0402', 'Department of Electrical Engineering', '330', 'Feedback Control Systems'),
('0402341', '0402', 'Department of Electrical Engineering', '341', 'Multimedia Technology Lab'),
('0402353', '0402', 'Department of Electrical Engineering', '353', 'Electronic Circuits'),
('0402354', '0402', 'Department of Electrical Engineering', '354', 'Electronic Circuits Laboratory'),
('0402416', '0402', 'Department of Electrical Engineering', '416', 'Grid Connected PV System'),
('0402437', '0402', 'Department of Electrical Engineering', '437', 'Programmable Logic Cont. & App'),
('0402442', '0402', 'Department of Electrical Engineering', '442', 'Telecommunication Systems 2'),
('0402444', '0402', 'Department of Electrical Engineering', '444', 'Digital Signal Processing'),
('0402446', '0402', 'Department of Electrical Engineering', '446', 'Cellular Telephony'),
('0402447', '0402', 'Department of Electrical Engineering', '447', 'Wireless Communication'),
('0402448', '0402', 'Department of Electrical Engineering', '448', 'Speech Signal Proc. & App.'),
('0402450', '0402', 'Department of Electrical Engineering', '450', 'Special Topics in EE'),
('0402451', '0402', 'Department of Electrical Engineering', '451', 'Spe.Tops. n Control&Automation'),
('0402452', '0402', 'Department of Electrical Engineering', '452', 'Special Topics in Comm. Sys.'),
('0402453', '0402', 'Department of Electrical Engineering', '453', 'Special Topics in Electronics'),
('0402454', '0402', 'Department of Electrical Engineering', '454', 'Special Topics in Signal Proc.'),

-- Computer Science (1501)
('1501211', '1501', 'Department of Computer Science', '211', 'Programming II'),
('1501215', '1501', 'Department of Computer Science', '215', 'Data Structures'),
('1501352', '1501', 'Department of Computer Science', '352', 'Operating Systems'),
('1501263', '1501', 'Department of Computer Science', '263', 'Intro. to Database Manag. Sys.'),
('1501365', '1501', 'Department of Computer Science', '365', 'Software Engineering'),
('1501371', '1501', 'Department of Computer Science', '371', 'Design&Analysis of Algorithms'),
('1501440', '1501', 'Department of Computer Science', '440', 'Intro.to Computer Graphics'),
('1501116', '1501', 'Department of Computer Science', '116', 'Programming I'),
('1501100', '1501', 'Department of Computer Science', '100', 'Introduction to IT(English)'),

-- Computer Engineering (1502)
('1502101', '1502', 'Department of Computer Engineering', '101', 'Introduction to Computer Eng.'),
('1502111', '1502', 'Department of Computer Engineering', '111', 'Discrete Mathematics for Eng.'),
('1502201', '1502', 'Department of Computer Engineering', '201', 'Digital Logic Design'),
('1502202', '1502', 'Department of Computer Engineering', '202', 'Digital Logic Design Lab.'),
('1502232', '1502', 'Department of Computer Engineering', '232', 'Micro. & Assembly Language'),
('1502300', '1502', 'Department of Computer Engineering', '300', 'Pro. & Social Issues in Eng.'),
('1502326', '1502', 'Department of Computer Engineering', '326', 'Computer System Arch.'),
('1502334', '1502', 'Department of Computer Engineering', '334', 'Embedded Systems Design'),
('1502346', '1502', 'Department of Computer Engineering', '346', 'Computer Com. and networks'),
('1502347', '1502', 'Department of Computer Engineering', '347', 'Computer Com. And Networks Lab'),
('1502410', '1502', 'Department of Computer Engineering', '410', 'Artificial Intelligence Eng.'),
('1502420', '1502', 'Department of Computer Engineering', '420', 'Advanced Digital Design'),
('1502444', '1502', 'Department of Computer Engineering', '444', 'Computer and Network Security'),
('1502491', '1502', 'Department of Computer Engineering', '491', 'Senior Design Project I'),
('1502492', '1502', 'Department of Computer Engineering', '492', 'Senior Design Project II'),
('1502497', '1502', 'Department of Computer Engineering', '497', 'Practical Training in Com.Eng.'),
('1502412', '1502', 'Department of Computer Engineering', '412', 'Parallel and Distributed Proc.'),
('1502414', '1502', 'Department of Computer Engineering', '414', 'Verification in Software'),
('1502415', '1502', 'Department of Computer Engineering', '415', 'Real-Time Systems Design'),
('1502424', '1502', 'Department of Computer Engineering', '424', 'High Performance Computer Arch'),
('1502425', '1502', 'Department of Computer Engineering', '425', 'Distributed & Cloud Comp. Sys.'),
('1502430', '1502', 'Department of Computer Engineering', '430', 'Design of IOT Systems'),
('1502443', '1502', 'Department of Computer Engineering', '443', 'Comp. Net. Design & Analysis'),
('1502445', '1502', 'Department of Computer Engineering', '445', 'Digital Image Processing'),
('1502449', '1502', 'Department of Computer Engineering', '449', 'Auto.Robotics &Act. Vision Sys'),
('1502452', '1502', 'Department of Computer Engineering', '452', 'VLSI Design'),
('1502460', '1502', 'Department of Computer Engineering', '460', 'Special Topics in CE'),
('1502463', '1502', 'Department of Computer Engineering', '463', 'Special Topics in SCA'),
('1502465', '1502', 'Department of Computer Engineering', '465', 'Special Topics in Micro.& VLSI'),
('1502493', '1502', 'Department of Computer Engineering', '493', 'Senior Seminar in Com.Eng.'),
('1502133', '1502', 'Department of Computer Engineering', '133', 'Introduction to AI'),

-- Energy Engineering (0406)
('0406320', '0406', 'Department of Energy Engineering', '320', 'Solar PV Systems'),

-- Arts & Humanities (0202)
('0202207', '0202', 'College of Arts & Humanities', '207', 'Technical Writing'),
('0202112', '0202', 'College of Arts & Humanities', '112', 'English for Academic Purposes'),
('0202130', '0202', 'College of Arts & Humanities', '130', 'French Language'),
('0202227', '0202', 'College of Arts & Humanities', '227', 'Critical Reading and Writing'),

-- Chemistry (1420)
('1420101', '1420', 'Department of Chemistry', '101', 'General Chemistry (1)'),
('1420102', '1420', 'Department of Chemistry', '102', 'General Chemistry (1) Lab'),

-- Physics (1430)
('1430108', '1430', 'Department of Physics', '108', 'Remedial physics'),
('1430115', '1430', 'Department of Physics', '115', 'Physics 1'),
('1430116', '1430', 'Department of Physics', '116', 'Physics 1 Lab'),
('1430117', '1430', 'Department of Physics', '117', 'Physics 2'),
('1430118', '1430', 'Department of Physics', '118', 'Physics 2 Lab'),

-- Mathematics (1440)
('1440098', '1440', 'Department of Mathematics', '098', 'Remedial Math'),
('1440133', '1440', 'Department of Mathematics', '133', 'Calculus I for Engineering'),
('1440161', '1440', 'Department of Mathematics', '161', 'Calculus II for Engineers'),
('1440261', '1440', 'Department of Mathematics', '261', 'Diff. Equs for Engr.'),

-- Sharia & Islamic Studies (0103, 0104)
('0103103', '0103', 'College of Sharia & Islamic Studies', '103', 'Islamic System'),
('0103104', '0103', 'College of Sharia & Islamic Studies', '104', 'Prof. Ethics in Islamic Sharia'),
('0104100', '0104', 'College of Sharia & Islamic Studies', '100', 'Islamic Culture'),
('0104130', '0104', 'College of Sharia & Islamic Studies', '130', 'Analytical Biog of the Prophet'),

-- Arabic (0201)
('0201102', '0201', 'College of Arts & Humanities', '102', 'Arabic Language'),
('0201140', '0201', 'College of Arts & Humanities', '140', 'Intro. to Arabic Literature'),

-- History/Civilization (0203)
('0203100', '0203', 'College of Arts & Humanities', '100', 'Islamic Civilization'),
('0203102', '0203', 'College of Arts & Humanities', '102', 'History of the Arabian Gulf'),
('0203200', '0203', 'College of Arts & Humanities', '200', 'Hist of Sciences among Muslims'),

-- Sociology (0204)
('0204102', '0204', 'College of Arts & Humanities', '102', 'UAE Society'),
('0204103', '0204', 'College of Arts & Humanities', '103', 'Principles of Sign Language'),

-- Psychology/Education (0206)
('0206102', '0206', 'College of Arts & Humanities', '102', 'Fundamentals/Islamic Education'),
('0206103', '0206', 'College of Arts & Humanities', '103', 'Introduction to Psychology'),

-- Business (0302, 0308, 0300)
('0302150', '0302', 'College of Business Administration', '150', 'Intro.to Bus for Non-Bus.'),
('0302200', '0302', 'College of Business Administration', '200', 'Fund. of Innovation & Entrep.'),
('0308131', '0308', 'College of Business Administration', '131', 'Personal Finance'),
('0300150', '0300', 'College of Business Administration', '150', 'Intro to Economics(Non-B)'),

-- Science (0401, 0406)
('0401142', '0401', 'College of Sciences', '142', 'Man and The Environment'),
('0406102', '0406', 'College of Sciences', '102', 'Introduction to Sustainability'),

-- Health Sciences (0503, 0505, 0507)
('0503101', '0503', 'College of Health Sciences', '101', 'Health and Safety'),
('0505100', '0505', 'College of Health Sciences', '100', 'Understanding Disabilities'),
('0505101', '0505', 'College of Health Sciences', '101', 'Fitness and Wellness'),
('0507101', '0507', 'College of Health Sciences', '101', 'Health Awareness and Nutrition'),

-- Law (0601, 0602)
('0601101', '0601', 'College of Law', '101', 'Legal Culture'),
('0602246', '0602', 'College of Law', '246', 'Human Rights in Islam'),

-- Fine Arts (0700)
('0700100', '0700', 'College of Fine Arts & Design', '100', 'Intro to Islamic Art & Design'),

-- Communication (0800)
('0800107', '0800', 'College of Communication', '107', 'Media in Modern Societies'),

-- Medicine (0900)
('0900107', '0900', 'College of Medicine', '107', 'History of Medical and H.Sc.'),

-- Education (1602)
('1602100', '1602', 'College of Education', '100', 'Smart & Effec. Learning Skills')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name,
    college_code = EXCLUDED.college_code,
    college_name = EXCLUDED.college_name,
    course_number = EXCLUDED.course_number;

-- 3. LINK COURSES TO CE
INSERT INTO major_courses (major_code, course_id)
SELECT 'CE', course_id 
FROM courses 
WHERE course_id IN (
    '0402202', '0402203', '0402240', '0402241', '0402250', '0402251', '0402340', '0402346', '0402347', 
    '0402330', '0402341', '0402353', '0402354', '0402416', '0402437', '0402442', '0402444', '0402446', 
    '0402447', '0402448', '0402450', '0402451', '0402452', '0402453', '0402454',
    '1501211', '1501215', '1501352', '1501263', '1501365', '1501371', '1501440', '1501116', '1501100',
    '1502101', '1502111', '1502201', '1502202', '1502232', '1502300', '1502326', '1502334', '1502346', 
    '1502347', '1502410', '1502420', '1502444', '1502491', '1502492', '1502497', '1502412', '1502414', 
    '1502415', '1502424', '1502425', '1502430', '1502443', '1502445', '1502449', '1502452', '1502460', 
    '1502463', '1502465', '1502493', '1502133',
    '0406320',
    '0202207', '0202112', '0202130', '0202227',
    '1420101', '1420102',
    '1430108', '1430115', '1430116', '1430117', '1430118',
    '1440098', '1440133', '1440161', '1440261',
    '0103103', '0103104', '0104100', '0104130',
    '0201102', '0201140',
    '0203100', '0203102', '0203200',
    '0204102', '0204103',
    '0206102', '0206103',
    '0302150', '0302200', '0308131', '0300150',
    '0401142', '0406102',
    '0503101', '0505100', '0505101', '0507101',
    '0601101', '0602246',
    '0700100',
    '0800107',
    '0900107',
    '1602100'
)
ON CONFLICT (major_code, course_id) DO NOTHING;
