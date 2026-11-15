import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoto } from '../src/photo.mjs';
test('photos are optional and reject unsupported formats and oversize data', () => {
  assert.equal(parsePhoto(null), null);
  assert.throws(() => parsePhoto('data:image/svg+xml;base64,AAAA'));
  assert.throws(() => parsePhoto('data:image/png;base64,AAAA'));
  assert.throws(() => parsePhoto('x'.repeat(700001)));
  assert.equal(parsePhoto('data:image/png;base64,iVBORw0KGgo=').type, 'image/png');
});
