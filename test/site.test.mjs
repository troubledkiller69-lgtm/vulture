import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('site includes essential navigation and honest preview state', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const id of ['home', 'how', 'stores', 'order', 'faq']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Orders, chat and payments are not connected/);
  assert.match(html, /aria-expanded="false"/);
});
