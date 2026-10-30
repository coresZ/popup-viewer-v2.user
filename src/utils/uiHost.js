// 外壳 Shadow DOM 宿主（v2.3.0）。
// 弹窗、设置、规则面板、点选界面、悬浮齿轮都挂进同一个开放 shadow root：
// 宿主网站的 CSS 进不来，脚本的 --popup-* 令牌与类名也不会泄漏到网站。
// 任何一步失败（不支持 attachShadow、样式被 CSP 拦下）都回退到 v2.2 的挂法：直接挂 body + 全局样式。
import { setUiRoot, pickMountPoint } from './dom.js';
import { gm } from './gm.js';

const HOST_ID = 'pv2-ui-host';
const PAGE_START = '/* @pv-page-start */';
const PAGE_END = '/* @pv-page-end */';

/** 只作用于宿主页面的规则（论坛链接美化、「会在弹窗打开」提示图标），从标记块里取出来。 */
export function extractPageCss(css) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(PAGE_START, from);
    if (start < 0) break;
    const end = css.indexOf(PAGE_END, start);
    if (end < 0) break;
    out.push(css.slice(start + PAGE_START.length, end));
    from = end + PAGE_END.length;
  }
  return out.join('\n');
}

/** :root 令牌改写到 :host，主题类改为挂在宿主元素上。 */
export function toShadowCss(css) {
  return css
    .replace(/:root\.pv-theme-dark/g, ':host(.pv-theme-dark)')
    .replace(/:root\.pv-theme-light/g, ':host(.pv-theme-light)')
    .replace(/:root:not\(\.pv-theme-light\)/g, ':host(:not(.pv-theme-light))')
    .replace(/:root(?![\w-])/g, ':host');
}

function injectInto(root, css) {
  let ok = false;
  try {
    if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in root) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      ok = true;
    }
  } catch {}
  if (!ok) {
    // 构造式样式表不可用（或在沙箱里跨文档报错）：退回 <style>。CSP 拦截时由探针发现
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }
}

/** 样式是否真的生效：探针元素按样式表应为 13px 宽。 */
function stylesApplied(root) {
  const probe = document.createElement('div');
  probe.className = 'pv-style-probe';
  root.appendChild(probe);
  const ok = probe.offsetWidth === 13;
  probe.remove();
  return ok;
}

/**
 * 创建宿主并注入样式。返回 shadow root；失败时返回 null（调用方按旧方式全局注入）。
 * @param {string} css 完整 style.css
 */
export function createUiHost(css) {
  if (!css || typeof document === 'undefined' || !document.documentElement) return null;
  const existing = document.getElementById(HOST_ID);
  if (existing && existing.shadowRoot) {
    setUiRoot(existing.shadowRoot);
    return existing.shadowRoot;
  }
  let host = null;
  try {
    host = document.createElement('div');
    host.id = HOST_ID;
    // 宿主自身不占布局、不吃宿主页面样式；子元素都是 position:fixed，相对视口定位
    host.setAttribute(
      'style',
      'all: initial !important; position: fixed !important; top: 0 !important; left: 0 !important; ' +
        'width: 0 !important; height: 0 !important; overflow: visible !important; ' +
        'z-index: 2147483000 !important; display: block !important;'
    );
    const root = host.attachShadow({ mode: 'open' });
    injectInto(root, toShadowCss(css) + '\n.pv-style-probe{position:absolute;width:13px;height:1px;visibility:hidden}');
    const parent = pickMountPoint();
    parent.appendChild(host);
    if (!stylesApplied(root)) throw new Error('shadow styles not applied');
    setUiRoot(root);
    // 宿主页面只需要「页面装饰」那一小段（论坛链接、提示图标）
    const pageCss = extractPageCss(css);
    if (pageCss.trim()) gm.addStyle(pageCss);
    return root;
  } catch (err) {
    console.warn('[PopupViewer] Shadow DOM 不可用，回退到页面内挂载', err);
    try {
      host?.remove();
    } catch {}
    setUiRoot(null);
    return null;
  }
}
