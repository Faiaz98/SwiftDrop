/**
 * IndexedDB service for transfer history
 */

import { TransferRecord } from '../types/transfer';

const DB_NAME = 'FileTransferDB';
const DB_VERSION = 1;
const STORE_NAME = 'transfers';

class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async addTransfer(transfer: TransferRecord): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.add(transfer);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add transfer'));
    });
  }

  async getAllTransfers(): Promise<TransferRecord[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const transfers = request.result as TransferRecord[];
        // Sort by timestamp descending
        transfers.sort((a, b) => b.timestamp - a.timestamp);
        resolve(transfers);
      };
      request.onerror = () => reject(new Error('Failed to get transfers'));
    });
  }

  async getRecentTransfers(limit: number = 10): Promise<TransferRecord[]> {
    const allTransfers = await this.getAllTransfers();
    return allTransfers.slice(0, limit);
  }

  async clearHistory(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear history'));
    });
  }

  async deleteTransfer(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete transfer'));
    });
  }
}

export const storageService = new StorageService();
