import type { LocalState } from "@/src/lib/local/types";

export const LOCAL_DB_NAME = "hanger-warehouse-local";
export const LOCAL_DB_VERSION = 1;
export const LOCAL_STORE_NAMES = ["products", "variants", "warehouses", "inventory", "movements", "settings"] as const;
export type LocalStoreName = (typeof LOCAL_STORE_NAMES)[number];

let databasePromise: Promise<IDBDatabase> | null = null;

function createIndexes(store: IDBObjectStore, indexes: Array<[string, string | string[], IDBIndexParameters?]>): void {
  for (const [name, keyPath, options] of indexes) store.createIndex(name, keyPath, options);
}

export function openLocalDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("当前浏览器不支持本地数据存储"));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const products = database.objectStoreNames.contains("products") ? request.transaction!.objectStore("products") : database.createObjectStore("products", { keyPath: "id" });
      const variants = database.objectStoreNames.contains("variants") ? request.transaction!.objectStore("variants") : database.createObjectStore("variants", { keyPath: "id" });
      const warehouses = database.objectStoreNames.contains("warehouses") ? request.transaction!.objectStore("warehouses") : database.createObjectStore("warehouses", { keyPath: "id" });
      const inventory = database.objectStoreNames.contains("inventory") ? request.transaction!.objectStore("inventory") : database.createObjectStore("inventory", { keyPath: "id" });
      const movements = database.objectStoreNames.contains("movements") ? request.transaction!.objectStore("movements") : database.createObjectStore("movements", { keyPath: "id" });
      const settings = database.objectStoreNames.contains("settings") ? request.transaction!.objectStore("settings") : database.createObjectStore("settings", { keyPath: "key" });
      if (!variants.indexNames.contains("productId")) createIndexes(variants, [["productId", "productId"], ["sku", "sku", { unique: true }]]);
      if (!inventory.indexNames.contains("variantWarehouse")) createIndexes(inventory, [["variantWarehouse", ["variantId", "warehouseId"]]]);
      if (!movements.indexNames.contains("variantWarehouseCreatedAt")) createIndexes(movements, [["variantWarehouseCreatedAt", ["variantId", "warehouseId", "createdAt"]], ["type", "type"]]);
      if (!products.indexNames.contains("active")) createIndexes(products, [["active", "isActive"]]);
      if (!variants.indexNames.contains("active")) createIndexes(variants, [["active", "isActive"]]);
      if (!warehouses.indexNames.contains("active")) createIndexes(warehouses, [["active", "isActive"]]);
      void settings;
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本地数据库打开失败"));
  });
  databasePromise.catch(() => { databasePromise = null; });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本地数据读取失败"));
  });
}

export async function readLocalState(database?: IDBDatabase): Promise<LocalState> {
  const activeDatabase = database ?? await openLocalDatabase();
  const transaction = activeDatabase.transaction([...LOCAL_STORE_NAMES], "readonly");
  const values = await Promise.all(LOCAL_STORE_NAMES.map((name) => requestResult(transaction.objectStore(name).getAll())));
  return { products: values[0] as LocalState["products"], variants: values[1] as LocalState["variants"], warehouses: values[2] as LocalState["warehouses"], inventory: values[3] as LocalState["inventory"], movements: values[4] as LocalState["movements"], settings: values[5] as LocalState["settings"] };
}

export function replaceLocalState(database: IDBDatabase, state: LocalState): Promise<void> {
  const transaction = database.transaction([...LOCAL_STORE_NAMES], "readwrite");
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("本地数据保存失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("本地数据保存已回滚"));
  });
  const data = [state.products, state.variants, state.warehouses, state.inventory, state.movements, state.settings];
  for (let index = 0; index < LOCAL_STORE_NAMES.length; index += 1) {
    const store = transaction.objectStore(LOCAL_STORE_NAMES[index]);
    store.clear();
    for (const row of data[index]) store.put(row);
  }
  return done;
}

export function runLocalStateTransaction<T>(mutator: (state: LocalState) => { state: LocalState; result: T }): Promise<T> {
  return openLocalDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction([...LOCAL_STORE_NAMES], "readwrite");
    const values: unknown[][] = Array.from({ length: LOCAL_STORE_NAMES.length }, () => []);
    let completedReads = 0;
    let result: T;
    let settled = false;
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error("本地数据保存失败")); } };
    transaction.onerror = () => fail(transaction.error ?? new Error("本地数据保存失败"));
    transaction.onabort = () => fail(transaction.error ?? new Error("本地数据保存已回滚"));
    transaction.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
    for (let index = 0; index < LOCAL_STORE_NAMES.length; index += 1) {
      const request = transaction.objectStore(LOCAL_STORE_NAMES[index]).getAll();
      request.onsuccess = () => {
        values[index] = request.result as unknown[];
        completedReads += 1;
        if (completedReads !== LOCAL_STORE_NAMES.length) return;
        try {
          const state: LocalState = { products: values[0] as LocalState["products"], variants: values[1] as LocalState["variants"], warehouses: values[2] as LocalState["warehouses"], inventory: values[3] as LocalState["inventory"], movements: values[4] as LocalState["movements"], settings: values[5] as LocalState["settings"] };
          const next = mutator(state);
          result = next.result;
          const data = [next.state.products, next.state.variants, next.state.warehouses, next.state.inventory, next.state.movements, next.state.settings];
          for (let storeIndex = 0; storeIndex < LOCAL_STORE_NAMES.length; storeIndex += 1) {
            const store = transaction.objectStore(LOCAL_STORE_NAMES[storeIndex]);
            store.clear();
            for (const row of data[storeIndex]) store.put(row);
          }
        } catch (error) {
          transaction.abort();
          fail(error);
        }
      };
      request.onerror = () => fail(request.error ?? new Error("本地数据读取失败"));
    }
  }));
}
