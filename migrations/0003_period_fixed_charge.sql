-- La cuota realmente cobrada es un dato único del periodo, no una regla por concepto.
UPDATE fixed_concepts
SET active = 0, updated_at = CURRENT_TIMESTAMP
WHERE id = 15 OR name = 'Cuota fija cobrada a vecinos';
