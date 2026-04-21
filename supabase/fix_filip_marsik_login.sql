-- Oprava přihlášení pro filip.marsik@tiscali.cz
-- Důvod: SMTP reset hesla nefunguje spolehlivě; přihlášení vyžaduje platný účet v auth.users
--        + záznam v auth.identities (email provider) + záznam v app_user.
--
-- Spustit v Supabase Dashboard → SQL Editor (service role).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_email TEXT := trim('filip.marsik@tiscali.cz');
  v_password TEXT := 'vyjezdy123';
  v_encrypted_pw TEXT := crypt(v_password, gen_salt('bf'));
  v_user_id UUID;
  v_instance_id UUID;
  v_identity_id UUID;
BEGIN
  -- 1) Účet v auth.users
  SELECT id, instance_id INTO v_user_id, v_instance_id
  FROM auth.users
  WHERE trim(email) = v_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Uživatel existuje: nastav heslo, potvrď email, zruš ban a tokeny
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = NULL,
      recovery_token = NULL,
      banned_until = NULL,  -- pokud sloupec neexistuje, řádek smaž
      updated_at = NOW(),
      email = v_email
    WHERE id = v_user_id;
    -- Zajistit, že existuje identity pro email (bez ní může signIn selhat)
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
      v_identity_id := gen_random_uuid();
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (
        v_identity_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        NOW(), NOW(), NOW()
      );
      RAISE NOTICE 'auth.identities: doplněn záznam pro email provider';
    END IF;
    RAISE NOTICE 'auth.users: heslo a potvrzení nastaveny pro %', v_email;
  ELSE
    -- Uživatel v auth neexistuje: vytvoř ho + auth.identities
    v_user_id := gen_random_uuid();
    v_identity_id := gen_random_uuid();
    v_instance_id := COALESCE(
      (SELECT instance_id FROM auth.users LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::UUID
    );
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    VALUES (
      v_user_id,
      v_instance_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      v_identity_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      NOW(), NOW(), NOW()
    );
    RAISE NOTICE 'auth.users: vytvořen nový účet pro %', v_email;
  END IF;

  -- 2) app_user (aplikace podle emailu hledá roli – bez řádku hlásí „nemá přiřazenou roli“)
  INSERT INTO app_user (email, role)
  VALUES (v_email, 'parent')
  ON CONFLICT (email) DO UPDATE SET role = 'parent';
  RAISE NOTICE 'app_user: záznam pro % zkontrolován / doplněn', v_email;
END $$;

-- Kontrola po spuštění (odkomentuj a spusť znovu)
-- SELECT id, email, email_confirmed_at, banned_until, confirmation_token
-- FROM auth.users WHERE email = 'filip.marsik@tiscali.cz';
-- SELECT * FROM auth.identities WHERE provider = 'email' AND identity_data->>'email' = 'filip.marsik@tiscali.cz';
-- SELECT id, email, role FROM app_user WHERE email = 'filip.marsik@tiscali.cz';
