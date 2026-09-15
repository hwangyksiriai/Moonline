BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, data jsonb NOT NULL,
 name text GENERATED ALWAYS AS (data->>'name') STORED,
 email text GENERATED ALWAYS AS (data->>'email') STORED,
 phone_number text GENERATED ALWAYS AS (data->>'phone') STORED,
 timezone text GENERATED ALWAYS AS (data->>'timezone') STORED,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS voices (id text PRIMARY KEY,name text NOT NULL,description text NOT NULL,voice_provider text NOT NULL DEFAULT 'openai',voice_id text NOT NULL,preview_url text,avatar_url text);
CREATE TABLE IF NOT EXISTS scenarios (id text PRIMARY KEY,title text NOT NULL,description text NOT NULL,category text NOT NULL,default_prompt text NOT NULL,thumbnail text,is_public boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS calls (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),data jsonb NOT NULL,version integer NOT NULL DEFAULT 0,
 scheduled_at timestamptz NOT NULL,
 status text GENERATED ALWAYS AS (data->>'status') STORED,
 voice_id text GENERATED ALWAYS AS (data->>'voice') STORED REFERENCES voices(id),
 scenario_id text GENERATED ALWAYS AS (data->>'scenarioId') STORED REFERENCES scenarios(id),
 custom_scenario text GENERATED ALWAYS AS (data->>'situation') STORED,
 relationship text GENERATED ALWAYS AS (data->>'relationship') STORED,
 must_say_phrase text GENERATED ALWAYS AS (data->>'mustSayPhrase') STORED,
 provider_call_id text GENERATED ALWAYS AS (data->>'providerCallId') STORED,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (status IN ('draft','scheduled','calling','connected','completed','failed','cancelled'))
);
CREATE INDEX IF NOT EXISTS calls_due ON calls(scheduled_at) WHERE status='scheduled';
CREATE INDEX IF NOT EXISTS calls_owner ON calls(user_id,scheduled_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS calls_provider ON calls(provider_call_id) WHERE provider_call_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS call_transcripts (call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,sequence integer NOT NULL,speaker text NOT NULL CHECK(speaker IN ('you','caller')),content text NOT NULL,timestamp timestamptz NOT NULL,PRIMARY KEY(call_id,sequence));
CREATE TABLE IF NOT EXISTS call_memories (id uuid DEFAULT gen_random_uuid(),call_id uuid PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id),summary text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_memories ENABLE ROW LEVEL SECURITY;
-- The authenticated API is the data boundary. No direct mobile table access.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
 REVOKE ALL ON users,calls,voices,scenarios,call_transcripts,call_memories FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
 REVOKE ALL ON users,calls,voices,scenarios,call_transcripts,call_memories FROM authenticated;
 END IF;
END $$;
COMMIT;
