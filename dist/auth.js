import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = createClient(cfg.url, cfg.publishableKey);

const form = document.getElementById('authForm');
const message = document.getElementById('authMessage');
const submit = form.querySelector('.auth-submit');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');

const qs = new URLSearchParams(location.search);
const requestedPlan = qs.get('plan') === 'advanced' ? 'advanced' : qs.get('plan') === 'basic' ? 'basic' : '';
const loginReturn = requestedPlan ? `${location.origin}/provider-login?plan=${requestedPlan}` : `${location.origin}/provider-login`;
const dashboardTarget = requestedPlan ? `/dashboard?plan=${requestedPlan}` : '/dashboard';

function say(text, kind = '') {
  message.textContent = text;
  message.dataset.kind = kind;
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const mode = form.dataset.mode === 'signup' ? 'signup' : 'signin';

  if (mode === 'signup' && password.value !== confirmPassword.value) {
    say('Passwords do not match. Please re-enter them.', 'error');
    confirmPassword.focus();
    return;
  }

  submit.disabled = true;
  say(mode === 'signin' ? 'Signing you in…' : 'Creating your account…');

  const result = mode === 'signin'
    ? await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value
      })
    : await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: { emailRedirectTo: loginReturn }
      });

  submit.disabled = false;

  if (result.error) {
    say(result.error.message, 'error');
    return;
  }

  if (mode === 'signup' && !result.data.session) {
    say('Check your email to confirm your account, then return here to sign in.', 'success');
    return;
  }

  say('Signed in. Opening your provider portal…', 'success');
  location.href = dashboardTarget;
});

const signedOut = qs.get('signed_out') === '1';
const { data: { session } } = await supabase.auth.getSession();

if (signedOut) {
  if (session) await supabase.auth.signOut();
  say('You have been signed out.', 'success');
} else if (session) {
  say('You are already signed in. Opening your provider portal…', 'success');
  setTimeout(() => location.href = dashboardTarget, 500);
}
