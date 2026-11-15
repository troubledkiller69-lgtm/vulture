const menu = document.querySelector('.menu');
const nav = document.querySelector('#nav');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
nav.addEventListener('click', event => {
  if (event.target.closest('a')) {
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }
});
let orderConfig = { ordersEnabled: false };
let widgetId;
let photoData = null;
document.querySelector('#photo').addEventListener('change', async event => {
  photoData = null;
  const preview = document.querySelector('#photo-preview');
  preview.replaceChildren();
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2000000) {
    event.target.value = '';
    document.querySelector('.form-result').textContent = 'Choose a JPEG or PNG smaller than 2 MB.';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result;
    const image = document.createElement('img'); image.src = photoData; image.alt = 'Your selected cart screenshot';
    preview.append(image);
  };
  reader.readAsDataURL(file);
});
fetch('/api/config', { cache: 'no-store' }).then(response => response.json()).then(config => {
  orderConfig = config;
  if (!config.ordersEnabled) return;
  document.querySelector('#order-form button').disabled = false;
  if (!config.turnstileSiteKey) return;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onload = () => {
    try {
      widgetId = window.turnstile.render('#verification', { sitekey: config.turnstileSiteKey, action: 'order', 'error-callback': () => { document.querySelector('.form-result').textContent = 'Verification failed to load. Refresh the page and try again.'; } });
      document.querySelector('#order-form button').disabled = false;
      document.querySelector('.order-copy .warning').textContent = 'Your request is sent to our team. No payment is collected here.';
    } catch {
      document.querySelector('.form-result').textContent = 'Verification could not start. Refresh the page and try again.';
    }
  };
  script.onerror = () => { document.querySelector('.form-result').textContent = 'Verification could not load. Check your connection and refresh.'; };
  document.head.append(script);
}).catch(() => {});
document.querySelector('#order-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('.form-result');
  const identity = await fetch('/api/account/me', { cache: 'no-store' }).catch(() => null);
  if (!identity?.ok) { location.hash = '#account'; return; }
  if (!orderConfig.ordersEnabled) { result.textContent = 'Ordering is not open yet.'; return; }
  if (!widgetId) { result.textContent = 'Verification is still loading. Wait a moment and send again.'; return; }
  const button = event.target.querySelector('button');
  button.disabled = true;
  result.textContent = 'Sending your request...';
  try {
    const response = await fetch('/api/orders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restaurant: document.querySelector('#restaurant').value.trim(), details: document.querySelector('#details').value.trim(), contact: document.querySelector('#contact').value.trim(), cartTotalCents: Math.round(Number(document.querySelector('#total').value) * 100), fulfillment: document.querySelector('#fulfillment').value.toLowerCase(), photo: photoData, turnstileToken: window.turnstile.getResponse(widgetId) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not send your request.');
    result.replaceChildren();
    result.append(`Request received. Your reference is ${data.id}. `);
    const ticketLink = document.createElement('a');
    ticketLink.href = '#tickets';
    ticketLink.textContent = 'Open your ticket';
    result.append(ticketLink);
    event.target.reset(); photoData = null; document.querySelector('#photo-preview').replaceChildren(); updateSummary();
  } catch (error) { result.textContent = error.message || 'Could not send your request. Try again.'; }
  finally { button.disabled = false; window.turnstile?.reset(widgetId); }
});

const form = document.querySelector('#order-form');
const summary = document.createElement('div');
summary.className = 'live-summary';
summary.setAttribute('aria-live', 'polite');
form.querySelector('button').before(summary);

function updateSummary() {
  const restaurant = form.querySelector('#restaurant').value.trim();
  const amount = Number(form.querySelector('#total').value);
  const fulfillment = form.querySelector('#fulfillment').value;
  summary.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = 'Your order preview';
  const details = document.createElement('span');
  details.textContent = `${restaurant || 'Restaurant not entered'} · ${fulfillment} · ${amount > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : 'Add a cart total'}`;
  summary.append(heading, details);
}
form.addEventListener('input', updateSummary);
form.addEventListener('change', updateSummary);
updateSummary();

const lineup = document.querySelector('.lineup-window');
const track = lineup.querySelector('.lineup-track');
const fullList = document.querySelector('.lineup-list');
const list = document.createElement('ul');
for (const item of track.children) list.append(item.cloneNode(true));
fullList.append(list);

