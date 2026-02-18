-- =====================================================
-- DATABASE SCHEMA UPDATE
-- Add 'category' column to 'major_courses' table
-- =====================================================

-- Add the column if it doesn't exist
-- Categories: 'Core', 'Elective', 'Major Elective', etc.
-- We default to NULL or 'Core' implicitly in logic, but let's default to 'Core' for clarity if needed, 
-- or leave NULL to save space and assume NULL = Core.
-- Let's go with literal text for flexibility.

ALTER TABLE major_courses 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Core';

-- Create an index for filtering by category
CREATE INDEX IF NOT EXISTS idx_major_courses_category 
ON major_courses(category);
