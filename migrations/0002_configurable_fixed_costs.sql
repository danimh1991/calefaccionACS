CREATE TABLE fixed_concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES fixed_concepts(id) ON DELETE RESTRICT,
  calculation_mode TEXT NOT NULL DEFAULT 'simple' CHECK (calculation_mode IN ('simple', 'separate')),
  cost_treatment TEXT NOT NULL DEFAULT 'additional' CHECK (cost_treatment IN ('included', 'additional')),
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX fixed_concepts_by_parent ON fixed_concepts(parent_id, active, sort_order);

CREATE TABLE fixed_concept_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER NOT NULL REFERENCES fixed_concepts(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  amount REAL NOT NULL CHECK (amount >= 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'monthly', 'annual')),
  vat_rate REAL NOT NULL DEFAULT 0 CHECK (vat_rate >= 0),
  neighbor_amount REAL CHECK (neighbor_amount IS NULL OR neighbor_amount >= 0),
  neighbor_frequency TEXT CHECK (neighbor_frequency IS NULL OR neighbor_frequency IN ('daily', 'monthly', 'annual')),
  neighbor_vat_rate REAL CHECK (neighbor_vat_rate IS NULL OR neighbor_vat_rate >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (concept_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX fixed_rules_by_dates ON fixed_concept_rules(concept_id, effective_from, effective_to);

CREATE TABLE invoice_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE invoices ADD COLUMN invoice_type_id INTEGER REFERENCES invoice_types(id);

INSERT INTO invoice_types (id, name, slug, sort_order) VALUES
  (1, 'Luz', 'electricity', 1),
  (2, 'Agua', 'water', 2),
  (3, 'Otros', 'other', 3);

UPDATE invoices SET invoice_type_id = CASE invoice_type
  WHEN 'electricity' THEN 1
  WHEN 'water' THEN 2
  ELSE 3
END;

INSERT INTO fixed_concepts (id, name, calculation_mode, cost_treatment, notes, sort_order) VALUES
  (1, 'Fijo electricidad', 'separate', 'included', 'Términos fijos incluidos en las facturas de luz.', 1),
  (8, 'Fijo agua', 'separate', 'included', 'Cuotas de servicio incluidas en las facturas de agua.', 2),
  (13, 'Administración', 'simple', 'additional', 'Coste de administración añadido al cierre.', 3),
  (14, 'Sunflowers', 'simple', 'additional', 'Mantenimiento anual añadido al cierre.', 4),
  (15, 'Cuota fija cobrada a vecinos', 'simple', 'included', 'Importe fijo realmente facturado a cada vivienda.', 5);

INSERT INTO fixed_concepts (id, name, parent_id, calculation_mode, cost_treatment, notes, sort_order) VALUES
  (2, 'Potencia P1', 1, 'simple', 'included', 'Potencia contratada P1.', 1),
  (3, 'Potencia P2', 1, 'simple', 'included', 'Potencia contratada P2.', 2),
  (4, 'Potencia P3', 1, 'simple', 'included', 'Potencia contratada P3.', 3),
  (5, 'Potencia P4', 1, 'simple', 'included', 'Potencia contratada P4.', 4),
  (6, 'Potencia P5', 1, 'simple', 'included', 'Potencia contratada P5.', 5),
  (7, 'Potencia P6', 1, 'simple', 'included', 'Potencia contratada P6.', 6),
  (9, 'Aducción · cuota de servicio', 8, 'simple', 'included', 'Cuota de servicio fija de aducción. La parte por consumo se registra en la factura.', 1),
  (10, 'Distribución · cuota de servicio', 8, 'simple', 'included', 'Cuota de servicio fija de distribución. La parte por consumo se registra en la factura.', 2),
  (11, 'Alcantarillado · cuota de servicio', 8, 'simple', 'included', 'Cuota fija de alcantarillado según la tarifa del Canal.', 3),
  (12, 'Depuración · cuota de servicio', 8, 'simple', 'included', 'Cuota fija de depuración según la tarifa del Canal.', 4);

INSERT INTO fixed_concept_rules (concept_id, effective_from, amount, frequency, vat_rate) VALUES
  (2, '2025-01-01', 3.84276, 'daily', 21),
  (3, '2025-01-01', 2.23848, 'daily', 21),
  (4, '2025-01-01', 1.22982, 'daily', 21),
  (5, '2025-01-01', 1.13196, 'daily', 21),
  (6, '2025-01-01', 0.90636, 'daily', 21),
  (7, '2025-01-01', 1.43606, 'daily', 21),
  (9, '2025-01-01', 0.3525, 'daily', 10),
  (10, '2025-01-01', 0.1593, 'daily', 10),
  (11, '2025-01-01', 0.17, 'daily', 10),
  (12, '2025-01-01', 0.0166, 'daily', 10),
  (13, '2025-01-01', 60, 'monthly', 0),
  (14, '2025-01-01', 3838.48, 'annual', 21);

-- Los costes existentes no se cobraban línea a línea. La cuota histórica real era
-- de 0,44 euros por vivienda y día, registrada por separado para conservarla.
UPDATE fixed_concept_rules
SET neighbor_amount = 0, neighbor_frequency = frequency, neighbor_vat_rate = 0;

INSERT INTO fixed_concept_rules
  (concept_id, effective_from, amount, frequency, vat_rate, neighbor_amount, neighbor_frequency, neighbor_vat_rate)
VALUES (15, '2025-01-01', 0, 'daily', 0, 0.44, 'daily', 0);

UPDATE periods SET day_adjustment = 0;
