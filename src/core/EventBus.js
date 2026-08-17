import { markMod } from '../utils/debugFlag.js';
markMod('EventBus');

export class EventBus {
  constructor() {
    this._handlers = new Map();
  }
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }
  once(event, handler) {
    const off = this.on(event, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }
  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }
  emit(event, payload) {
    const handlers = this._handlers.get(event);
    if (!handlers) return;
    handlers.forEach((h) => {
      try {
        h(payload, event);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}"`, err);
      }
    });
  }
  clear(event) {
    if (event) this._handlers.delete(event);
    else this._handlers.clear();
  }
}

export const eventBus = new EventBus();
