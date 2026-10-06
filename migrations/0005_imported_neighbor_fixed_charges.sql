CREATE TABLE imported_neighbor_fixed_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dwelling_id INTEGER NOT NULL REFERENCES dwellings(id) ON DELETE CASCADE,
  reading_date_id INTEGER NOT NULL REFERENCES reading_dates(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dwelling_id, reading_date_id)
);

CREATE INDEX imported_neighbor_fixed_by_date ON imported_neighbor_fixed_charges(reading_date_id);
