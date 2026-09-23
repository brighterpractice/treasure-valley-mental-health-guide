import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cfg = window.TV_GUIDE_SUPABASE;
const supabase = createClient(cfg.url, cfg.publishableKey);
const qs = new URLSearchParams(location.search);

let session = null;
let profile = null;
let summary = null;
let publicationStatus = 'draft';
let billingMode = 'one_time';
let cleanSubmitButton = null;
let cleanCheckoutButton = null;
let cleanStartCheckoutButton = null;

function friendlyStatus(status) {
  return ({
    draft: 'Draft',
    submitted: 'Profile saved',
    approved_pending_payment: 'Payment required',
    payment_pending: 'Payment pending',
    paid_pending_review: 'Paid · awaiting review',
    changes_requested: 'Changes requested',
    published: 'Published',
    suspended: 'Suspended',
  })[status] || 'Draft';
}

function requiredProfileComplete(row) {
  return Boolean(
    String(row?.first_name || '').trim() &&
    String(row?.last_name || '').trim() &&
    String(row?.credentials || '').trim() &&
    String(row?.primary_city || '').trim() &&
    String(row?.short_bio || '').trim()
  );
}

function say(id, text, kind = '') {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text;
  node.dataset.kind = kind;
}

function setStatusPill() {
  const pill = document.getElementById('publicationStatus');
  if (pill) pill.textContent = `● ${friendlyStatus(publicationStatus)}`;
}

function replaceButtonWithoutOldListeners(id) {
  const old = document.getElementById(id);
  if (!old) return null;
  const replacement = old.cloneNode(true);
  old.replaceWith(replacement);
  return replacement;
}

function setSubmitState() {
  if (!cleanSubmitButton) return;
  if (publicationStatus === 'changes_requested') {
    cleanSubmitButton.hidden = false;
    cleanSubmitButton.disabled = false;
    cleanSubmitButton.textContent = 'Resubmit for review';
    cleanSubmitButton.title = 'Save your requested changes, then resubmit the paid profile for review.';
  } else {
    cleanSubmitButton.hidden = true;
    cleanSubmitButton.disabled = true;
  }
}

function setPlanAndRenewalLocks() {
  const canChooseBeforePayment = Boolean(summary?.requires_payment);
  document.querySelectorAll('.plan-switch').forEach((button) => {
    button.disabled = !canChooseBeforePayment;
    if (!canChooseBeforePayment) button.title = 'Plan changes after payment require a billing change.';
  });
  document.querySelectorAll('[data-billing-mode]').forEach((button) => {
    button.disabled = !canChooseBeforePayment;
    if (!canChooseBeforePayment) button.title = 'The renewal choice is locked for the current paid period.';
  });
}

function selectedPlan() {
  if (summary?.billing_plan) return summary.billing_plan;
  if (['draft', 'submitted', 'approved_pending_payment', 'payment_pending'].includes(publicationStatus)) {
    return summary?.requested_plan || profile?.requested_plan || 'basic';
  }
  return summary?.publication_plan || profile?.requested_plan || 'basic';
}

function renderCheckoutItem() {
  const plan = selectedPlan() === 'advanced' ? 'advanced' : 'basic';
  const item = document.getElementById('checkoutItem');
  if (item) item.textContent = plan === 'advanced'
    ? 'Advanced Provider Listing — $49/year'
    : 'Basic Provider Listing — $12/year';
  const planName = document.getElementById('billingPlanName');
  if (planName) planName.textContent = plan === 'advanced' ? 'Advanced · $49/year' : 'Basic · $12/year';
}

