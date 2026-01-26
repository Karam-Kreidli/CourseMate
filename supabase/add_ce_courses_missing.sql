-- =====================================================
-- ADD MISSING COMPUTER ENGINEERING COURSES
-- Run this BEFORE add_ce_courses.sql
-- =====================================================

INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
-- Electrical Engineering
('0402200', '0402', 'Department of Electrical Engineering', '200', 'Circuit Analysis I'),
('0402203', '0402', 'Department of Electrical Engineering', '203', 'Circuit Analysis I Laboratory'),
('0402230', '0402', 'Department of Electrical Engineering', '230', 'Signals and Systems'),
('0402241', '0402', 'Department of Electrical Engineering', '241', 'Random Signal Theory'),
('0402303', '0402', 'Department of Electrical Engineering', '303', 'Fund. of Elec. Circuits'),
('0402304', '0402', 'Department of Electrical Engineering', '304', 'Fund. of Elec. Circuits Lab.'),
('0402345', '0402', 'Department of Electrical Engineering', '345', 'Eng. Comp. & Linear Algebra'),
('0402441', '0402', 'Department of Electrical Engineering', '441', 'Telecommunication Systems 1'),
('0402442', '0402', 'Department of Electrical Engineering', '442', 'Telecommunication Systems Lab'),

-- Computer Science
('1501212', '1501', 'Department of Computer Science', '212', 'Programming II'),
('1501315', '1501', 'Department of Computer Science', '315', 'Data Structures'),
('1501353', '1501', 'Department of Computer Science', '353', 'Operating Systems'),

