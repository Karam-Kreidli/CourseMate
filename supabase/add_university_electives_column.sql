-- =====================================================
-- DATABASE SCHEMA UPDATE
-- Add 'is_university_elective' column to 'courses' table
-- =====================================================

-- Add the column if it doesn't exist
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS is_university_elective BOOLEAN DEFAULT FALSE;

-- Create an index for faster filtering of electives
CREATE INDEX IF NOT EXISTS idx_courses_is_university_elective 
ON courses(is_university_elective);

-- Update RLS policies if necessary (Select is already true for everyone, so no change needed)
