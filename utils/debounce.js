export function debounce(fn, wait = 300, { leading = false } = {}) {
  let timer = null;
  let lastInvoke = 0;
  const wrapper = (...args) => {
    const now = Date.now();
    if (leading && now - lastInvoke > wait) {
      lastInvoke = now;
      return fn.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastInvoke = Date.now();
      fn.apply(this, args);
    }, wait);
  };
  wrapper.cancel = () => clearTimeout(timer);
  return wrapper;
}