function renderWorkflow() {
  setStatusPill();
  setSubmitState();
  setPlanAndRenewalLocks();
  renderCheckoutItem();

  const complete = requiredProfileComplete(profile);
  const requiresPayment = Boolean(summary?.requires_payment);
  const billingStatus = summary?.billing_status || '';
  const statusBadge = document.getElementById('billingStatusBadge');
  const intro = document.getElementById('billingIntro');
  const publication = document.getElementById('billingPublicationStatus');
  const metricNote = document.getElementById('planMetricNote');

  if (publication) publication.textContent = friendlyStatus(publicationStatus);

  let badge = 'Not active';
  if (requiresPayment) badge = complete ? 'Payment required' : 'Profile incomplete';
  else if (publicationStatus === 'paid_pending_review') badge = 'Awaiting review';
  else if (publicationStatus === 'changes_requested') badge = 'Changes requested';
  else if (publicationStatus === 'published' && billingStatus === 'active') badge = 'Active';
  else if (billingStatus === 'grace_period') badge = 'Grace period';
  else if (billingStatus === 'past_due') badge = 'Payment issue';
  else if (billingStatus === 'expired') badge = 'Expired';
  else if (billingStatus === 'canceled') badge = 'Canceled';
  if (statusBadge) statusBadge.textContent = badge;
  if (metricNote) metricNote.textContent = badge;

  if (intro) {
    if (requiresPayment && !complete) {
      intro.textContent = 'Save your first name, last name, credentials, primary city, and short bio before payment. Your listing remains private.';
    } else if (requiresPayment) {
      intro.textContent = 'Your profile is saved and private. Complete annual payment when ready; payment sends the profile to the administrator for review before it can appear publicly.';
    } else if (publicationStatus === 'paid_pending_review') {
      intro.textContent = 'Payment received. Your listing is still private while the administrator reviews the profile. No additional action is needed right now.';
    } else if (publicationStatus === 'changes_requested') {
      intro.textContent = 'Your annual payment is active, but changes were requested before publication. Update and save the profile, then resubmit it for review.';
    } else if (publicationStatus === 'published') {
      intro.textContent = 'Your listing is active. Turning off future renewal will not shorten the period you already paid for.';
    } else if (publicationStatus === 'suspended') {
      intro.textContent = 'This listing is suspended. Contact the directory administrator for assistance.';
    }
  }

  if (cleanCheckoutButton) {
    if (requiresPayment && complete) {
      cleanCheckoutButton.disabled = false;
      cleanCheckoutButton.textContent = 'Continue to annual payment';
      cleanCheckoutButton.title = '';
    } else if (requiresPayment) {
      cleanCheckoutButton.disabled = true;
      cleanCheckoutButton.textContent = 'Complete profile before payment';
      cleanCheckoutButton.title = 'Save all required profile fields before payment.';
    } else if (publicationStatus === 'paid_pending_review') {
      cleanCheckoutButton.disabled = true;
      cleanCheckoutButton.textContent = 'Payment received · awaiting review';
    } else if (publicationStatus === 'changes_requested') {
      cleanCheckoutButton.disabled = true;
      cleanCheckoutButton.textContent = 'Changes requested';
    } else if (publicationStatus === 'published') {
      cleanCheckoutButton.disabled = true;
      cleanCheckoutButton.textContent = 'Listing active';
    } else {
      cleanCheckoutButton.disabled = true;
      cleanCheckoutButton.textContent = 'Payment unavailable';
    }
  }

  const flow = document.querySelector('#checkoutDialog .flow-line');
  if (flow) {
    flow.innerHTML = '<span>Square checkout</span><b>→</b><span>Verified payment</span><b>→</b><span>Administrator review</span><b>→</b><span>Publish</span>';
  }

  const checkoutMode = document.getElementById('checkoutBillingMode');
  if (checkoutMode) checkoutMode.textContent = billingMode === 'auto_renew'
    ? 'Automatic annual renewal'
    : 'One year only';

  if (qs.get('checkout') === 'success') {
    if (publicationStatus === 'paid_pending_review') {
      say('billingMessage', 'Payment confirmed. Your profile is now waiting for administrator review and remains private until approved.', 'success');
    } else if (publicationStatus === 'published') {
      say('billingMessage', 'Payment confirmed. Your listing is active.', 'success');
    } else if (summary?.requires_payment) {
      say('billingMessage', 'Square returned you to the portal. Payment confirmation is still being verified. Refresh in a moment if needed.');
    }
  }
}

async function loadState() {
  const { data: auth } = await supabase.auth.getSession();
  session = auth.session;
  if (!session) return;

  const { data: profileData, error: profileError } = await supabase
    .from('provider_profiles')
    .select('*')
    .maybeSingle();
  if (profileError) {
    console.error(profileError);
    return;
  }
  profile = profileData || null;

  if (!profile?.id) {
    publicationStatus = 'draft';
    summary = null;
    renderWorkflow();
    return;
  }

  const { data: billingData, error: billingError } = await supabase.rpc('provider_billing_summary');
  if (billingError) {
    console.error(billingError);
    return;
  }
  summary = Array.isArray(billingData) ? (billingData[0] || null) : billingData;
  publicationStatus = summary?.publication_status || 'draft';
  billingMode = summary?.billing_mode || billingMode || 'one_time';
  renderWorkflow();
}

