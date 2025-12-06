/**
 * xterm-kit: VFS Lite
 * Lightweight virtual filesystem for browser applications
 *
 * Supports IndexedDB (persistent) and Memory (ephemeral) backends
 */

const DB_VERSION = 1;
const STORE_NAME = 'filesystem';

function createVFSError(code, message, path) {
  const error = new Error(`${code}: ${message}: ${path}`);
  error.code = code;
  error.path = path;
  return error;
}

/**
 * Virtual Filesystem (Lite)
 * Provides a Node.js-like filesystem API in the browser
 */
export class VFSLite {
  constructor(options = {}) {
    this.backend = options.backend || 'indexeddb';
    this.dbName = options.dbName || 'vfs';
    this.db = null;
    this.memoryStore = null;

    if (this.backend === 'memory') {
      this.memoryStore = new Map();
      this.ready = this.initializeMemory();
    } else {
      this.ready = this.initializeIndexedDB();
    }
  }

  normalizePath(path) {
    if (!path || path === '') return '/';

    const isAbsolute = path.startsWith('/');
    const parts = path.split('/').filter(p => p && p !== '.');
    const normalized = [];

    for (const part of parts) {
      if (part === '..') {
        if (normalized.length > 0 && normalized[normalized.length - 1] !== '..') {
          normalized.pop();
        } else if (!isAbsolute) {
          normalized.push('..');
        }
      } else {
        normalized.push(part);
      }
    }

    const result = normalized.join('/');
    return isAbsolute ? (result === '' ? '/' : '/' + result) : (result === '' ? '.' : result);
  }

  async initializeMemory() {
    const now = Date.now();

    this.memoryStore.set('/', {
      path: '/',
      name: '',
      type: 'directory',
      parent: null,
      created: now,
      modified: now,
      size: 0,
    });

    const dirs = ['/home', '/tmp'];
    for (const dir of dirs) {
      const parts = dir.split('/').filter(p => p);
      const name = parts[parts.length - 1];
      const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

      this.memoryStore.set(dir, {
        path: dir,
        name,
        type: 'directory',
        parent,
        created: now,
        modified: now,
        size: 0,
      });
    }

    return Promise.resolve();
  }

