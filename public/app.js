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