-- Computer Engineering
('1502101', '1502', 'Department of Computer Engineering', '101', 'Introduction to Computer Eng.'),
('1502203', '1502', 'Department of Computer Engineering', '203', 'Digital Logic Design'),
('1502204', '1502', 'Department of Computer Engineering', '204', 'Digital Logic Design Lab.'),
('1502233', '1502', 'Department of Computer Engineering', '233', 'Micro. & Assembly Language'),
('1502301', '1502', 'Department of Computer Engineering', '301', 'Pro. & Social Issues in Eng.'),
('1502327', '1502', 'Department of Computer Engineering', '327', 'Computer System Arch.'),
('1502334', '1502', 'Department of Computer Engineering', '334', 'Embedded Systems Design'),
('1502341', '1502', 'Department of Computer Engineering', '341', 'Computer Com. and networks'),
('1502342', '1502', 'Department of Computer Engineering', '342', 'Computer Com. And Networks Lab'),
('1502411', '1502', 'Department of Computer Engineering', '411', 'Artificial Intelligence Eng.'),
('1502421', '1502', 'Department of Computer Engineering', '421', 'Advanced Digital Design'),
('1502445', '1502', 'Department of Computer Engineering', '445', 'Computer and Network Security'),
('1502493', '1502', 'Department of Computer Engineering', '493', 'Senior Design Project I'),
('1502494CE', '1502', 'Department of Computer Engineering', '494', 'Senior Design Project II'),
('1502497', '1502', 'Department of Computer Engineering', '497', 'Practical Training in Com.Eng.'),
('1502328', '1502', 'Department of Computer Engineering', '328', 'Feedback Control Systems'),
('1502343', '1502', 'Department of Computer Engineering', '343', 'Multimedia Technologies Lab'),
('1502353', '1502', 'Department of Computer Engineering', '353', 'Electronic Circuits'),
('1502354', '1502', 'Department of Computer Engineering', '354', 'Electronic Circuits Laboratory'),
('1502434', '1502', 'Department of Computer Engineering', '434', 'Grid Connected PV System'),
('1502437', '1502', 'Department of Computer Engineering', '437', 'Programmable Logic Cont. & App'),
('1502443', '1502', 'Department of Computer Engineering', '443', 'Telecommunication Systems 2'),
('1502446', '1502', 'Department of Computer Engineering', '446', 'Digital Signal Processing'),
('1502447', '1502', 'Department of Computer Engineering', '447', 'Cellular Telephony'),
('1502448', '1502', 'Department of Computer Engineering', '448', 'Wireless Communication'),
('1502449', '1502', 'Department of Computer Engineering', '449', 'Speech Signal Proc. & App.'),
('1502460', '1502', 'Department of Computer Engineering', '460', 'Special Topics in EE'),
('1502462', '1502', 'Department of Computer Engineering', '462', 'Sus.Tecs. in CntrlandAutomation'),
('1502463', '1502', 'Department of Computer Engineering', '463', 'Special Topics in Comm. Sys.'),
('1502464', '1502', 'Department of Computer Engineering', '464', 'Special Topics in Electronics'),
('1502465', '1502', 'Department of Computer Engineering', '465', 'Special Topics in Signal Proc.'),
('1502466', '1502', 'Department of Computer Engineering', '466', 'Smart PV System'),
('1501263CE', '1501', 'Department of Computer Science', '263', 'Intro. to Database Manag. Sys.'),
('1501365CE', '1501', 'Department of Computer Science', '365', 'Software Engineering'),
('1501371CE', '1501', 'Department of Computer Science', '371', 'Design&Analysis of Algorithms'),
('1501440CE', '1501', 'Department of Computer Science', '440', 'Intro. to Computer Graphics'),
('1502412', '1502', 'Department of Computer Engineering', '412', 'Parallel and Distributed Proc.'),
('1502413', '1502', 'Department of Computer Engineering', '413', 'Multimedia & Software'),
('1502422', '1502', 'Department of Computer Engineering', '422', 'Real-time Systems Design'),
('1502424', '1502', 'Department of Computer Engineering', '424', 'High Performance Computer Arch'),
('1502435', '1502', 'Department of Computer Engineering', '435', 'Distributed & Cloud Comp. Sys.'),
('1502451', '1502', 'Department of Computer Engineering', '451', 'Design of IOT Systems'),
('1502452', '1502', 'Department of Computer Engineering', '452', 'Comp. Net. Design & Analysis'),
('1502453', '1502', 'Department of Computer Engineering', '453', 'Digital Image Processing'),
('1502454', '1502', 'Department of Computer Engineering', '454', 'Auto.Robotics &Act. Vision Sys'),
('1502455', '1502', 'Department of Computer Engineering', '455', 'VLSI Design'),
('1502467', '1502', 'Department of Computer Engineering', '467', 'S.pecial Topics in CE'),
('1502468', '1502', 'Department of Computer Engineering', '468', 'Special Topics in SCA'),
('1502469', '1502', 'Department of Computer Engineering', '469', 'Special Topics in Micro.& VLSI'),
('1502499', '1502', 'Department of Computer Engineering', '499', 'Senior Seminar in Com.Eng.'),

-- Arts & Humanities
('0202207', '0202', 'College of Arts & Humanities', '207', 'Technical Writing'),

-- Chemistry
('1420101', '1420', 'Department of Chemistry', '101', 'General Chemistry (1)'),
('1420102', '1420', 'Department of Chemistry', '102', 'General Chemistry (1) Lab'),

-- Physics
('1430108', '1430', 'Department of Physics', '108', 'Remedial physics'),
('1430215', '1430', 'Department of Physics', '215', 'Physics 1'),
('1430216', '1430', 'Department of Physics', '216', 'Physics 1 Lab'),
('1430217', '1430', 'Department of Physics', '217', 'Physics 2'),
('1430218', '1430', 'Department of Physics', '218', 'Physics 2 Lab'),

-- Mathematics
('1440051', '1440', 'Department of Mathematics', '051', 'Remedial Math'),
('1440061', '1440', 'Department of Mathematics', '061', 'Calculus I for Engineering'),
('1440162', '1440', 'Department of Mathematics', '162', 'Calculus II for Engineers'),
('1440262', '1440', 'Department of Mathematics', '262', 'Diff. Equs for Engs')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name;
