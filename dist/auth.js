import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const cfg=window.TV_GUIDE_SUPABASE;
const supabase=createClient(cfg.url,cfg.publishableKey);
const form=document.getElementById('authForm'), message=document.getElementById('authMessage'), submit=form.querySelector('button'), email=document.getElementById('email'), password=document.getElementById('password'), title=document.getElementById('authTitle'), lead=document.querySelector('.auth-lead');
const qs=new URLSearchParams(location.search);
const requestedPlan=qs.get('plan')==='advanced'?'advanced':qs.get('plan')==='basic'?'basic':'';
const loginReturn=requestedPlan?`${location.origin}/provider-login?plan=${requestedPlan}`:`${location.origin}/provider-login`;
const dashboardTarget=requestedPlan?`/dashboard?plan=${requestedPlan}`:'/dashboard';
let mode='signin';
function say(text,kind=''){message.textContent=text;message.dataset.kind=kind;}
document.querySelectorAll('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>{mode=tab.dataset.mode;document.querySelectorAll('.auth-tab').forEach(x=>{const active=x===tab;x.classList.toggle('active',active);x.setAttribute('aria-selected',String(active));});submit.textContent=mode==='signin'?'Sign in':'Create account';password.autocomplete=mode==='signin'?'current-password':'new-password';title.textContent=mode==='signin'?'Welcome back.':'Create your provider account.';lead.textContent=mode==='signin'?'Sign in to manage your directory profile, or create an account to get started.':'Create an account to build and manage your Treasure Valley provider listing.';say('');}));
form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;say(mode==='signin'?'Signing you in…':'Creating your account…');const result=mode==='signin'?await supabase.auth.signInWithPassword({email:email.value.trim(),password:password.value}):await supabase.auth.signUp({email:email.value.trim(),password:password.value,emailRedirectTo:loginReturn});submit.disabled=false;if(result.error){say(result.error.message,'error');return;}if(mode==='signup'&&!result.data.session){say('Check your email to confirm your account, then return here to sign in.','success');return;}say('Signed in. Opening your provider portal…','success');location.href=dashboardTarget;});
const signedOut = new URLSearchParams(location.search).get('signed_out') === '1';
const {data:{session}}=await supabase.auth.getSession();
if (signedOut) { if (session) await supabase.auth.signOut(); say('You have been signed out.','success'); }
else if(session){say('You are already signed in. Opening your provider portal…','success');setTimeout(()=>location.href=dashboardTarget,500);}
