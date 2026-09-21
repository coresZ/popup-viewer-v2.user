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

/**
 * 构造式样式表（CSSOM）：不受页面 CSP `style-src` 限制。
 * 部分站点（如 X）的 CSP 不允许内联 <style>，此时 GM_addStyle/<style> 注入的样式会被
 * 浏览器直接丢弃，表现为「整个弹窗没有样式」。adoptedStyleSheets 走 CSSOM 接口，
 * 不经过 CSP 的内联样式检查，因此作为并行注入的第二条路。
 */
export function adoptStyle(css) {
  try {
    if (typeof CSSStyleSheet !== 'function' || !('adoptedStyleSheets' in document)) return null;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return sheet;
  } catch (err) {
    console.warn('[PopupViewer] adoptedStyleSheets failed', err);
    return null;
  }
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
    // 两条路并行注入：CSP 宽松的站点靠 <style>，CSP 拦内联样式的站点靠构造式样式表。
    // 规则完全相同，重复应用无副作用（同值覆盖），换取「任何 CSP 下都有样式」。
    let node = null;
    const fn = gmApi('GM_addStyle');
    if (fn) {
      try {
        node = fn(css);
      } catch (err) {
        console.warn('[PopupViewer] GM_addStyle failed, fallback to <style>', err);
      }
    }
    if (!node) {
      // 样式注入失败绝不能阻断脚本：吞掉并返回 null
      try {
        node = injectStyle(css);
      } catch (err) {
        console.warn('[PopupViewer] injectStyle failed', err);
      }
    }
    adoptStyle(css);
    return node;
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
