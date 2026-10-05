CREATE TABLE fixed_neighbor_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  daily_rate REAL NOT NULL CHECK (daily_rate >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX fixed_neighbor_charges_by_dates
  ON fixed_neighbor_charges(effective_from, effective_to);

-- Conserva la tarifa histórica que hasta ahora estaba guardada dentro de cada periodo.
INSERT OR IGNORE INTO fixed_neighbor_charges (effective_from, effective_to, daily_rate, notes)
SELECT date(start_date, '+1 day'), end_date, actual_fixed_daily_rate, 'Migrado del periodo ' || name
FROM periods
ORDER BY start_date;

-- La tarifa del periodo más reciente continúa vigente hasta que se añada un nuevo tramo.
UPDATE fixed_neighbor_charges
SET effective_to = NULL
WHERE id = (SELECT id FROM fixed_neighbor_charges ORDER BY effective_from DESC LIMIT 1);
