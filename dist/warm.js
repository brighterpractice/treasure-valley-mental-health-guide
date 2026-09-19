const heroSearch=document.getElementById('heroSearch');
heroSearch?.addEventListener('submit',event=>{
  event.preventDefault();
  const query=document.getElementById('heroConcern')?.value.trim()||'';
  const url=new URL('find-counselor.html',location.href);
  if(query) url.searchParams.set('q',query);
  location.href=url.toString();
});
