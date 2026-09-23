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
const providerTarget = requestedPlan ? `/dashboard?plan=${requestedPlan}` : '/dashboard';

function say(text, kind = '') {
  message.textContent = text;
  message.dataset.kind = kind;
}

async function destinationForSignedInUser() {
  const { data: isAdmin, error } = await supabase.rpc('tv_is_admin');
  if (error) {
    console.error('Unable to determine account role', error);
    throw new Error('Unable to determine whether this account is an administrator. Please try again.');
  }
  return isAdmin === true ? '/admin' : providerTarget;
}

async function routeSignedInUser(prefix = 'Signed in.') {
  try {
    const destination = await destinationForSignedInUser();
    const admin = destination === '/admin';
    say(`${prefix} Opening your ${admin ? 'administrator dashboard' : 'provider portal'}…`, 'success');
    location.href = destination;
  } catch (error) {
    say(error?.message || 'Unable to open your account.', 'error');
  }
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

  await routeSignedInUser('Signed in.');
});

const signedOut = qs.get('signed_out') === '1';
const { data: { session } } = await supabase.auth.getSession();

if (signedOut) {
  if (session) await supabase.auth.signOut();
  say('You have been signed out.', 'success');
} else if (session) {
  await routeSignedInUser('You are already signed in.');
}
