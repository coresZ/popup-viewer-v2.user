const has = (fn) => typeof fn === 'function';

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
    if (has(GM_addStyle)) {
      try {
        return GM_addStyle(css);
      } catch {}
    }
    return injectStyle(css);
  },
  xmlhttpRequest(options) {
    if (has(GM_xmlhttpRequest)) {
      return GM_xmlhttpRequest({
        timeout: options.timeout || 15e3,
        ...options
      });
    }
    return fetch(options.url, { method: options.method || 'GET' })
      .then(async (res) =>
        options.onload?.({
          status: res.status,
          statusText: res.statusText,
          responseText: await res.text(),
          finalUrl: res.url
        })
      )
      .catch((err) => options.onerror?.(err));
  },
  getValue(key, fallback) {
    if (has(GM_getValue)) {
      try {
        return GM_getValue(key, fallback);
      } catch {}
    }
    return localGet(key, fallback);
  },
  setValue(key, value) {
    if (has(GM_setValue)) {
      try {
        return GM_setValue(key, value);
      } catch {}
    }
    return localSet(key, value);
  }
};
