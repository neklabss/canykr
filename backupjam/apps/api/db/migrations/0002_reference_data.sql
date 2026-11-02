-- 0002 · Reference data: locales, currencies, countries, instruments, genres, feature flags
CREATE TABLE locales (
  tag         text PRIMARY KEY CHECK (tag ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  direction   text NOT NULL CHECK (direction IN ('ltr','rtl')),
  status      text NOT NULL CHECK (status IN ('reviewed','machine_draft','disabled')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE currencies (
  code        char(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  exponent    smallint NOT NULL CHECK (exponent BETWEEN 0 AND 4),
  active      boolean NOT NULL DEFAULT true
);

-- Country = market rules (payments, features, legal readiness). Independent from UI language.
CREATE TABLE countries (
  code              char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  default_currency  char(3) NOT NULL REFERENCES currencies(code),
  default_locale    text NOT NULL REFERENCES locales(tag),
  default_time_zone text NOT NULL,
  launch_status     text NOT NULL DEFAULT 'hidden' CHECK (launch_status IN ('hidden','beta','live')),
  payments_enabled  boolean NOT NULL DEFAULT false,
  payment_provider  text NULL,               -- e.g. 'stripe_connect', 'iyzico_marketplace'; NULL = none contracted
  min_event_age     smallint NULL,
  features          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_need_provider CHECK (NOT payments_enabled OR payment_provider IS NOT NULL)
);
CREATE TRIGGER countries_updated_at BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE instruments (
  slug        text PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]+$'),
  category    text NOT NULL CHECK (category IN ('strings','keys','percussion','wind','brass','voice','electronic','tech','other')),
  name_key    text NOT NULL,             -- i18n key, e.g. instrument.electric_guitar
  default_name text NOT NULL,            -- English fallback (data, not UI chrome)
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE genres (
  slug        text PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]+$'),
  name_key    text NOT NULL,
  default_name text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);

CREATE TABLE feature_flags (
  key          text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]+$'),
  description  text NOT NULL,
  enabled      boolean NOT NULL DEFAULT false,
  -- Optional targeting, e.g. {"countries":["TR","DE"],"percentage":10}
  rules        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid NULL
);
CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION set_updated_at();
