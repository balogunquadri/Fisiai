const test = require('node:test');
const assert = require('node:assert/strict');

const authRouter = require('../src/routes/auth');

function findRoutePath(router, method, path) {
  return router.stack.some((layer) => {
    if (!layer.route) return false;
    return layer.route.path === path && layer.route.methods[method];
  });
}

test('auth router exposes forgot-password and reset-password endpoints', () => {
  assert.equal(findRoutePath(authRouter, 'post', '/forgot-password'), true);
  assert.equal(findRoutePath(authRouter, 'post', '/reset-password'), true);
});
