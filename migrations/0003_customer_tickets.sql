CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX customer_sessions_expiry_idx ON customer_sessions(expires_at);

ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id);
CREATE INDEX orders_customer_created_idx ON orders(customer_id, created_at);

CREATE TABLE ticket_messages (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  author_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK(author_role IN ('customer', 'staff')),
  visibility TEXT NOT NULL DEFAULT 'customer' CHECK(visibility IN ('customer', 'staff')),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ticket_messages_order_created_idx ON ticket_messages(order_id, created_at);
