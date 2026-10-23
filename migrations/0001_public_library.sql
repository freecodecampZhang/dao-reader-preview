CREATE TABLE IF NOT EXISTS library_books (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  description TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (rights_confirmed IN (0, 1)),
  commercial_rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (commercial_rights_confirmed IN (0, 1)),
  publication_approved INTEGER NOT NULL DEFAULT 0 CHECK (publication_approved IN (0, 1)),
  original_filename TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS library_books_status_updated ON library_books (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip_key TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_time ON admin_login_attempts (ip_key, attempted_at);
