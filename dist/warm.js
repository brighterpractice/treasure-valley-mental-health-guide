const heroSearch=document.getElementById('heroSearch');
heroSearch?.addEventListener('submit',event=>{
  event.preventDefault();
  const query=document.getElementById('heroConcern')?.value.trim()||'';
  const url=new URL('/find-counselor',location.href);
  if(query) url.searchParams.set('q',query);
  location.href=url.toString();
});


const menuButton=document.getElementById('menuButton');
const primaryNav=document.getElementById('primaryNav');

function setMenu(open){
  if(!menuButton||!primaryNav)return;
  primaryNav.classList.toggle('open',open);
  menuButton.setAttribute('aria-expanded',String(open));
}

menuButton?.addEventListener('click',()=>{
  setMenu(!primaryNav?.classList.contains('open'));
});

primaryNav?.querySelectorAll('a').forEach(link=>{
  link.addEventListener('click',()=>setMenu(false));
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&primaryNav?.classList.contains('open')){
    setMenu(false);
    menuButton?.focus();
  }
});
