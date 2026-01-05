-- Zkontroluj duplicity v app_user tabulce
-- Spusť v SQL Editoru

SELECT email, COUNT(*) as pocet
FROM app_user
GROUP BY email
HAVING COUNT(*) > 1;

-- Zobraz všechny záznamy s emailem jperutka@proton.me
SELECT * FROM app_user WHERE email = 'jperutka@proton.me';

