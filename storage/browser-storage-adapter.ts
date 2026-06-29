import type { BinaryStorageAdapter, StoredBinaryObject, StorageAdapterHealth } from './storage-contract';

const DB_NAME = 'xdisputer-binary-storage';
const STORE_NAME = 'objects';
const META_KEY = 'xdisputer.binary-storage.metadata.v1';

function assertBrowser() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('Browser storage adapter is only available in the browser.');
  }
}

function openDb(): Promise<IDBDatabase> {
  assertBrowser();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadMetadata(): StoredBinaryObject[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(META_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMetadata(values: StoredBinaryObject[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(META_KEY, JSON.stringify(values));
}

export function createBrowserStorageAdapter(): BinaryStorageAdapter {
  return {
    name: 'browser-indexeddb',

    async health(): Promise<StorageAdapterHealth> {
      try {
        assertBrowser();
        return { adapter: 'browser-indexeddb', available: true, detail: 'IndexedDB and localStorage are available.' };
      } catch (error) {
        return {
          adapter: 'browser-indexeddb',
          available: false,
          detail: error instanceof Error ? error.message : 'Browser storage is unavailable.'
        };
      }
    },

    async put(key, file, metadata) {
      const db = await openDb();
      const objectName = metadata?.name || (file instanceof File ? file.name : key.split('/').at(-1) || 'object.bin');
      const objectType = metadata?.type || file.type || 'application/octet-stream';
      const storedFile = file instanceof File ? file : new File([file], objectName, { type: objectType });
      const record: StoredBinaryObject = {
        key,
        name: objectName,
        type: objectType,
        size: file.size,
        updatedAt: new Date().toISOString()
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(storedFile, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      db.close();

      const next = loadMetadata().filter((item) => item.key !== key);
      next.push(record);
      saveMetadata(next);

      return record;
    },

    async get(key) {
      const db = await openDb();

      const value = await new Promise<File | null>((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve((request.result as File) || null);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return value;
    },

    async delete(key) {
      const db = await openDb();

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      db.close();
      saveMetadata(loadMetadata().filter((item) => item.key !== key));
    },

    async list(prefix = '') {
      const items = loadMetadata();
      return prefix ? items.filter((item) => item.key.startsWith(prefix)) : items;
    }
  };
}