const domains = [
  'redrobin.com', 'pandaexpress.com', 'dairyqueen.com', 'dominos.com',
  'jerseymikes.com', 'hungryhowies.com', 'jamba.com', 'fiveguys.com',
  'qdoba.com', 'sonicdrivein.com', 'insomniacookies.com', 'habitburger.com',
  'buffalowildwings.com', 'crackerbarrel.com', 'moes.com', 'slimchickens.com',
  'zaxbys.com', 'smoothieking.com', 'tacocabana.com', 'tropicalsmoothiecafe.com',
  'churchs.com', 'cinnabon.com', 'dunkindonuts.com', 'happyicela.com',
  'farmerboys.com', 'applebees.com', 'cava.com', 'bojangles.com',
  'tendergreens.com', 'pizzaguys.com', 'imospizza.com', 'marcos.com',
  'smashburger.com', 'potbelly.com', 'charleys.com', 'slicelife.com'
];
[...track.children].forEach((item, index) => {
  const name = item.firstChild.textContent.trim();
  const image = document.createElement('img');
  image.src = `https://www.google.com/s2/favicons?sz=128&domain=${domains[index]}`;
  image.alt = name;
  image.loading = 'lazy';
  image.addEventListener('error', () => { item.hidden = true; });
  item.replaceChildren(image);
});
const marquee = document.querySelector('#restaurant-marquee');
marquee.append(document.querySelector('.lineup-controls'), lineup);
document.querySelector('.lineup-full').open = true;

const pauseButton = document.querySelector('.lineup-pause');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
let hovering = false;
let lastTime = 0;
function updatePauseButton() {
  pauseButton.textContent = paused ? 'Play' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
updatePauseButton();
pauseButton.addEventListener('click', () => { paused = !paused; updatePauseButton(); });
lineup.addEventListener('pointerenter', () => { hovering = true; });
lineup.addEventListener('pointerleave', () => { hovering = false; });
lineup.addEventListener('focusin', () => { hovering = true; });
lineup.addEventListener('focusout', () => { hovering = false; });
document.querySelector('.lineup-prev').addEventListener('click', () => lineup.scrollBy({ left: -260, behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
document.querySelector('.lineup-next').addEventListener('click', () => lineup.scrollBy({ left: 260, behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
reducedMotion.addEventListener('change', event => { if (event.matches) { paused = true; updatePauseButton(); } });
function moveLineup(time) {
  if (lastTime && !paused && !hovering && !document.hidden) {
    if (lineup.scrollLeft >= lineup.scrollWidth - lineup.clientWidth - 1) lineup.scrollLeft = 0;
    else lineup.scrollLeft += Math.min(time - lastTime, 50) * 0.035;
  }
  lastTime = time;
  requestAnimationFrame(moveLineup);
}
requestAnimationFrame(moveLineup);

const pages = ['home', 'how', 'stores', 'order', 'faq', 'account', 'tickets'];
const mobileNav = document.createElement('nav');
mobileNav.className = 'mobile-nav';
mobileNav.setAttribute('aria-label', 'Mobile navigation');
for (const [id, label] of [['home', 'Home'], ['stores', 'Stores'], ['order', 'Order'], ['faq', 'Help']]) {
  const link = document.createElement('a');
  link.href = `#${id}`;
  link.textContent = label;
  mobileNav.append(link);
}
document.body.append(mobileNav);
function showPage() {
  const id = location.hash.slice(1);
  const page = pages.includes(id) ? id : 'home';
  for (const name of pages) { const panel=document.getElementById(name); if(panel) panel.hidden = name !== page; }
  document.querySelector('#trust').hidden = page !== 'home';
  marquee.hidden = page !== 'home';
  for (const link of document.querySelectorAll('#nav a, .mobile-nav a')) {
    if (link.getAttribute('href') === `#${page}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showPage);
showPage();
const accountScript = document.createElement('script');
accountScript.src = '/account.js';
accountScript.onload = showPage;
document.body.append(accountScript);
const accountLink=document.createElement('a');
accountLink.href='#account';accountLink.textContent='Create an account or sign in before ordering';
document.querySelector('#order-form').prepend(accountLink);
