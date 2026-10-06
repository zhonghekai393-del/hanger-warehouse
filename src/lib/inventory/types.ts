export type StockMovementAction = "IN" | "OUT" | "ADJUSTMENT";

export type MovementCalculation = {
  delta: number;
  afterQuantity: number;
  storedInputQuantity: number;
  storedInputUnit: string;
};
