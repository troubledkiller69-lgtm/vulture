const orders = document.querySelector('#orders');
const notice = document.querySelector('#notice');
const refresh = document.querySelector('#refresh');
const next = { new: ['claimed', 'cancelled'], claimed: ['placing', 'cancelled'], placing: ['completed', 'cancelled'], completed: [], cancelled: [] };
const labels = { claimed: 'Claim order', placing: 'Start placing', completed: 'Mark complete', cancelled: 'Cancel order' };

async function loadOrders() {
  refresh.disabled = true;
  notice.textContent = 'Loading orders...';
  try {
    const response = await fetch('/api/staff/orders', { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 403 ? 'Staff sign-in is required.' : 'Orders could not be loaded. Try refreshing.');
    const data = await response.json();
    orders.replaceChildren();
    notice.textContent = data.orders.length ? `${data.orders.length} orders shown` : 'No orders yet.';
    for (const order of data.orders) {
      const panel = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `${order.restaurant} · ${order.status} · ${new Date(order.created_at).toLocaleString()}`;
      panel.append(summary);
      const fields = document.createElement('dl');
      for (const [label, value] of [['Order ID', order.id], ['Details', order.details], ['Contact', order.contact || 'Not provided'], ['Total', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.cart_total_cents / 100)], ['Fulfillment', order.fulfillment], ['Assigned to', order.assigned_staff || 'Unassigned']]) {
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = value;
        fields.append(dt, dd);
      }
      panel.append(fields);
      const actions = document.createElement('div'); actions.className = 'actions';
      for (const status of next[order.status] || []) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = labels[status];
        button.addEventListener('click', async () => {
          if (status === 'cancelled' && !confirm('Cancel this order?')) return;
          button.disabled = true;
          try {
            const result = await fetch(`/api/staff/orders/${encodeURIComponent(order.id)}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ previousStatus: order.status, status }) });
            if (!result.ok) { const data = await result.json(); throw new Error(data.error || 'Could not update order.'); }
            await loadOrders();
          } catch (error) { notice.textContent = error.message; button.disabled = false; }
        });
        actions.append(button);
      }
      panel.append(actions); orders.append(panel);
    }
  } catch (error) { orders.replaceChildren(); notice.textContent = error.message || 'Orders could not be loaded.'; }
  finally { refresh.disabled = false; }
}
refresh.addEventListener('click', loadOrders);
loadOrders();