  async initializeIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        let store;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'path' });
          store.createIndex('parent', 'parent', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        } else {
          store = transaction.objectStore(STORE_NAME);
        }

        const now = Date.now();

        store.put({
          path: '/',
          name: '',
          type: 'directory',
          parent: null,
          created: now,
          modified: now,
          size: 0,
        });

        const dirs = ['/home', '/tmp'];
        dirs.forEach(dir => {
          const parts = dir.split('/').filter(p => p);
          const name = parts[parts.length - 1];
          const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

          store.put({
            path: dir,
            name,
            type: 'directory',
            parent,
            created: now,
            modified: now,
            size: 0,
          });
        });
      };
    });
  }

  async readdir(path) {
    await this.ready;
    path = this.normalizePath(path);

    if (this.backend === 'memory') {
      const entries = [];
      for (const [key, entry] of this.memoryStore.entries()) {
        if (entry.parent === path) {
          entries.push({
            name: entry.name,
            type: entry.type,
            size: entry.size || 0,
            modified: entry.modified,
            created: entry.created,
          });
        }
      }
      return entries;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('parent');
      const request = index.getAll(path);

      request.onsuccess = () => {
        const entries = request.result.map(entry => ({
          name: entry.name,
          type: entry.type,
          size: entry.size || 0,
          modified: entry.modified,
          created: entry.created,
        }));
        resolve(entries);
      };

      request.onerror = () => reject(new Error(`Cannot read directory: ${path}`));
    });
  }

  async readFile(path) {
    await this.ready;
    path = this.normalizePath(path);

    if (this.backend === 'memory') {
      const entry = this.memoryStore.get(path);
      if (!entry) {
        throw createVFSError('ENOENT', 'no such file or directory', path);
      }
      if (entry.type !== 'file') {
        throw createVFSError('EISDIR', 'illegal operation on a directory', path);
      }
      return entry.content || '';
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          reject(createVFSError('ENOENT', 'no such file or directory', path));
        } else if (entry.type !== 'file') {
          reject(createVFSError('EISDIR', 'illegal operation on a directory', path));
        } else {
          resolve(entry.content || '');
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async writeFile(path, content) {
    await this.ready;
    path = this.normalizePath(path);

    const parts = path.split('/').filter(p => p);
    const name = parts[parts.length - 1];
    const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

    if (this.backend === 'memory') {
      const parentEntry = this.memoryStore.get(parent);
      if (parent !== '/' && !parentEntry) {
        throw createVFSError('ENOENT', 'no such file or directory', parent);
      }
      if (parentEntry && parentEntry.type !== 'directory') {
        throw createVFSError('ENOTDIR', 'not a directory', parent);
      }

      const existing = this.memoryStore.get(path);
      const now = Date.now();

      this.memoryStore.set(path, {
        path,
        name,
        type: 'file',
        parent,
        content,
        size: content.length,
        modified: now,
        created: existing ? existing.created : now,
      });

      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const createOrUpdateFile = () => {
        const getRequest = store.get(path);

        getRequest.onsuccess = () => {
          const existing = getRequest.result;
          const now = Date.now();

          const entry = {
            path,
            name,
            type: 'file',
            parent,
            content,
            size: content.length,
            modified: now,
            created: existing ? existing.created : now,
          };

          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      };

      if (parent !== '/') {
        const parentCheck = store.get(parent);
        parentCheck.onsuccess = () => {
          if (!parentCheck.result) {
            reject(createVFSError('ENOENT', 'no such file or directory', parent));
            return;
          }
          if (parentCheck.result.type !== 'directory') {
            reject(createVFSError('ENOTDIR', 'not a directory', parent));
            return;
          }
          createOrUpdateFile();
        };
        parentCheck.onerror = () => reject(parentCheck.error);
      } else {
        createOrUpdateFile();
      }
    });
  }

  async mkdir(path) {
    await this.ready;
    path = this.normalizePath(path);

    const parts = path.split('/').filter(p => p);
    const name = parts[parts.length - 1];
    const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

    if (this.backend === 'memory') {
      if (this.memoryStore.has(path)) {
        throw createVFSError('EEXIST', 'directory already exists', path);
      }

      const parentEntry = this.memoryStore.get(parent);
      if (parent !== '/' && !parentEntry) {
        throw createVFSError('ENOENT', 'no such file or directory', parent);
      }
      if (parentEntry && parentEntry.type !== 'directory') {
        throw createVFSError('ENOTDIR', 'not a directory', parent);
      }

      const now = Date.now();
      this.memoryStore.set(path, {
        path,
        name,
        type: 'directory',
        parent,
        created: now,
        modified: now,
        size: 0,
      });

      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(path);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          reject(createVFSError('EEXIST', 'directory already exists', path));
          return;
        }

        const createDir = () => {
          const now = Date.now();
          const entry = {
            path,
            name,
            type: 'directory',
            parent,
            created: now,
            modified: now,
            size: 0,
          };

          const putRequest = store.put(entry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };

        if (parent !== '/') {
          const parentCheck = store.get(parent);
          parentCheck.onsuccess = () => {
            if (!parentCheck.result) {
              reject(createVFSError('ENOENT', 'no such file or directory', parent));
              return;
            }
            if (parentCheck.result.type !== 'directory') {
              reject(createVFSError('ENOTDIR', 'not a directory', parent));
              return;
            }
            createDir();
          };
          parentCheck.onerror = () => reject(parentCheck.error);
        } else {
          createDir();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async unlink(path) {
    await this.ready;
    path = this.normalizePath(path);

    if (this.backend === 'memory') {
      const entry = this.memoryStore.get(path);
      if (!entry) {
        throw createVFSError('ENOENT', 'no such file or directory', path);
      }

      if (entry.type === 'directory') {
        for (const [key, value] of this.memoryStore.entries()) {
          if (value.parent === path) {
            throw createVFSError('ENOTEMPTY', 'directory not empty', path);
          }
        }
      }

      this.memoryStore.delete(path);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(path);

      getRequest.onsuccess = () => {
        if (!getRequest.result) {
          reject(createVFSError('ENOENT', 'no such file or directory', path));
          return;
        }

        const index = store.index('parent');
        const childrenRequest = index.getAll(path);

        childrenRequest.onsuccess = () => {
          const children = childrenRequest.result;
          if (children.length > 0) {
            reject(createVFSError('ENOTEMPTY', 'directory not empty', path));
            return;
          }

          const deleteRequest = store.delete(path);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        };

        childrenRequest.onerror = () => reject(childrenRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async stat(path) {
    await this.ready;
    path = this.normalizePath(path);

    if (this.backend === 'memory') {
      const entry = this.memoryStore.get(path);
      if (!entry) {
        throw createVFSError('ENOENT', 'no such file or directory', path);
      }
      return {
        type: entry.type,
        size: entry.size || 0,
        created: entry.created,
        modified: entry.modified,
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) {
          reject(createVFSError('ENOENT', 'no such file or directory', path));
        } else {
          resolve({
            type: entry.type,
            size: entry.size || 0,
            created: entry.created,
            modified: entry.modified,
          });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async exists(path) {
    await this.ready;
    path = this.normalizePath(path);

    try {
      await this.stat(path);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async rename(oldPath, newPath) {
    await this.ready;
    oldPath = this.normalizePath(oldPath);
    newPath = this.normalizePath(newPath);

    if (this.backend === 'memory') {
      const entry = this.memoryStore.get(oldPath);
      if (!entry) {
        throw createVFSError('ENOENT', 'no such file or directory', oldPath);
      }

      const parts = newPath.split('/').filter(p => p);
      const name = parts[parts.length - 1];
      const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

      const newEntry = {
        ...entry,
        path: newPath,
        name,
        parent,
        modified: Date.now(),
      };

      this.memoryStore.delete(oldPath);
      this.memoryStore.set(newPath, newEntry);

      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(oldPath);

      getRequest.onsuccess = () => {
        const entry = getRequest.result;
        if (!entry) {
          reject(createVFSError('ENOENT', 'no such file or directory', oldPath));
          return;
        }

        const deleteRequest = store.delete(oldPath);

        deleteRequest.onsuccess = () => {
          const parts = newPath.split('/').filter(p => p);
          const name = parts[parts.length - 1];
          const parent = parts.length === 1 ? '/' : '/' + parts.slice(0, -1).join('/');

          const newEntry = {
            ...entry,
            path: newPath,
            name,
            parent,
            modified: Date.now(),
          };

          const putRequest = store.put(newEntry);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };

        deleteRequest.onerror = () => reject(deleteRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async exportJSON() {
    await this.ready;

    if (this.backend === 'memory') {
      return {
        version: 1,
        backend: 'memory',
        entries: Array.from(this.memoryStore.entries()).map(([path, entry]) => entry)
      };
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve({
          version: 1,
          backend: 'indexeddb',
          entries: request.result
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  async importJSON(data) {
    await this.ready;

    if (!data || !data.entries) {
      throw new Error('Invalid VFS dump');
    }

    if (this.backend === 'memory') {
      this.memoryStore.clear();
      for (const entry of data.entries) {
        this.memoryStore.set(entry.path, entry);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        let count = 0;
        const errors = [];

        for (const entry of data.entries) {
          const putRequest = store.put(entry);
          putRequest.onerror = () => errors.push(putRequest.error);
          count++;
        }

        transaction.oncomplete = () => {
          if (errors.length > 0) {
            reject(new Error(`Import completed with ${errors.length} errors`));
          } else {
            resolve();
          }
        };

        transaction.onerror = () => reject(transaction.error);
      };

      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }
}
