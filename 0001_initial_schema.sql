PRAGMA foreign_keys = ON;

-- Staff accounts are provisioned by an administrator. Never store plaintext passwords.
CREATE TABLE staff_users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'director', 'programme_manager', 'case_worker', 'viewer')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE programmes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('beauty', 'agriculture', 'education', 'technology', 'humanitarian')),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  start_date TEXT,
  end_date TEXT,
  created_by TEXT REFERENCES staff_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keep beneficiary data minimal. Do not place medical records or identity-document images here.
-- Store sensitive documents separately in private object storage with access logging and consent.
CREATE TABLE beneficiaries (
  id TEXT PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  beneficiary_group TEXT NOT NULL CHECK (beneficiary_group IN ('child', 'adult', 'family', 'person_with_disability')),
  programme_id TEXT REFERENCES programmes(id),
  consent_status TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'declined', 'withdrawn')),
  guardian_consent_status TEXT CHECK (guardian_consent_status IN ('pending', 'granted', 'declined', 'withdrawn')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE programme_activities (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  location TEXT,
  summary TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES staff_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE contact_enquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES staff_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_beneficiaries_status ON beneficiaries(status);
CREATE INDEX idx_beneficiaries_programme ON beneficiaries(programme_id);
CREATE INDEX idx_programmes_status ON programmes(status);
CREATE INDEX idx_activities_programme_date ON programme_activities(programme_id, activity_date);
CREATE INDEX idx_enquiries_status_date ON contact_enquiries(status, created_at);
CREATE INDEX idx_audit_entity_date ON audit_logs(entity_type, entity_id, created_at);
