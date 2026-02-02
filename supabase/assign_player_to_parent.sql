-- Assign player "Dominik Dujka" to parent "Jan Perutka" (j.perutka@seznam.cz)
-- Date: 2025-01-26

-- First, find the parent ID
DO $$
DECLARE
    parent_user_id UUID;
    player_user_id UUID;
BEGIN
    -- Get parent ID
    SELECT id INTO parent_user_id
    FROM app_user
    WHERE email = 'j.perutka@seznam.cz';
    
    IF parent_user_id IS NULL THEN
        RAISE EXCEPTION 'Parent with email j.perutka@seznam.cz not found';
    END IF;
    
    -- Update player's parent_id
    UPDATE player
    SET parent_id = parent_user_id
    WHERE name = 'Dominik Dujka';
    
    -- Check if player was found and updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Player "Dominik Dujka" not found';
    END IF;
    
    RAISE NOTICE 'Player "Dominik Dujka" successfully assigned to parent with email j.perutka@seznam.cz';
END $$;

-- Verify the assignment
SELECT 
    p.name AS player_name,
    au.email AS parent_email,
    au.name AS parent_name
FROM player p
JOIN app_user au ON p.parent_id = au.id
WHERE p.name = 'Dominik Dujka';
