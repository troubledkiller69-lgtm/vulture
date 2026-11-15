import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('site includes essential navigation and honest preview state', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const id of ['home', 'how', 'stores', 'order', 'faq']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /Every order opens a private ticket/);
  assert.match(html, /aria-expanded="false"/);
});
test('restaurant lineup excludes unavailable stores and preserves pickup details', async () => {
  const html = await readFile('public/index.html', 'utf8');
  const lineup = html.split('<ul class="lineup-track">')[1].split('</ul>')[0];
  assert.match(lineup, /Insomnia Cookies<small>Pickup and delivery/);
  assert.match(lineup, /Cinnabon<small>Pickup only/);
  assert.doesNotMatch(lineup, /Papa John|Wingstop|Starbucks|Raising Cane/);
});
test('site has app icons and manifest', async () => {
  const html = await readFile('public/index.html', 'utf8');
  assert.match(html, /rel="icon" href="\/favicon.ico"/);
  assert.match(html, /rel="apple-touch-icon"/);
  const manifest = JSON.parse(await readFile('public/site.webmanifest', 'utf8'));
  for (const icon of manifest.icons) assert.ok((await readFile(`public${icon.src}`)).length > 0);
});
