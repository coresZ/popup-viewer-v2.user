import { config } from '../config.js';
import { gm } from '../utils/gm.js';

const KEY = 'pv2:settings';
const SESSION_ONLY_KEYS = ['hangingMode'];

function defaultSettings() {
  return {
    theme: 'auto',
    scrollbarVisible: config.popup.scrollbarVisible,
    panelSize: config.popup.defaultSize,
    hangingMode: false,
    phonePosition: null
  };
}

export class SettingsManager {
  constructor() {
    this.settings = defaultSettings();
    this._loaded = false;
  }
  load() {
    if (this._loaded) return this.settings;
    this._loaded = true;
    const raw = gm.getValue(KEY, null);
    if (raw && typeof raw === 'object') {
      this.settings = { ...defaultSettings(), ...raw };
      if (!config.popup.sizes[this.settings.panelSize]) {
        this.settings.panelSize = defaultSettings().panelSize;
      }
    }
    return this.settings;
  }
  get() {
    return this.settings;
  }
  set(partial) {
    this.settings = { ...this.settings, ...partial };
    const persistable = {};
    for (const [key, value] of Object.entries(this.settings)) {
      if (!SESSION_ONLY_KEYS.includes(key)) persistable[key] = value;
    }
    gm.setValue(KEY, persistable);
    return this.settings;
  }
  reset() {
    this.settings = defaultSettings();
    gm.setValue(KEY, this.settings);
    return this.settings;
  }
}

export const settingsManager = new SettingsManager();
