import { config } from '../config.js';
import { gm } from '../utils/gm.js';

export class StorageManager {
  constructor() {
    this.historyKey = config.storage.historyKey;
    this.favoritesKey = config.storage.favoritesKey;
  }
  _read(key, fallback) {
    const value = gm.getValue(key, null);
    if (value === null || value === void 0) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value;
  }
  _write(key, value) {
    gm.setValue(key, JSON.stringify(value));
  }
  getHistory() {
    return this._read(this.historyKey, []);
  }
  addHistory(entry) {
    const history = this.getHistory();
    const now = Date.now();
    const next = [
      { title: entry.title || '', url: entry.url, time: now },
      ...history.filter((h) => h.url !== entry.url)
    ];
    this._write(this.historyKey, next.slice(0, config.maxHistoryEntries));
    return next;
  }
  clearHistory() {
    this._write(this.historyKey, []);
  }
  getFavorites() {
    return this._read(this.favoritesKey, []);
  }
  addFavorite(entry) {
    const favorites = this.getFavorites();
    if (favorites.some((f) => f.url === entry.url)) return favorites;
    const next = [{ title: entry.title || '', url: entry.url, time: Date.now() }, ...favorites];
    this._write(this.favoritesKey, next);
    return next;
  }
  removeFavorite(url) {
    const next = this.getFavorites().filter((f) => f.url !== url);
    this._write(this.favoritesKey, next);
    return next;
  }
  isFavorite(url) {
    return this.getFavorites().some((f) => f.url === url);
  }
}

export const storageManager = new StorageManager();
