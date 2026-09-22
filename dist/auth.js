import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = createClient(cfg.url, cfg.publishableKey);

const form = document.getElementById('authForm');
const message = document.getElementById('authMessage');
const submit = form.querySelector('.auth-submit');
const email = document.getElementById('email');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');
const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
const title = document.getElementById('authTitle');
const lead = document.querySelector('.auth-lead');
const tabs = [...document.querySelectorAll('.auth-tab')];

const qs = new URLSearchParams(location.search);
const requestedPlan = qs.get('plan') === 'advanced' ? 'advanced' : qs.get('plan') === 'basic' ? 'basic' : '';
const loginReturn = requestedPlan ? `${location.origin}/provider-login?plan=${requestedPlan}` : `${location.origin}/provider-login`;
const dashboardTarget = requestedPlan ? `/dashboard?plan=${requestedPlan}` : '/dashboard';

let mode = 'signin';

function say(text, kind = '') {
  message.textContent = text;
  message.dataset.kind = kind;
}

function setPasswordVisibility(input, button, visible) {
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
}

document.querySelectorAll('[data-password-target]').forEach(button => {
  const input = document.getElementById(button.dataset.passwordTarget);
  if (!input) return;

  button.addEventListener('click', () => {
    setPasswordVisibility(input, button, input.type === 'password');
    input.focus({ preventScroll: true });
  });
});

function setMode(nextMode) {
  mode = nextMode === 'signup' ? 'signup' : 'signin';
  const signingUp = mode === 'signup';

  tabs.forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  submit.textContent = signingUp ? 'Create account' : 'Sign in';
  password.autocomplete = signingUp ? 'new-password' : 'current-password';
  confirmPasswordGroup.hidden = !signingUp;
  confirmPassword.required = signingUp;

  if (!signingUp) {
    confirmPassword.value = '';
    const confirmToggle = document.querySelector('[data-password-target="confirmPassword"]');
    if (confirmToggle) setPasswordVisibility(confirmPassword, confirmToggle, false);
  }

  title.textContent = signingUp ? 'Create your provider account.' : 'Welcome back.';
  lead.textContent = signingUp
    ? 'Create an account to build and manage your Treasure Valley provider listing.'
    : 'Sign in to manage your directory profile, or create an account to get started.';

  say('');
}

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
setMode('signin');

form.addEventListener('submit', async event => {
  event.preventDefault();

  if (mode === 'signup' && password.value !== confirmPassword.value) {
    say('Passwords do not match. Re-enter both passwords and try again.', 'error');
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

const signedOut = new URLSearchParams(location.search).get('signed_out') === '1';
const { data: { session } } = await supabase.auth.getSession();

if (signedOut) {
  if (session) await supabase.auth.signOut();
  say('You have been signed out.', 'success');
} else if (session) {
  say('You are already signed in. Opening your provider portal…', 'success');
  setTimeout(() => location.href = dashboardTarget, 500);
}
