export class StockMovementError extends Error {
  constructor(
    public readonly code: "INVENTORY_NOT_FOUND" | "INSUFFICIENT_STOCK" | "INVALID_MOVEMENT",
    message: string,
  ) {
    super(message);
    this.name = "StockMovementError";
  }
}
