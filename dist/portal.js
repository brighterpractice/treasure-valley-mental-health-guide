const buttons = [...document.querySelectorAll('.portal-nav button')];
const panels = [...document.querySelectorAll('.portal-panel')];
const title = document.getElementById('panelTitle');
const qs = new URLSearchParams(location.search);
let currentPlan = qs.get('plan') === 'basic' ? 'basic' : 'advanced';

function titleCase(v){ return v.charAt(0).toUpperCase()+v.slice(1); }
function showPanel(name){
  buttons.forEach(b=>b.classList.toggle('active', b.dataset.panel===name));
  panels.forEach(p=>p.classList.toggle('active', p.id===`panel-${name}`));
  const btn = buttons.find(b=>b.dataset.panel===name);
  title.textContent = btn ? btn.childNodes[0].textContent.trim() : titleCase(name);
  window.scrollTo({top:0, behavior:'smooth'});
}
buttons.forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.panel)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.jump)));

document.querySelectorAll('.static-chips .filter-chip').forEach(b=>b.addEventListener('click',()=>b.classList.toggle('active')));

document.getElementById('saveProfile')?.addEventListener('click',e=>{ const old=e.currentTarget.textContent; e.currentTarget.textContent='Saved ✓'; setTimeout(()=>e.currentTarget.textContent=old,1400); });

function applyPlan(plan){
  currentPlan=plan;
  const advanced=plan==='advanced';
  document.getElementById('planMetric').textContent = advanced ? 'Advanced' : 'Basic';
  document.getElementById('billingPlanName').textContent = advanced ? 'Advanced · $49/year' : 'Basic · $12/year';
  document.getElementById('checkoutItem').textContent = advanced ? 'Advanced Provider Listing — $49/year' : 'Basic Provider Listing — $12/year';
  document.querySelectorAll('.plan-switch').forEach(b=>b.classList.toggle('selected',b.dataset.plan===plan));
  document.querySelectorAll('.portal-nav button').forEach(b=>{
    if(['analytics','media','qr'].includes(b.dataset.panel)) b.classList.toggle('locked',!advanced);
  });
}
applyPlan(currentPlan);
document.querySelectorAll('.plan-switch').forEach(b=>b.addEventListener('click',()=>applyPlan(b.dataset.plan)));

document.getElementById('checkoutDemo')?.addEventListener('click',()=>document.getElementById('checkoutDialog').showModal());
document.getElementById('closeCheckout')?.addEventListener('click',()=>document.getElementById('checkoutDialog').close());
document.getElementById('previewBtn')?.addEventListener('click',()=>location.href='index.html#find');
