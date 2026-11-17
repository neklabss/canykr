-- 0005 · Organizations (bands, venues, agencies, organizers, companies) and role-based memberships
CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL CHECK (type IN ('band','venue','agency','organizer','company')),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug          citext NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  country_code  char(2) NULL REFERENCES countries(code),
  city          text NULL CHECK (char_length(city) <= 120),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_type_country_idx ON organizations (type, country_code);
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organization_memberships (
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner','admin','manager','member','staff')),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active')),
  title            text NULL CHECK (char_length(title) <= 80), -- e.g. "Drummer", "Booking manager"
  invited_by       uuid NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX memberships_user_idx ON organization_memberships (user_id);
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON organization_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- INVARIANT: every organization keeps at least one active owner. Enforced at commit time so that
-- ownership transfers inside one transaction (promote new owner, demote old) are allowed.
CREATE OR REPLACE FUNCTION assert_org_has_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org uuid := COALESCE(OLD.organization_id, NEW.organization_id);
BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE id = org) AND NOT EXISTS (
    SELECT 1 FROM organization_memberships WHERE organization_id = org AND role = 'owner' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'organization % must have at least one active owner', org USING ERRCODE = 'P0002';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER memberships_keep_owner
  AFTER UPDATE OR DELETE ON organization_memberships
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_org_has_owner();
