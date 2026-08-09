(function () {
  var USER_KEY = 'wdio_user_v1';
  var EVENT = 'wdio-auth-changed';

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

  function getUser() {
    return read(USER_KEY, null);
  }

  function login(user) {
    write(USER_KEY, user);
  }

  function logout() {
    write(USER_KEY, null);
  }

  function onChange(cb) {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', function (e) {
      if (e.key === USER_KEY) cb();
    });
    return function unsubscribe() {
      window.removeEventListener(EVENT, cb);
    };
  }

  window.__wdioAuth = {
    getUser: getUser,
    login: login,
    logout: logout,
    onChange: onChange
  };
})();
