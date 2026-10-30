// X 主题令牌：从 x.com 页面**只读**采样 X 当前真实生效的样式，注入成我们自己的 CSS 变量。
// 比硬编码调色板更强的地方在于：自动跟随 X 的亮/微暗/熄灯主题与未来的配色调整；
// 采样不到时回退到 X 官方三套主题的固定值。

const FALLBACK = {
  light: { bg: '#ffffff', fg: '#0f1419', muted: '#536471', border: '#eff3f4', soft: '#f7f9f9', hover: 'rgba(0, 0, 0, 0.03)' },
  dim: { bg: '#15202b', fg: '#f7f9f9', muted: '#8b98a5', border: '#38444d', soft: '#1e2732', hover: 'rgba(255, 255, 255, 0.03)' },
  dark: { bg: '#000000', fg: '#e7e9ea', muted: '#71767b', border: '#2f3336', soft: '#16181c', hover: 'rgba(255, 255, 255, 0.03)' }
};
const ACCENT = '#1d9bf0';
// 浅色正文链接：X 原生 #1d9bf0 对白底只有 3.0:1；正文/按钮统一换到可读的深一档，
// 图标、焦点环等非文字装饰仍保留 --pv-x-accent（X 品牌蓝）。
const ACCENT_TEXT = { light: '#0b6bcb', dim: '#1d9bf0', dark: '#1d9bf0' };
const ACCENT_FILL = '#0f6fbf';
const ON_ACCENT = '#ffffff';
const SCROLLBAR = { light: '#a9b4c0', dim: '#4a5568', dark: '#4a5568' };
// X 的互动激活色（三套主题一致）
const LIKE = '#f91880';
const REPOST = '#00ba7c';
// 错误/危险色：X 的 #f4212e 在白底只有 4.1:1，按主题各取一档，三套背景上都 ≥ 4.5:1
//   light #d0101c / #fff = 5.6:1；dim #ff6b75 / #15202b = 6.0:1；dark #ff5c66 / #000 = 7.0:1
const DANGER = { light: '#d0101c', dim: '#ff6b75', dark: '#ff5c66' };

const VAR_MAP = {
  bg: '--pv-x-bg',
  fg: '--pv-x-fg',
  muted: '--pv-x-muted',
  border: '--pv-x-border',
  soft: '--pv-x-soft',
  hover: '--pv-x-hover',
  accent: '--pv-x-accent',
  accentText: '--pv-x-accent-text',
  accentFill: '--pv-x-accent-fill',
  onAccent: '--pv-x-on-accent',
  scrollbar: '--pv-x-scrollbar',
  like: '--pv-x-like',
  repost: '--pv-x-repost',
  danger: '--pv-x-danger',
  font: '--pv-x-font'
};

function computed(node, prop) {
  if (!node) return null;
  try {
    const value = getComputedStyle(node)[prop];
    return value && value !== 'rgba(0, 0, 0, 0)' ? value : null;
  } catch (err) {
    return null;
  }
}

function firstComputed(selectors, prop) {
  for (const selector of selectors) {
    let node = null;
    try {
      node = document.querySelector(selector);
    } catch (err) {
      continue;
    }
    const value = computed(node, prop);
    if (value) return value;
  }
  return null;
}

/**
 * 次要文字色：**不采样，用主题固定值**。
 * 采样在这里连续踩坑：`[data-testid="User-Name"]` 在页面上的第一个匹配未必是普通时间线
 * 帖子（可能是推荐模块/资料卡），取到的会是 X 的链接蓝，导致 @handle、时间、操作图标
 * 整片变蓝。X 三套主题的次要色是固定的，查表更可靠。
 */
function mutedFor(mode) {
  return FALLBACK[mode].muted;
}

/**
 * 边框/分隔线色：**不做采样，直接用主题固定值**。
 * 原因：X 的分隔线多由背景色或伪元素实现，元素本身没有边框，
 * 此时 getComputedStyle().borderBottomColor 会退化成初始值（实测 rgb(0,0,0)），
 * 采出来就是一条黑线；而 X 三套主题的分隔线色是固定的，查表更可靠。
 */
function borderFor(mode) {
  return FALLBACK[mode].border;
}

/** 判定 X 主题模式：沿用 peek 已验证的 body 背景色判定 */
export function readXTheme() {
  const bodyBg = computed(document.body, 'backgroundColor');
  const mode = /rgb\(0,\s*0,\s*0\)/.test(bodyBg || '')
    ? 'dark'
    : /rgb\((?:21|22),\s*(?:31|32),\s*(?:42|43)\)/.test(bodyBg || '')
      ? 'dim'
      : 'light';
  const base = FALLBACK[mode];
  return {
    mode,
    // 采样只保留来源可靠的几项：body 背景、帖子正文色、body 字体；
    // 链接色不用采样值（X 浅色原生 #1d9bf0 对白底仅 3.0:1），走可读主题表。
    bg: bodyBg || base.bg,
    fg: firstComputed(['[data-testid="tweetText"]', 'article[data-testid="tweet"]'], 'color') || base.fg,
    muted: mutedFor(mode),
    border: borderFor(mode),
    soft: base.soft,
    hover: base.hover,
    // 文字链接用可读色；采样值在浅色下常是 #1d9bf0（3.0:1），所以直接用主题表
    accent: ACCENT_TEXT[mode] || ACCENT,
    accentText: ACCENT_TEXT[mode] || ACCENT,
    accentFill: ACCENT_FILL,
    onAccent: ON_ACCENT,
    scrollbar: SCROLLBAR[mode] || SCROLLBAR.light,
    like: LIKE,
    repost: REPOST,
    danger: DANGER[mode],
    font: computed(document.body, 'fontFamily')
  };
}

/** 把令牌写到指定元素上（面板外壳 + 内容区各写一份，避免依赖继承链） */
export function applyXSkin(elements, theme = readXTheme()) {
  for (const node of elements) {
    if (!node) continue;
    for (const [key, cssVar] of Object.entries(VAR_MAP)) {
      const value = theme[key];
      if (value) node.style.setProperty(cssVar, value);
    }
  }
  return theme;
}

/** X 切换主题时会改 html/body 的 style 或 class，这里跟随重刷 */
export function watchXTheme(callback) {
  if (!document.body) return () => {};
  const observer = new MutationObserver(() => callback(readXTheme()));
  const options = { attributes: true, attributeFilter: ['style', 'class'] };
  observer.observe(document.body, options);
  if (document.documentElement) observer.observe(document.documentElement, options);
  return () => observer.disconnect();
}
