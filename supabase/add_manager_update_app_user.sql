-- Allow managers to update any app_user record (e.g. parent name when editing profile on their behalf).

CREATE POLICY "Managers can update any user"
  ON app_user FOR UPDATE
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');