async function startCheckout() {
  if (!session?.access_token) {
    location.href = '/provider-login';
    return;
  }
  if (!summary?.requires_payment || !requiredProfileComplete(profile)) {
    say('billingMessage', 'Save all required profile fields before payment.', 'error');
    return;
  }

  const dialogMessage = document.getElementById('checkoutDialogMessage');
  const original = cleanStartCheckoutButton?.textContent || 'Continue to Square';
  if (cleanStartCheckoutButton) {
    cleanStartCheckoutButton.disabled = true;
    cleanStartCheckoutButton.textContent = 'Opening secure checkout…';
  }
  if (dialogMessage) {
    dialogMessage.textContent = 'Creating your secure Square checkout…';
    dialogMessage.dataset.kind = '';
  }

  try {
    const response = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ billingMode }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.checkoutUrl) {
      throw new Error(result?.error || 'Unable to start secure checkout.');
    }
    location.assign(result.checkoutUrl);
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Unable to start secure checkout.';
    say('billingMessage', message, 'error');
    if (dialogMessage) {
      dialogMessage.textContent = message;
      dialogMessage.dataset.kind = 'error';
    }
    if (cleanStartCheckoutButton) {
      cleanStartCheckoutButton.disabled = false;
      cleanStartCheckoutButton.textContent = original;
    }
  }
}

async function resubmitPaidProfile() {
  if (!session?.access_token) return;
  cleanSubmitButton.disabled = true;
  cleanSubmitButton.textContent = 'Resubmitting…';
  say('profileMessage', 'Resubmitting your updated profile for review…');

  const { error } = await supabase.rpc('provider_resubmit_paid_profile');
  if (error) {
    say('profileMessage', error.message, 'error');
    cleanSubmitButton.disabled = false;
    cleanSubmitButton.textContent = 'Resubmit for review';
    return;
  }

  try {
    await fetch('/api/admin/review-alert', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (error) {
    console.error('Profile resubmitted; review email request failed', error);
  }

  say('profileMessage', 'Profile resubmitted. It is private while the administrator reviews the changes.', 'success');
  await loadState();
}

function wireControls() {
  cleanSubmitButton = replaceButtonWithoutOldListeners('submitProfile');
  cleanCheckoutButton = replaceButtonWithoutOldListeners('checkoutDemo');
  cleanStartCheckoutButton = replaceButtonWithoutOldListeners('startSquareCheckout');

  if (cleanSubmitButton) cleanSubmitButton.addEventListener('click', resubmitPaidProfile);
  if (cleanCheckoutButton) {
    cleanCheckoutButton.addEventListener('click', () => {
      if (!summary?.requires_payment || !requiredProfileComplete(profile)) {
        say('billingMessage', 'Save all required profile fields before payment.', 'error');
        return;
      }
      const dialogMessage = document.getElementById('checkoutDialogMessage');
      if (dialogMessage) {
        dialogMessage.textContent = '';
        dialogMessage.dataset.kind = '';
      }
      document.getElementById('checkoutDialog')?.showModal();
    });
  }
  if (cleanStartCheckoutButton) cleanStartCheckoutButton.addEventListener('click', startCheckout);

  document.querySelectorAll('[data-billing-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      billingMode = button.dataset.billingMode === 'auto_renew' ? 'auto_renew' : 'one_time';
      document.querySelectorAll('[data-billing-mode]').forEach((item) => item.classList.toggle('selected', item === button));
      const mode = document.getElementById('checkoutBillingMode');
      if (mode) mode.textContent = billingMode === 'auto_renew' ? 'Automatic annual renewal' : 'One year only';
    });
  });

  document.getElementById('saveProfile')?.addEventListener('click', () => {
    setTimeout(loadState, 900);
  });
  document.querySelectorAll('.plan-switch').forEach((button) => {
    button.addEventListener('click', () => setTimeout(loadState, 500));
  });
}

async function init() {
  wireControls();
  await loadState();
  // One delayed refresh catches any final state updates from the original portal module.
  setTimeout(loadState, 700);
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init, { once: true });
