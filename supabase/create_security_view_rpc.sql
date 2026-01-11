-- =====================================================
-- SECURITY ENHANCEMENT: View + RPC for Contact Info
-- 
-- This implements defense-in-depth:
-- 1. profiles_public view - only exposes safe columns
-- 2. get_contact_info RPC - returns phone only when authorized
-- =====================================================

-- Create a public view with only safe columns
-- This is what the app uses for display (post cards, etc.)
CREATE OR REPLACE VIEW profiles_public AS
SELECT 
    id,
    name,
    student_id
FROM profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON profiles_public TO authenticated;

-- =====================================================
-- RPC Function: get_contact_info
-- Returns contact info (phone) ONLY when the requester
-- is authorized to see it based on app rules:
-- 1. It's their own profile
-- 2. They're in an ACCEPTED match with this user
-- 3. The user has a giveaway/request post (phone is public)
-- =====================================================

CREATE OR REPLACE FUNCTION get_contact_info(target_profile_id UUID)
RETURNS TABLE (phone TEXT, name TEXT, student_id TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    requester_id UUID;
BEGIN
    -- Get the requester's user ID
    requester_id := auth.uid();
    
    -- If not authenticated, return empty
    IF requester_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Check authorization and return contact info if allowed
    RETURN QUERY
    SELECT p.phone, p.name, p.student_id
    FROM profiles p
    WHERE p.id = target_profile_id
    AND (
        -- Rule 1: It's their own profile
        p.id = requester_id
        OR
        -- Rule 2: They're in an ACCEPTED match with this user
        EXISTS (
            SELECT 1 FROM matches m
            WHERE m.status = 'accepted'
            AND (
                (m.user_a_id = requester_id AND m.user_b_id = target_profile_id)
                OR
                (m.user_b_id = requester_id AND m.user_a_id = target_profile_id)
            )
        )
        OR
        -- Rule 3: The user has a giveaway/request post (phone is shown publicly)
        EXISTS (
            SELECT 1 FROM posts
            WHERE posts.user_id = target_profile_id
            AND posts.type IN ('giveaway', 'request')
            AND posts.status IN ('active', 'pending')
        )
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_contact_info(UUID) TO authenticated;

-- =====================================================
-- TESTING INSTRUCTIONS:
-- 
-- After running this SQL, test with:
-- 
-- 1. Query the view (should only show id, name, student_id):
--    SELECT * FROM profiles_public;
-- 
-- 2. Call the RPC (should only return data if authorized):
--    SELECT * FROM get_contact_info('some-user-uuid');
-- 
-- 3. Direct profiles query should still be restricted by RLS
-- =====================================================
