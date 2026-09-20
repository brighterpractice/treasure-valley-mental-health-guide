import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

const cfg = window.TV_GUIDE_SUPABASE;
const profile = window.TV_PROVIDER_PAGE;
const supabase = cfg?.url && cfg?.publishableKey ? createClient(cfg.url, cfg.publishableKey) : null;

function visitorKey() {
  const keyName = 'tvmh_anonymous_visitor';
  let value = localStorage.getItem(keyName);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(keyName, value);
  }
  return value;
}

async function record(eventKind) {
  if (!supabase || !profile?.id) return;
  try {
    await supabase.rpc('record_provider_event', {
      target_provider_id: profile.id,
      event_kind: eventKind,
      anonymous_visitor_key: visitorKey(),
      specialty_values: [],
      approach_values: [],
      city_value: '',
      visit_value: '',
      insurance_value: '',
      source_value: 'provider_slug_profile'
    });
  } catch (error) {
    console.error('Analytics event could not be recorded', error);
  }
}

document.querySelectorAll('[data-provider-event]').forEach(link => {
  link.addEventListener('click', () => record(link.dataset.providerEvent));
});

async function renderQr(id, url) {
  const canvas = document.getElementById(id);
  if (!canvas || !url) return;
  try {
    await QRCode.toCanvas(canvas, url, { width: 190, margin: 2, errorCorrectionLevel: 'M' });
  } catch (error) {
    console.error('Unable to render QR code', error);
  }
}

if (profile?.showWebsiteQr && profile.websiteUrl) renderQr('publicWebsiteQr', profile.websiteUrl);
if (profile?.showPortalQr && profile.portalUrl) renderQr('publicPortalQr', profile.portalUrl);
record('profile_view');
