const state = { me: null, orders: [], filter: 'open', selected: null, timer: null };
const signinView = document.querySelector('#signin-view');
const boardView = document.querySelector('#board-view');
const signinNotice = document.querySelector('#signin-notice');
const notice = document.querySelector('#notice');
const ordersEl = document.querySelector('#orders');
const ticketEl = document.querySelector('#ticket');
const identityEl = document.querySelector('#identity');
const signoutButton = document.querySelector('#signout');
const refreshButton = document.querySelector('#refresh');
const template = document.querySelector('#ticket-template');
const next = { new: ['claimed', 'cancelled'], claimed: ['placing', 'cancelled'], placing: ['completed', 'cancelled'], completed: [], cancelled: [] };
const labels = { claimed: 'Claim ticket', placing: 'Start placing order', completed: 'Mark complete', cancelled: 'Cancel ticket' };
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const when = value => new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString();

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || 'Request failed.');
  return data;
}

function showSignedOut(message = '') {
  state.me = null;
  clearInterval(state.timer);
  signinView.hidden = false;
  boardView.hidden = true;
  identityEl.hidden = true;
  signoutButton.hidden = true;
  refreshButton.hidden = true;
  signinNotice.textContent = message;
}

async function checkSession() {
  try {
    const data = await api('/api/staff/session');
    state.me = data.staff;
    signinView.hidden = true;
    boardView.hidden = false;
    identityEl.hidden = false;
    identityEl.textContent = `${data.staff.name} (${data.staff.email})`;
    signoutButton.hidden = false;
    refreshButton.hidden = false;
    await loadOrders();
    clearInterval(state.timer);
    state.timer = setInterval(() => { if (!document.hidden) loadOrders().catch(() => {}); }, 45000);
  } catch {
    showSignedOut();
  }
}

document.querySelector('#signin-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  signinNotice.textContent = 'Signing in...';
  try {
    await api('/api/staff/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: document.querySelector('#email').value.trim(), password: document.querySelector('#password').value })
    });
    document.querySelector('#password').value = '';
    await checkSession();
  } catch (error) {
    signinNotice.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

signoutButton.addEventListener('click', async () => {
  try { await api('/api/staff/session', { method: 'DELETE' }); } catch {}
  state.selected = null;
  showSignedOut('Signed out.');
});

refreshButton.addEventListener('click', () => loadOrders().catch(error => { notice.textContent = error.message; }));

function matches(order) {
  const open = !['completed', 'cancelled'].includes(order.status);
  if (state.filter === 'open') return open;
  if (state.filter === 'closed') return !open;
  if (state.filter === 'unassigned') return open && !order.assigned_staff;
  if (state.filter === 'mine') return open && order.assigned_staff === state.me?.email;
  return true;
}

for (const button of document.querySelectorAll('.filters button')) {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    for (const other of document.querySelectorAll('.filters button')) {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-selected', String(other === button));
    }
    renderQueue();
  });
}

function renderQueue() {
  ordersEl.replaceChildren();
  const visible = state.orders.filter(matches);
  for (const order of visible) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'order-card' + (state.selected === order.id ? ' selected' : '');
    const row = document.createElement('div'); row.className = 'row';
    const name = document.createElement('strong'); name.textContent = order.restaurant;
    const tag = document.createElement('span'); tag.className = `tag ${order.status}`; tag.textContent = order.status;
    row.append(name, tag);
    const meta = document.createElement('div'); meta.className = 'row';
    const customer = document.createElement('small');
    customer.textContent = `${order.customer_name || 'Guest'} · ${money(order.cart_total_cents)} · ${order.fulfillment}`;
    const time = document.createElement('small'); time.textContent = when(order.created_at);
    meta.append(customer, time);
    const flags = document.createElement('small');
    const bits = [];
    if (!order.assigned_staff) bits.push('unassigned'); else bits.push(order.assigned_staff.split('@')[0]);
    if (order.photo_key) bits.push('photo');
    if (order.customer_messages) bits.push(`${order.customer_messages} message${order.customer_messages === 1 ? '' : 's'}`);
    flags.textContent = bits.join(' · ');
    card.append(row, meta, flags);
    card.addEventListener('click', () => openTicket(order.id));
    ordersEl.append(card);
  }
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = state.orders.length ? 'No tickets match this filter.' : 'No tickets yet.';
    ordersEl.append(empty);
  }
  notice.textContent = `${visible.length} of ${state.orders.length} tickets shown`;
}

