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
