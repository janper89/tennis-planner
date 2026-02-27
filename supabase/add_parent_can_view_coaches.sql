-- Rodič musí vidět seznam trenérů v „Přidat dítě“. RLS na app_user jinak
-- povoluje jen vlastní záznam, takže seznam trenérů byl prázdný.
-- Tato policy umožní všem přihlášeným číst řádky app_user s role = 'coach'.

CREATE POLICY "Authenticated can view coaches"
  ON app_user FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND role = 'coach'
  );
