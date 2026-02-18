-- =====================================================
-- DATABASE SCHEMA UPDATE
-- Switch from boolean 'is_university_elective' to 'university_elective_basket'
-- =====================================================

-- 1. Drop the old boolean column if it exists
ALTER TABLE courses 
DROP COLUMN IF EXISTS is_university_elective;

-- 2. Add the new basket column
-- Values: 'Basket 1', 'Basket 2', or NULL
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS university_elective_basket TEXT;

-- 3. Create an index for faster filtering by basket
CREATE INDEX IF NOT EXISTS idx_courses_university_elective_basket
ON courses(university_elective_basket);
