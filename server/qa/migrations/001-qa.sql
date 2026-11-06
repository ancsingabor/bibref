BEGIN;
CREATE SCHEMA qa;
REVOKE ALL ON SCHEMA qa FROM PUBLIC;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bibref_qa_runtime') THEN
    CREATE ROLE bibref_qa_runtime NOLOGIN;
  END IF;
END $$;
CREATE TABLE qa.control (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  epoch text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  canonical_origin text NOT NULL,
  corpus_version text NOT NULL,
  price_version text NOT NULL,
  active_count integer NOT NULL DEFAULT 0 CHECK (active_count BETWEEN 0 AND 2),
  receipt_slots integer NOT NULL DEFAULT 0 CHECK (receipt_slots BETWEEN 0 AND 1000),
  last_month date,
  halt_reason text
);
CREATE TABLE qa.month_ledger (
  month date PRIMARY KEY CHECK (extract(day FROM month) = 1),
  epoch text NOT NULL,
  ceiling bigint NOT NULL DEFAULT 10000000000 CHECK (ceiling BETWEEN 0 AND 10000000000),
  reserved bigint NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  settled bigint NOT NULL DEFAULT 0 CHECK (settled >= 0),
  CHECK (settled <= ceiling AND reserved <= ceiling - settled)
);
CREATE TABLE qa.browser_day (
  browser text NOT NULL,
  day date NOT NULL,
  completed integer NOT NULL DEFAULT 0 CHECK (completed >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  CHECK (completed + reserved <= 3),
  PRIMARY KEY (browser, day)
);
CREATE TABLE qa.operation (
  id uuid PRIMARY KEY,
  browser text,
  binding text,
  language text NOT NULL CHECK (language IN ('hu','en')),
  corpus_version text NOT NULL,
  epoch text NOT NULL,
  month date NOT NULL REFERENCES qa.month_ledger,
  day date NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved','generating','verifying','uncertain','answered','abstained','failed')),
  fence uuid NOT NULL,
  created_at timestamptz NOT NULL,
  deadline_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  maximum bigint NOT NULL CHECK (maximum BETWEEN 0 AND 10000000000),
  settled bigint NOT NULL DEFAULT 0 CHECK (settled BETWEEN 0 AND maximum)
);
CREATE UNIQUE INDEX qa_active_browser ON qa.operation (browser)
  WHERE status IN ('reserved','generating','verifying','uncertain');
CREATE TABLE qa.dispatch (
  operation_id uuid NOT NULL REFERENCES qa.operation,
  stage text NOT NULL CHECK (stage IN ('generation','verification')),
  token uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('prepared','sent','confirmed','uncertain')),
  model text NOT NULL,
  price_version text NOT NULL,
  input_bound integer NOT NULL CHECK (input_bound >= 0),
  output_bound integer NOT NULL CHECK (output_bound >= 0),
  maximum bigint NOT NULL CHECK (maximum BETWEEN 0 AND 10000000000),
  confirmed bigint CHECK (confirmed BETWEEN 0 AND maximum),
  PRIMARY KEY (operation_id, stage)
);
CREATE TABLE qa.receipt (
  operation_id uuid PRIMARY KEY REFERENCES qa.operation,
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) <= 65536),
  key_version integer NOT NULL CHECK (key_version > 0),
  expires_at timestamptz NOT NULL
);
CREATE TABLE qa.network_window (
  digest text NOT NULL,
  seen_at timestamptz NOT NULL
);
CREATE INDEX qa_network_window_lookup ON qa.network_window (digest, seen_at);
REVOKE ALL ON ALL TABLES IN SCHEMA qa FROM PUBLIC;
GRANT USAGE ON SCHEMA qa TO bibref_qa_runtime;
-- Apply 002-runtime.sql to install the transaction entry points.
COMMIT;
