ALTER TABLE orders ADD COLUMN photo_key TEXT;

CREATE TABLE staff_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES staff_users(email),
  expires_at INTEGER NOT NULL
);
CREATE INDEX staff_sessions_expiry_idx ON staff_sessions(expires_at);

CREATE INDEX ticket_messages_visibility_idx ON ticket_messages(order_id, visibility, created_at);
