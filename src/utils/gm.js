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
  /** 油猴菜单命令；无 GM 环境时返回 false（调用方保留悬浮齿轮作为入口）。 */
  registerMenuCommand(caption, onClick) {
    const fn = gmApi('GM_registerMenuCommand');
    if (!fn) return false;
    try {
      fn(caption, onClick);
      return true;
    } catch {
      return false;
    }
  },
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
      // GM 的超时走 ontimeout 而不是 onerror：调用方只写了 onerror 时，超时会让加载页一直转圈。
      // 这里统一转成 onerror，并带上可识别的 { timeout: true }
      const onTimeout =
        options.ontimeout || (options.onerror ? () => options.onerror({ timeout: true, error: '请求超时' }) : undefined);
      return fn({
        timeout: options.timeout || 15e3,
        ...options,
        ontimeout: onTimeout
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
        if (aborted) return; // 调用方主动取消：不再回调，避免旧请求的错误盖住新内容
        if (err && err.name === 'AbortError') options.onerror?.({ timeout: true, error: '请求超时' });
        else options.onerror?.(err);
      });
    let aborted = false;
    if (controller)
      promise.abort = () => {
        aborted = true;
        controller.abort();
      };
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
