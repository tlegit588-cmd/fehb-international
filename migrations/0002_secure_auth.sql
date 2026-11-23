-- FEHB secure authentication layer.
-- Keeps the existing staff_users table and its foreign-key relationships intact.
CREATE TABLE IF NOT EXISTS staff_roles (
  user_id TEXT PRIMARY KEY REFERENCES staff_users(id) ON DELETE CASCADE,
  access_role TEXT NOT NULL CHECK (access_role IN (
    'super_admin',
    'project_manager',
    'finance_officer',
    'volunteer_manager',
    'education_coordinator'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_credentials (
  user_id TEXT PRIMARY KEY REFERENCES staff_users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_user ON staff_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_expiry ON staff_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER
);

CREATE INDEX IF NOT EXISTS idx_staff_roles_role ON staff_roles(access_role);
