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
document.querySelector('#order-form').addEventListener('submit', event => {
  event.preventDefault();
  const restaurant = document.querySelector('#restaurant').value.trim();
  const result = document.querySelector('.form-result');
  result.textContent = `Preview ready for ${restaurant}. Nothing has been submitted; ordering is not connected yet.`;
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

const pages = ['home', 'how', 'stores', 'order', 'faq'];
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
  for (const name of pages) document.getElementById(name).hidden = name !== page;
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
