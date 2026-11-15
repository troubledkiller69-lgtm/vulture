const main = document.querySelector('main');
const account = document.createElement('section');
account.id='account'; account.className='section account-page'; account.hidden=true;
account.innerHTML=`<h2>Your account</h2><p id="account-welcome">Sign in before ordering. Your orders open private tickets with our crew.</p><form id="account-form" class="form-panel"><label for="account-name">Name (for signup)</label><input id="account-name" maxlength="80" autocomplete="name"><label for="account-email">Email</label><input id="account-email" type="email" required maxlength="254" autocomplete="username"><label for="account-password">Password</label><input id="account-password" type="password" required minlength="12" maxlength="128" autocomplete="current-password"><p>Use 12 to 128 characters.</p><div class="account-actions"><button type="submit" class="button" value="signin">Sign in</button><button type="submit" class="button" value="signup">Create account</button></div><p id="account-result" role="status"></p></form><div id="account-signed-in" hidden><p id="account-greeting"></p><div class="account-actions"><a class="button" href="#order">Start an order</a><a class="button" href="#tickets">My orders</a></div></div><button type="button" id="signout" hidden>Sign out</button>`;
main.append(account);
const tickets=document.createElement('section'); tickets.id='tickets'; tickets.className='section tickets-page'; tickets.hidden=true;
tickets.innerHTML='<h2>My orders</h2><p id="tickets-notice" role="status"></p><div id="tickets-list"></div><div id="ticket-conversation"></div>';
main.append(tickets);
for(const nav of document.querySelectorAll('#nav,.mobile-nav')){
  for(const [id,label] of [['account','Account'],['tickets','My orders']]) {const a=document.createElement('a');a.href=`#${id}`;a.textContent=label;nav.append(a);}
}
let customer=null;
async function session(){
  try {const r=await fetch('/api/account/me',{cache:'no-store'});customer=r.ok?(await r.json()).customer:null;} catch {customer=null;}
  document.querySelector('#signout').hidden=!customer;
  document.querySelector('#account-form').hidden=!!customer;
  document.querySelector('#account-signed-in').hidden=!customer;
  document.querySelector('#account-welcome').hidden=!!customer;
  if(customer){
    document.querySelector('#account-greeting').textContent=`Signed in as ${customer.name} (${customer.email}).`;
    const contact=document.querySelector('#contact');
    if(contact && !contact.value) contact.value=customer.email;
  }
  return customer;
}
session();
document.querySelector('#account-form').addEventListener('submit',async e=>{
  e.preventDefault();const action=e.submitter?.value||'signin';const notice=document.querySelector('#account-result');
  const buttons=[...e.target.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);notice.textContent='Working...';
  try{
    const r=await fetch(`/api/account/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:document.querySelector('#account-name').value,email:document.querySelector('#account-email').value,password:document.querySelector('#account-password').value})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to sign in.');
    document.querySelector('#account-password').value='';await session();location.hash='#order';
  }catch(err){notice.textContent=err.message;}finally{buttons.forEach(b=>b.disabled=false);}
});
document.querySelector('#signout').addEventListener('click',async()=>{const r=await fetch('/api/account/signout',{method:'POST'});if(r.ok){await session();location.hash='#account';}});
async function loadTickets(){
  const notice=document.querySelector('#tickets-notice');const list=document.querySelector('#tickets-list');list.replaceChildren();document.querySelector('#ticket-conversation').replaceChildren();notice.textContent='Loading...';
  try{const r=await fetch('/api/tickets',{cache:'no-store'});const data=await r.json();if(r.status===401){notice.textContent='Sign in to see your orders.';return;}if(!r.ok)throw new Error(data.error);notice.textContent=data.tickets.length?'Select an order to open its ticket.':'No orders yet. Start one from the order page.';
    for(const ticket of data.tickets){const b=document.createElement('button');b.type='button';b.className='ticket-choice';b.textContent=`${ticket.restaurant} (${ticket.status})`;b.addEventListener('click',()=>openTicket(ticket.id));list.append(b);}
  }catch(err){notice.textContent=err.message||'Could not load tickets.';}
}
async function openTicket(id){
  const container=document.querySelector('#ticket-conversation');container.replaceChildren();
  try{const r=await fetch(`/api/tickets/${id}`,{cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error);
    const heading=document.createElement('h3');heading.textContent=`${data.ticket.restaurant}: ${data.ticket.status}`;container.append(heading);
    const meta=document.createElement('p');meta.className='ticket-meta';meta.textContent=`${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.ticket.cart_total_cents/100)} · ${data.ticket.fulfillment}`;container.append(meta);
    if(data.ticket.photo_key){const photo=document.createElement('a');photo.href=`/api/tickets/${id}/photo`;photo.target='_blank';photo.rel='noopener noreferrer';photo.textContent='View your cart screenshot';photo.className='ticket-link';container.append(photo);}
    for(const m of data.messages){const p=document.createElement('p');p.className='message';p.textContent=`${m.author_role==='staff'?'Crew':'You'}: ${m.body}`;container.append(p);}
    if(!['cancelled','completed'].includes(data.ticket.status)){
      const form=document.createElement('form');const label=document.createElement('label');label.htmlFor='ticket-reply';label.textContent='Reply to crew';const input=document.createElement('textarea');input.id='ticket-reply';input.required=true;input.maxLength=2000;const button=document.createElement('button');button.textContent='Send reply';button.type='submit';const status=document.createElement('p');status.setAttribute('role','status');form.append(label,input,button,status);
      form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;try{const r=await fetch(`/api/tickets/${id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:input.value})});if(!r.ok)throw new Error((await r.json()).error);await openTicket(id);}catch(err){status.textContent=err.message;button.disabled=false;}});container.append(form);
    }
  }catch(err){const p=document.createElement('p');p.textContent=err.message||'Could not load ticket.';container.append(p);}
}
window.addEventListener('hashchange',()=>{if(location.hash==='#tickets')loadTickets();});
if(location.hash==='#tickets')loadTickets();
