ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_balance_check
  CHECK (after_quantity = before_quantity + quantity);

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_quantity_check
  CHECK (
    (type IN ('IN', 'INITIAL') AND quantity > 0)
    OR (type = 'OUT' AND quantity < 0)
    OR (type IN ('ADJUSTMENT', 'COUNT'))
  );
