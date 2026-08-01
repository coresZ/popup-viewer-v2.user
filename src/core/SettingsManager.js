import { config } from '../config.js';
import { gm } from '../utils/gm.js';

const KEY = 'pv2:settings';
const SITE_KEY = 'pv2:siteSettings';
// 全局设置：跨站点共享
const GLOBAL_KEYS = ['theme', 'allowInFrame'];
// 站点设置：按 hostname 分别记录，刷新不失效
const SITE_KEYS = ['scrollbarVisible', 'panelSize', 'windowMode', 'linkIntercept', 'phoneModel', 'phonePosition'];

function defaultGlobal() {
  return { theme: 'auto', allowInFrame: false };
}
function defaultSite() {
  return {
    scrollbarVisible: config.popup.scrollbarVisible,
    panelSize: config.popup.defaultSize,
    windowMode: 'coupled',
    linkIntercept: true,
    phoneModel: config.phone.defaultModel,
    phonePosition: null
  };
}
function currentSiteKey() {
  try {
    return window.location.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

export class SettingsManager {
  constructor() {
    this.global = defaultGlobal();
    this.site = defaultSite();
    this.siteKey = 'unknown';
    this._loaded = false;
  }
  load() {
    if (this._loaded) return this.get();
    this._loaded = true;
    this.siteKey = currentSiteKey();
    const g = gm.getValue(KEY, null);
    if (g && typeof g === 'object') this.global = { ...defaultGlobal(), ...g };
    const all = gm.getValue(SITE_KEY, null);
    if (all && typeof all === 'object' && all[this.siteKey]) {
      this.site = { ...defaultSite(), ...all[this.siteKey] };
    }
    if (!config.popup.sizes[this.site.panelSize]) {
      this.site.panelSize = defaultSite().panelSize;
    }
    if (!config.phone.sizes[this.site.phoneModel]) {
      this.site.phoneModel = defaultSite().phoneModel;
    }
    this._applyInvariants();
    return this.get();
  }
  /** 当前生效设置 = 全局 + 当前站点设置。 */
  get() {
    return { ...this.global, ...this.site };
  }
  set(partial) {
    for (const [key, value] of Object.entries(partial)) {
      if (GLOBAL_KEYS.includes(key)) this.global[key] = value;
      else this.site[key] = value;
    }
    this._applyInvariants();
    this._persist();
    return this.get();
  }
  reset() {
    this.global = defaultGlobal();
    this.site = defaultSite();
    this._applyInvariants();
    this._persist();
    return this.get();
  }
  _applyInvariants() {
    // 关闭页面链接拦截时，窗体必须是独立悬浮
    if (this.site.linkIntercept === false) this.site.windowMode = 'float';
  }
  _persist() {
    gm.setValue(KEY, this.global);
    const all = gm.getValue(SITE_KEY, null) || {};
    all[this.siteKey] = this.site;
    gm.setValue(SITE_KEY, all);
  }
}

export const settingsManager = new SettingsManager();
