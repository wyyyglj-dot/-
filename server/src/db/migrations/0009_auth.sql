BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS admin_pin (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_algo TEXT NOT NULL DEFAULT 'scrypt:N=32768,r=8,p=1,dkLen=64',
  security_question TEXT NOT NULL,
  security_answer_hash TEXT NOT NULL,
  security_answer_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  client_ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_session_expires ON auth_session(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_session_token ON auth_session(token_hash);

COMMIT;
