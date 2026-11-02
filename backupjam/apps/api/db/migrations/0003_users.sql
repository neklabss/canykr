-- 0003 · Users, identities, preferences, capabilities, onboarding
CREATE TABLE users (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  citext NULL,
  email_verified_at      timestamptz NULL,
  password_hash          text NULL,                     -- NULL for social-only accounts
  display_name           text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  username               citext NULL CHECK (username ~ '^[a-z0-9_.]{3,30}$'),
  status                 text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending_deletion','deleted')),
  suspended_reason       text NULL,
  deletion_requested_at  timestamptz NULL,
  mfa_enabled            boolean NOT NULL DEFAULT false, -- TOTP enrolment lands with staff MFA (BUJ backlog)
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deletion_timestamp CHECK (status NOT IN ('pending_deletion','deleted') OR deletion_requested_at IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_uq ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_username_uq ON users (username) WHERE username IS NOT NULL;
CREATE INDEX users_status_idx ON users (status);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- External / login identities. One user ↔ many identities (email+password, Google, Apple).
CREATE TABLE user_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('email','google','apple')),
  provider_subject  text NOT NULL,
  email             citext NULL,
  email_verified    boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz NULL,
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

-- Language (locale) and market (country) are independent settings.
CREATE TABLE user_preferences (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale             text NULL REFERENCES locales(tag),   -- NULL = automatic (device/browser)
  country_code       char(2) NULL REFERENCES countries(code),
  currency_code      char(3) NULL REFERENCES currencies(code), -- display currency only
  time_zone          text NULL,
  theme              text NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  quiet_hours_start  time NULL,
  quiet_hours_end    time NULL,
  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiet_hours_pair CHECK ((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL))
);
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_capabilities (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability  text NOT NULL CHECK (capability IN ('musician','band_member','band_manager','venue_owner','venue_staff','organizer','booking_agent','artist_manager','sound_engineer','lighting_technician','music_teacher','enthusiast','customer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, capability)
);

CREATE TABLE onboarding_profiles (
  user_id                 uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_country_code       char(2) NULL REFERENCES countries(code),
  home_city               text NULL CHECK (char_length(home_city) <= 120),
  location                geography(Point, 4326) NULL,
  available_for_bookings  boolean NULL,
  discover_goals          text[] NOT NULL DEFAULT '{}' CHECK (discover_goals <@ ARRAY['musicians','jobs','venues','events']::text[]),
  travel_country_codes    char(2)[] NOT NULL DEFAULT '{}',
  travel_radius_km        int NULL CHECK (travel_radius_km BETWEEN 0 AND 20000),
  skipped_steps           text[] NOT NULL DEFAULT '{}',
  completed_at            timestamptz NULL,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_location_gix ON onboarding_profiles USING gist (location);
CREATE TRIGGER onboarding_updated_at BEFORE UPDATE ON onboarding_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_instruments (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument  text NOT NULL REFERENCES instruments(slug),
  PRIMARY KEY (user_id, instrument)
);
CREATE TABLE user_genres (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  genre    text NOT NULL REFERENCES genres(slug),
  PRIMARY KEY (user_id, genre)
);
CREATE TABLE user_languages (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_tag  text NOT NULL CHECK (language_tag ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'), -- spoken languages ≠ UI locales
  PRIMARY KEY (user_id, language_tag)
);
