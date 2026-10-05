PRAGMA foreign_keys = ON;

CREATE TABLE dwellings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reading_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reading_date TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dwelling_id INTEGER NOT NULL REFERENCES dwellings(id) ON DELETE CASCADE,
  reading_date_id INTEGER NOT NULL REFERENCES reading_dates(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('heating', 'cooling', 'water')),
  value REAL NOT NULL CHECK (value >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dwelling_id, reading_date_id, service)
);

CREATE INDEX readings_by_date_service ON readings(reading_date_id, service);
CREATE INDEX readings_by_dwelling_service ON readings(dwelling_id, service);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('electricity', 'water', 'other')),
  invoice_date TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX invoices_by_date ON invoices(invoice_date);

CREATE TABLE periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  day_adjustment INTEGER NOT NULL DEFAULT -2,
  actual_heating_rate REAL NOT NULL DEFAULT 0,
  actual_cooling_rate REAL NOT NULL DEFAULT 0,
  actual_water_rate REAL NOT NULL DEFAULT 0,
  actual_fixed_daily_rate REAL NOT NULL DEFAULT 0,
  calculated_water_rate REAL NOT NULL DEFAULT 0,
  calculated_fixed_daily_rate REAL NOT NULL DEFAULT 0,
  fixed_electricity_daily REAL NOT NULL DEFAULT 0,
  fixed_water_daily REAL NOT NULL DEFAULT 0,
  administration_daily REAL NOT NULL DEFAULT 0,
  sunflowers_daily REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date > start_date)
);

CREATE INDEX periods_by_dates ON periods(start_date, end_date);
