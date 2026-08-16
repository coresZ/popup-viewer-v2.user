export const config = {
  popup: {
    // 窗体大小预设（可在设置面板切换）
    sizes: {
      small: { width: '40%', height: '60%' },
      medium: { width: '50%', height: '75%' },
      large: { width: '72%', height: '90%' },
      phone: { width: 'min(92vw, 400px)', height: 'min(85vh, 720px)' }
    },
    defaultSize: 'medium',
    scrollbarVisible: true
  },
  // 手机模式预置（尺寸 + 对应移动端 UA，仅影响抓取加载路径）
  phone: {
    sizes: {
      'iphone': {
        label: 'iPhone',
        width: '393px',
        height: '852px',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      'iphone-max': {
        label: 'Max',
        width: '430px',
        height: '932px',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      'android': {
        label: '安卓',
        width: '412px',
        height: '915px',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
      },
      'small': {
        label: '小屏',
        width: '360px',
        height: '780px',
        ua: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      }
    },
    defaultModel: 'iphone'
  },
  loader: {
    timeout: 15e3,
    // 默认加载方式: 'auto' | 'iframe' | 'request' | 'parser'
    defaultMode: 'auto'
  },
  cache: {
    enabled: true,
    ttl: 30 * 60 * 1e3, // 30 分钟
    maxEntries: 50
  },
  prefetch: {
    enabled: true,
    hoverDebounceMs: 150 // 悬停后延迟开始预热，避免鼠标扫过列表时频繁请求
  },
  observer: {
    debounceMs: 300
  },
  // 站点加载策略:
  //   iframe: true  → 使用 iframe 直接加载（页面自带脚本与登录态）
  //   scripts: true → 请求模式下保留目标页 <script> 以正常渲染（仅限信任站点）
  sitePolicy: {
    'linux.do': { iframe: true, scripts: true },
    '1cili.com': { iframe: false, scripts: true },
    's.9cili.mom': { iframe: false, scripts: true },
    unknown: { iframe: false, scripts: false }
  },
  storage: {
    historyKey: 'pv2:history',
    favoritesKey: 'pv2:favorites'
  },
  maxHistoryEntries: 100
};
