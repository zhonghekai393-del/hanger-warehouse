export type LocalErrorCode =
  | "LOCAL_MOVEMENT_NOT_LATEST"
  | "LOCAL_PRODUCT_NOT_FOUND"
  | "LOCAL_VARIANT_NOT_FOUND"
  | "LOCAL_WAREHOUSE_NOT_FOUND"
  | "LOCAL_INVALID_BACKUP"
  | "LOCAL_STORAGE_ERROR";

export class LocalDataError extends Error {
  constructor(public readonly code: LocalErrorCode, message: string) {
    super(message);
    this.name = "LocalDataError";
  }
}
