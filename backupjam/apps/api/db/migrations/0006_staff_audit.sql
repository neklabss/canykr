-- 0006 · Platform staff roles and the append-only audit log
CREATE TABLE staff_members (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('super_admin','trust_safety','finance_ops','support','localization_manager','analyst')),
  granted_by  uuid NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz NULL
);

CREATE TABLE audit_logs (
  id             bigserial PRIMARY KEY,
  actor_user_id  uuid NULL REFERENCES users(id), -- users are anonymised, never hard-deleted, so the trail survives
  actor_type     text NOT NULL CHECK (actor_type IN ('user','staff','system','provider_webhook')),
  action         text NOT NULL CHECK (action ~ '^[a-z0-9_.]+$'),
  target_type    text NULL,
  target_id      text NULL,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- never store secrets/tokens/passwords here
  ip             inet NULL,
  request_id     text NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
