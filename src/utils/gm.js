// GM API 适配层：
// 1) GM_* 全局在部分环境（如 iOS Userscripts）根本未声明，直接引用标识符会抛
//    ReferenceError——必须通过 globalThis 属性 + typeof 安全探测；
// 2) 所有 GM 调用失败都静默回退到浏览器原生能力（fetch / localStorage / <style>）。
function gmApi(name) {
  try {
    const fn = globalThis[name];
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

export function injectStyle(css) {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
}

function localGet(key, fallback) {
  try {
    const raw = localStorage.getItem('popup-viewer:' + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function localSet(key, value) {
  try {
    localStorage.setItem('popup-viewer:' + key, JSON.stringify(value));
  } catch {}
}

export const gm = {
  addStyle(css) {
    const fn = gmApi('GM_addStyle');
    if (fn) {
      try {
        return fn(css);
      } catch (err) {
        console.warn('[PopupViewer] GM_addStyle failed, fallback to <style>', err);
      }
    }
    // 样式注入失败绝不能阻断脚本：吞掉并返回 null
    try {
      return injectStyle(css);
    } catch (err) {
      console.warn('[PopupViewer] injectStyle failed', err);
      return null;
    }
  },
  xmlhttpRequest(options) {
    const fn = gmApi('GM_xmlhttpRequest');
    if (fn) {
      return fn({
        timeout: options.timeout || 15e3,
        ...options
      });
    }
    // fetch 回退（无 GM 环境，如 iOS Userscripts）：带超时中止与 .abort()
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeout || 15e3) : null;
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
    };
    const promise = fetch(options.url, {
      method: options.method || 'GET',
      signal: controller ? controller.signal : undefined
    })
      .then(async (res) => {
        clearTimer();
        options.onload?.({
          status: res.status,
          statusText: res.statusText,
          responseText: await res.text(),
          finalUrl: res.url
        });
      })
      .catch((err) => {
        clearTimer();
        options.onerror?.(err);
      });
    if (controller) promise.abort = () => controller.abort();
    return promise;
  },
  getValue(key, fallback) {
    const fn = gmApi('GM_getValue');
    if (fn) {
      try {
        return fn(key, fallback);
      } catch {}
    }
    return localGet(key, fallback);
  },
  setValue(key, value) {
    const fn = gmApi('GM_setValue');
    if (fn) {
      try {
        return fn(key, value);
      } catch {}
    }
    return localSet(key, value);
  }
};
