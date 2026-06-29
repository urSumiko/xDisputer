export type StoredBinaryObject = {
  key: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

export type StorageAdapterHealth = {
  adapter: string;
  available: boolean;
  detail: string;
};

export type BinaryStorageAdapter = {
  readonly name: string;
  health(): Promise<StorageAdapterHealth>;
  put(key: string, file: File | Blob, metadata?: Partial<StoredBinaryObject>): Promise<StoredBinaryObject>;
  get(key: string): Promise<File | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<StoredBinaryObject[]>;
};

export function storageKey(...parts: Array<string | number | undefined | null>) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim())
    .map((part) => String(part).replace(/[\\/:*?"<>|]+/g, '-').trim())
    .join('/');
}
