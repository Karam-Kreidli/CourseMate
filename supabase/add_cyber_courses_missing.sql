-- =====================================================
-- ADD MISSING CYBERSECURITY COURSES
-- Run this BEFORE add_cyber_courses.sql
-- =====================================================

INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
-- Electrical Engineering
('0402340', '0402', 'Department of Electrical Engineering', '340', 'Eng. Comp. & Linear Algebra'),

-- Physics (Engineering versions)
('1430115', '1430', 'Department of Physics', '115', 'Physics 1'),
('1430117', '1430', 'Department of Physics', '117', 'Physics 2'),
('1430118', '1430', 'Department of Physics', '118', 'Physics 2 Lab'),

-- Mathematics (Engineering versions)
('1440133', '1440', 'Department of Mathematics', '133', 'Calculus I for Engineering'),
('1440161', '1440', 'Department of Mathematics', '161', 'Calculus II for Engineers'),
('1440261', '1440', 'Department of Mathematics', '261', 'Diff. Equs for Engs'),

-- Computer Engineering (Cybersecurity Core)
('1502111', '1502', 'Department of Computer Engineering', '111', 'Discrete Mathematics for Eng.'),
('1502170', '1502', 'Department of Computer Engineering', '170', 'Introduction to Cybersecurity'),
('1502214', '1502', 'Department of Computer Engineering', '214', 'Adv. Discrete Math. for Eng.'),
('1502220', '1502', 'Department of Computer Engineering', '220', 'Intro. Prob. Data Anlys. Eng.'),
('1502232', '1502', 'Department of Computer Engineering', '232', 'Micro. & Assembly Language'),
('1502250', '1502', 'Department of Computer Engineering', '250', 'Intro. Comp. Electronics'),
('1502252', '1502', 'Department of Computer Engineering', '252', 'Intro. Comp. Electronics Lab'),
('1502270', '1502', 'Department of Computer Engineering', '270', 'Database Security'),
('1502271', '1502', 'Department of Computer Engineering', '271', 'Introduction to Cryptography'),
('1502300', '1502', 'Department of Computer Engineering', '300', 'Pro. & Social Issues in Eng.'),
('1502326', '1502', 'Department of Computer Engineering', '326', 'Computer System Arch.'),
('1502340', '1502', 'Department of Computer Engineering', '340', 'Data Communications'),
('1502346', '1502', 'Department of Computer Engineering', '346', 'Computer Com. and networks'),
('1502347', '1502', 'Department of Computer Engineering', '347', 'Computer Com. and networks Lab'),
('1502370', '1502', 'Department of Computer Engineering', '370', 'Secure Operating Systems'),
('1502371', '1502', 'Department of Computer Engineering', '371', 'Secure SW Design and Dev.'),
('1502372', '1502', 'Department of Computer Engineering', '372', 'Intro. to Digital Forensics'),
('1502373', '1502', 'Department of Computer Engineering', '373', 'Info. Security Management'),
('1502410', '1502', 'Department of Computer Engineering', '410', 'Artificial Intelligence Eng.'),
('1502442', '1502', 'Department of Computer Engineering', '442', 'Network Programming'),
('1502444', '1502', 'Department of Computer Engineering', '444', 'Computer and Network Security'),
('1502450', '1502', 'Department of Computer Engineering', '450', 'Intro. to Hardware Security'),
('1502461', '1502', 'Department of Computer Engineering', '461', 'S. T. in Cyber Security'),
('1502470', '1502', 'Department of Computer Engineering', '470', 'Data Confid. and Cloud Secur.'),
('1502471', '1502', 'Department of Computer Engineering', '471', 'Internet and Web Security'),
('1502473', '1502', 'Department of Computer Engineering', '473', 'Ethical Hacking'),
('1502474', '1502', 'Department of Computer Engineering', '474', 'Data Hiding and Staganography'),
('1502494', '1502', 'Department of Computer Engineering', '494', 'Security Capstone I'),
('1502495', '1502', 'Department of Computer Engineering', '495', 'Security Capstone II'),
('1502496', '1502', 'Department of Computer Engineering', '496', 'Prac. Tr. Cybersecurity Eng.')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name;
