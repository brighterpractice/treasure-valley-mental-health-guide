import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const separator = ' — ';
const cfg = window.TV_GUIDE_SUPABASE;
const select = document.getElementById('insuranceFilter');

function addVerificationNote() {
  if (!select) return;
  const label = select.closest('label');
  const fieldLabel = label?.querySelector('.field-label');
  if (fieldLabel) fieldLabel.textContent = 'Insurance carrier or plan';
  if (label?.querySelector('.insurance-verification-note')) return;
  const note = document.createElement('small');
  note.className = 'field-help insurance-verification-note';
  note.textContent = 'Insurance participation is provider-reported and can change. Confirm network status and benefits with the clinician and your insurer before scheduling.';
  label?.append(note);
}

function addPlanOptions(values) {
  if (!select) return;
  const existing = new Set([...select.options].map(option => option.value.toLowerCase()));
  const specificPlans = [...new Set(values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => value.includes(separator)))]
    .filter(value => !existing.has(value.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  select.querySelector('optgroup[data-insurance-plans]')?.remove();
  if (!specificPlans.length) return;

  const group = document.createElement('optgroup');
  group.label = 'Specific plans reported by providers';
  group.dataset.insurancePlans = 'true';
  for (const value of specificPlans) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    group.append(option);
  }
  select.append(group);
}

async function loadInsurancePlans() {
  if (!select) return;
  addVerificationNote();
  if (!cfg?.url || !cfg?.publishableKey) return;

  const supabase = createClient(cfg.url, cfg.publishableKey);
  const { data, error } = await supabase.rpc('list_directory_profiles_v2', {
    page_size: 200,
    page_offset: 0,
  });
  if (error) {
    console.warn('Insurance plan options could not be loaded', error);
    return;
  }

  const values = [];
  for (const row of data || []) {
    if (Array.isArray(row.insurance)) values.push(...row.insurance);
  }
  addPlanOptions(values);
}

loadInsurancePlans();
