CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  restaurant TEXT NOT NULL,
  details TEXT NOT NULL,
  cart_total_cents INTEGER NOT NULL CHECK (cart_total_cents > 0),
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'claimed', 'placing', 'completed', 'cancelled')),
  assigned_staff TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX orders_status_created_idx ON orders(status, created_at);

CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX order_events_order_created_idx ON order_events(order_id, created_at);
