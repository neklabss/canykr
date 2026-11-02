-- 0004 · Sessions, refresh tokens (rotation + reuse detection), one-time email tokens, consent records
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name   text NULL CHECK (char_length(device_name) <= 100),
  user_agent    text NULL,
  ip            inet NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz NULL,
  revoke_reason text NULL CHECK (revoke_reason IN ('logout','user_revoked','password_reset','refresh_reuse','account_suspended','account_deleted','staff'))
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

-- Only SHA-256 hashes of refresh tokens are stored. A token can be used once; reuse revokes the family.
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL UNIQUE,
  parent_id   uuid NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens (session_id);

CREATE TABLE email_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  token_hash   bytea NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_purpose_idx ON email_tokens (user_id, purpose) WHERE consumed_at IS NULL;

-- Append-only consent ledger (GDPR/KVKK accountability). Withdrawal = new row with granted=false.
CREATE TABLE consent_records (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type  text NOT NULL CHECK (consent_type IN ('terms','privacy','marketing_email','marketing_push','analytics','ai_translation')),
  version       text NOT NULL,
  granted       boolean NOT NULL,
  locale        text NULL,
  ip            inet NULL,
  user_agent    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_records_user_idx ON consent_records (user_id, consent_type, created_at DESC);
CREATE TRIGGER consent_records_append_only BEFORE UPDATE ON consent_records FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
