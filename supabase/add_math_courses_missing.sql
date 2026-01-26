-- =====================================================
-- ADD MISSING MATHEMATICS COURSES
-- Run this BEFORE add_math_courses.sql
-- =====================================================

INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES
-- Additional Mathematics courses for Math major
('1440231', '1440', 'Department of Mathematics', '231', 'Calculus III'),
('1440232', '1440', 'Department of Mathematics', '232', 'Vector Calculus'),
('1440233', '1440', 'Department of Mathematics', '233', 'Foundations of Mathematics'),
('1440241', '1440', 'Department of Mathematics', '241', 'Ordinary Differential Equ.'),
('1440251', '1440', 'Department of Mathematics', '251', 'Geometry'),
('1440311', '1440', 'Department of Mathematics', '311', 'Intro Probability & Statistics'),
('1440321', '1440', 'Department of Mathematics', '321', 'Abstract Algebra I'),
('1440331', '1440', 'Department of Mathematics', '331', 'Real Analysis I'),
('1440332', '1440', 'Department of Mathematics', '332', 'Complex Analysis'),
('1440371', '1440', 'Department of Mathematics', '371', 'Numerical Analysis I'),
('1440372', '1440', 'Department of Mathematics', '372', 'Operations Research I'),
('1440381', '1440', 'Department of Mathematics', '381', 'Mathematical Statistics'),
('1440461', '1440', 'Department of Mathematics', '461', 'Internship'),
('1440492', '1440', 'Department of Mathematics', '492', 'Graduation Project'),
('1440312', '1440', 'Department of Mathematics', '312', 'Linear Algebra II'),
('1440313', '1440', 'Department of Mathematics', '313', 'Number Theory'),
('1440341', '1440', 'Department of Mathematics', '341', 'Partial Differential Equations'),
('1440343', '1440', 'Department of Mathematics', '343', 'Graph Theory'),
('1440421', '1440', 'Department of Mathematics', '421', 'Abstract Algebra II'),
('1440431', '1440', 'Department of Mathematics', '431', 'Real Analysis II'),
('1440441', '1440', 'Department of Mathematics', '441', 'Ordinary Differential Equ. II'),
('1440451', '1440', 'Department of Mathematics', '451', 'Topology'),
('1440471', '1440', 'Department of Mathematics', '471', 'Numerical Analysis II'),
('1440472', '1440', 'Department of Mathematics', '472', 'Operations Research II'),
('1440481', '1440', 'Department of Mathematics', '481', 'Stochastic Processes'),
('1440491', '1440', 'Department of Mathematics', '491', 'Selected Topics in Mathematics'),

-- Computer Science courses for Math major
('1501333', '1501', 'Department of Computer Science', '333', 'Introduction to AI'),

-- Additional Computer Engineering course
('1502333', '1502', 'Department of Computer Engineering', '333', 'Introduction to AI'),

-- Mathematical Software (may be a new course)
('1440235', '1440', 'Department of Mathematics', '235', 'Mathematical Software')

ON CONFLICT (course_id) DO UPDATE SET
    course_name = EXCLUDED.course_name;
