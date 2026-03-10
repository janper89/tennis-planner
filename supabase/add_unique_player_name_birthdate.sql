-- Unique index: jeden aktivní hráč na kombinaci (jméno, datum narození)
-- Spustit AŽ PO merge duplicit (merge_duplicate_players.sql)

CREATE UNIQUE INDEX IF NOT EXISTS unique_player_name_birthdate
  ON player (name, birth_date)
  WHERE deleted_at IS NULL;
