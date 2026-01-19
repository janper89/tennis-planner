-- Přidání perutka89@gmail.com jako trenéra
-- Pokud už existuje jako manager, změň roli na coach (nebo přidej nový záznam)

-- Možnost 1: Změnit roli existujícího záznamu z manager na coach
-- (POZOR: Ztratíš manager práva!)
UPDATE app_user 
SET role = 'coach' 
WHERE email = 'perutka89@gmail.com';

-- NEBO Možnost 2: Přidat nový záznam s alias emailem (pokud chceš zachovat manager roli)
-- (Nepoužívej oba dotazy zároveň!)
-- INSERT INTO app_user (email, role) 
-- VALUES ('perutka89+coach@gmail.com', 'coach');

-- Ověření - zobraz uživatele
SELECT email, role, created_at FROM app_user WHERE email = 'perutka89@gmail.com';