async function loadOrders() {
  refreshButton.disabled = true;
  try {
    const data = await api('/api/staff/orders');
    state.orders = data.orders;
    renderQueue();
    if (state.selected && !state.orders.some(order => order.id === state.selected)) state.selected = null;
  } finally {
    refreshButton.disabled = false;
  }
}

async function openTicket(id) {
  state.selected = id;
  renderQueue();
  ticketEl.replaceChildren();
  const loading = document.createElement('p'); loading.className = 'empty'; loading.textContent = 'Loading ticket...';
  ticketEl.append(loading);
  let data;
  try { data = await api(`/api/staff/orders/${id}`); }
  catch (error) {
    ticketEl.replaceChildren();
    const failed = document.createElement('p'); failed.className = 'empty'; failed.textContent = error.message;
    ticketEl.append(failed);
    return;
  }
  const { ticket, messages, events } = data;
  ticketEl.replaceChildren();
  const fragment = template.content.cloneNode(true);
  fragment.querySelector('h2').textContent = ticket.restaurant;
  fragment.querySelector('.ticket-meta').textContent = `Ticket ${ticket.id} · opened ${when(ticket.created_at)}`;
  const status = fragment.querySelector('.status'); status.textContent = ticket.status; status.classList.add(ticket.status);
  const fields = fragment.querySelector('.ticket-fields');
  const rows = [
    ['Customer', ticket.customer_name || 'Guest'],
    ['Account email', ticket.customer_email || 'No account'],
    ['Contact for order', ticket.contact],
    ['Total', money(ticket.cart_total_cents)],
    ['Fulfillment', ticket.fulfillment],
    ['Assigned to', ticket.assigned_staff || 'Unassigned'],
    ['Order details', ticket.details],
    ['Last update', when(ticket.updated_at)]
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    fields.append(dt, dd);
  }
  const photoLink = fragment.querySelector('.photo-link');
  if (ticket.photo_key) photoLink.href = `/api/staff/orders/${encodeURIComponent(ticket.id)}/photo`; else photoLink.hidden = true;

  const actions = fragment.querySelector('.ticket-actions');
  for (const statusValue of next[ticket.status] || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = labels[statusValue];
    if (statusValue === 'cancelled') button.className = 'danger';
    button.addEventListener('click', async () => {
      if (statusValue === 'cancelled' && !confirm('Cancel this ticket and tell the customer? This cannot be undone.')) return;
      button.disabled = true;
      try {
        await api(`/api/staff/orders/${ticket.id}/status`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ previousStatus: ticket.status, status: statusValue })
        });
        await loadOrders();
        await openTicket(ticket.id);
      } catch (error) {
        notice.textContent = error.message;
        button.disabled = false;
      }
    });
    actions.append(button);
  }

  const thread = fragment.querySelector('.thread');
  const visible = messages.filter(message => message.visibility === 'customer' || message.visibility === 'staff');
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No messages yet. Send the customer a greeting or an update.';
    thread.append(empty);
  }
  for (const message of visible) {
    const bubble = document.createElement('div');
    bubble.className = 'message ' + (message.author_role === 'staff' ? (message.visibility === 'staff' ? 'staff-note' : 'staff-reply') : 'customer');
    const who = document.createElement('span'); who.className = 'who';
    who.textContent = `${message.author_role === 'staff' ? 'Crew' : 'Customer'}${message.visibility === 'staff' ? ' · private note' : ''} · ${when(message.created_at)}`;
    const body = document.createElement('span'); body.textContent = message.body;
    bubble.append(who, body);
    thread.append(bubble);
  }
  const eventsList = events.filter(event => event.event_type === 'status_changed').slice(-6);
  if (eventsList.length) {
    const history = document.createElement('p');
    history.className = 'ticket-meta';
    history.textContent = eventsList.map(event => `${event.actor.split('@')[0]}: ${event.note}`).join(' | ');
    thread.append(history);
  }

  const form = fragment.querySelector('.reply');
  form.hidden = ['completed', 'cancelled'].includes(ticket.status);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const statusEl = form.querySelector('.reply-status');
    const body = form.querySelector('textarea').value.trim();
    if (!body) return;
    button.disabled = true;
    statusEl.textContent = 'Sending...';
    try {
      await api(`/api/staff/orders/${ticket.id}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body, visibility: form.querySelector('input[name="visibility"]:checked').value })
      });
      await loadOrders();
      state.selected = ticket.id;
      await openTicket(ticket.id);
    } catch (error) {
      statusEl.textContent = error.message;
      button.disabled = false;
    }
  });

  ticketEl.append(fragment);
}

checkSession().catch(() => showSignedOut());
