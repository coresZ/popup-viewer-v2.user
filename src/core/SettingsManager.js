import { config } from '../config.js';
import { gm } from '../utils/gm.js';

const KEY = 'pv2:settings';
const SITE_KEY = 'pv2:siteSettings';
// 全局设置：跨站点共享
const GLOBAL_KEYS = ['theme', 'allowInFrame', 'handedness', 'mobileResize'];
// 说明：set() 按「GLOBAL_KEYS 命中→全局，其余→当前站点」分流，站点键无需单独维护列表

function defaultGlobal() {
  // 触屏四角缩放手柄默认关闭：手机弹窗近全屏时，四个把手会遮挡正文四角。
  return { theme: 'auto', allowInFrame: false, handedness: 'right', mobileResize: false, uiRev: 1 };
}
function defaultSite() {
  return {
    scrollbarVisible: config.popup.scrollbarVisible,
    panelSize: config.popup.defaultSize,
    windowMode: 'coupled',
    linkIntercept: true,
    // 窗体内容里的链接在新标签页打开（原先与 linkIntercept 绑在一起，现已拆开）
    popupLinksNewTab: true,
    phoneModel: config.phone.defaultModel,
    phonePosition: null,
    customSize: null,
    locked: false
  };
}
function currentSiteKey() {
  try {
    return window.location.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

import { markMod } from '../utils/debugFlag.js';
markMod('SettingsManager');

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
    if (g && typeof g === 'object') {
      this.global = { ...defaultGlobal(), ...g };
      // v2.3.1 迁移：旧版把 mobileResize 默认写成了 true；未显式升级过 schema 的存量用户
      // 首次加载时按新默认关闭一次，用户仍可在「移动端」里重新打开。
      if (g.uiRev !== 1) this.global.mobileResize = false;
    }
    const all = gm.getValue(SITE_KEY, null);
    if (all && typeof all === 'object' && all[this.siteKey]) {
      const stored = all[this.siteKey];
      this.site = { ...defaultSite(), ...stored };
      // 迁移：旧版关闭拦截时窗体内链接也不新开标签页，未设置过新键时保持原行为
      if (!('popupLinksNewTab' in stored) && stored.linkIntercept === false) this.site.popupLinksNewTab = false;
    }
    if (!config.popup.sizes[this.site.panelSize] && this.site.panelSize !== 'custom') {
      this.site.panelSize = defaultSite().panelSize;
    }
    if (!config.phone.sizes[this.site.phoneModel]) {
      this.site.phoneModel = defaultSite().phoneModel;
    }
    this._applyInvariants();
    return this.get();
  }
  /** 该设置键是否按站点保存（不在 GLOBAL_KEYS 里即为站点键）。 */
  isSiteKey(key) {
    return !GLOBAL_KEYS.includes(key);
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
