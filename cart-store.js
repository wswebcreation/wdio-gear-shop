(function () {
  var CART_KEY = 'wdio_cart_v1';
  var PROMO_KEY = 'wdio_promo_v1';
  var EVENT = 'wdio-cart-changed';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent(EVENT));
  }

  function getCart() {
    return read(CART_KEY, []);
  }

  function setCart(cart) {
    write(CART_KEY, cart);
  }

  function addItem(id, color, size, qty) {
    qty = qty || 1;
    var cart = getCart();
    var existing = cart.find(function (c) {
      return c.id === id && c.color === color && c.size === size;
    });
    if (existing) existing.qty += qty;
    else cart.push({ id: id, color: color || null, size: size || null, qty: qty });
    setCart(cart);
  }

  function updateQtyAt(index, qty) {
    var cart = getCart();
    if (!cart[index]) return;
    cart[index].qty = Math.max(1, qty);
    setCart(cart);
  }

  function removeAt(index) {
    var cart = getCart();
    cart.splice(index, 1);
    setCart(cart);
  }

  function reorder(fromIndex, toIndex) {
    var cart = getCart();
    if (fromIndex === toIndex || !cart[fromIndex]) return;
    var moved = cart.splice(fromIndex, 1)[0];
    cart.splice(toIndex, 0, moved);
    setCart(cart);
  }

  function clear() {
    setCart([]);
    write(PROMO_KEY, null);
  }

  function count() {
    return getCart().reduce(function (sum, c) {
      return sum + c.qty;
    }, 0);
  }

  function getPromo() {
    return read(PROMO_KEY, null);
  }

  function setPromo(code) {
    write(PROMO_KEY, code);
  }

  function onChange(cb) {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', function (e) {
      if (e.key === CART_KEY || e.key === PROMO_KEY) cb();
    });
    return function unsubscribe() {
      window.removeEventListener(EVENT, cb);
    };
  }

  window.__wdioCart = {
    getCart: getCart,
    setCart: setCart,
    addItem: addItem,
    updateQtyAt: updateQtyAt,
    removeAt: removeAt,
    reorder: reorder,
    clear: clear,
    count: count,
    getPromo: getPromo,
    setPromo: setPromo,
    onChange: onChange
  };
})();
