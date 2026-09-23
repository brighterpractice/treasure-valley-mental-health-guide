function updateProviderWorkflowCopy() {
  if (!document.getElementById('panel-billing')) return;

  const profileMessage = document.getElementById('profileMessage');
  if (profileMessage && /submit.*review/i.test(profileMessage.textContent || '')) {
    profileMessage.textContent = 'Save your profile as often as you need. When you are ready, go to Plan & Billing to complete payment. Payment sends the profile to the administrator for review before it can appear publicly.';
    profileMessage.dataset.kind = '';
  }

  const dialogCopy = document.querySelector('#checkoutDialog h2 + p');
  if (dialogCopy) {
    dialogCopy.textContent = 'Square hosts checkout, so the directory never stores card numbers. After payment, your profile stays private while the directory administrator reviews it. Automatic renewal is optional and is never preselected.';
  }

  const flow = document.querySelector('#checkoutDialog .flow-line');
  if (flow) {
    flow.innerHTML = '<span>Square checkout</span><b>→</b><span>Verified payment</span><b>→</b><span>Administrator review</span><b>→</b><span>Publish</span>';
  }
}

if (document.readyState === 'complete') updateProviderWorkflowCopy();
else window.addEventListener('load', updateProviderWorkflowCopy, { once: true });
