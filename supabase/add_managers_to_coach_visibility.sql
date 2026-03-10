-- Extend coach visibility to include managers (e.g. Albert Šprlák) in coach dropdown.
-- Parents, players, and managers need to see both coaches and managers when selecting a trainer.

DROP POLICY IF EXISTS "Authenticated can view coaches" ON app_user;

CREATE POLICY "Authenticated can view coaches and managers"
  ON app_user FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND role IN ('coach', 'manager')
  );
