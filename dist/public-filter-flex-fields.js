function uniqueSorted(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function setLocationCopy() {
  const address = document.getElementById('addressFilter');
  const apply = document.getElementById('applyAddressFilter');
  const group = address?.closest('.distance-search');
  const label = group?.querySelector(':scope > .field-label');
  const status = document.getElementById('addressStatus');

  if (label) label.innerHTML = 'Starting location <small>street address, ZIP code, or city</small>';
  if (address) address.placeholder = 'Street address, ZIP code, or city';
  if (apply) apply.textContent = 'Use location';
  if (status && !status.dataset.flexLocationCopy) {
    status.textContent = 'Your typed location is used only for this search and is not shown to providers.';
    status.dataset.flexLocationCopy = 'true';
  }

  const privacy = document.querySelector('.privacy-note');
  if (privacy) {
    privacy.innerHTML = '<b>Privacy-minded search.</b> Location-based distance is calculated for this search only. Your typed location and individual sensitive searches are not exposed to providers.';
  }

  const resourceNote = document.querySelector('.resource-note p');
  if (resourceNote && /starting address/i.test(resourceNote.textContent || '')) {
    resourceNote.textContent = 'Your starting location is used to look up coordinates for distance filtering. The guide does not include your typed location in provider analytics or show it to providers.';
  }
}

function addLgbtqiaOption() {
  const select = document.getElementById('populationFilter');
  if (!select || [...select.options].some(option => option.value === 'LGBTQIA+')) return;
  const option = document.createElement('option');
  option.value = 'LGBTQIA+';
  option.textContent = 'LGBTQIA+';
  select.append(option);
}

function addFlexibleFilter({ selectId, inputId, listId, label, placeholder }) {
  const select = document.getElementById(selectId);
  if (!select || document.getElementById(inputId)) return null;

  const selectLabel = select.closest('label');
  if (!selectLabel) return null;

  const wrapper = document.createElement('label');
  wrapper.className = 'flex-filter-entry';
  wrapper.style.display = 'block';
  wrapper.style.marginTop = '8px';
  wrapper.innerHTML = `
    <span class="field-label">${label}</span>
    <input id="${inputId}" class="input" type="search" list="${listId}" autocomplete="off" placeholder="${placeholder}">
    <datalist id="${listId}"></datalist>
  `;
  selectLabel.insertAdjacentElement('afterend', wrapper);

  const input = document.getElementById(inputId);
  const datalist = document.getElementById(listId);
  let knownValues = uniqueSorted([...select.options].map(option => option.value).filter(Boolean));
  let syncing = false;
  let timer = null;

  function refreshList(values = knownValues) {
    knownValues = uniqueSorted(values);
    datalist.innerHTML = '';
    for (const value of knownValues) {
      const option = document.createElement('option');
      option.value = value;
      datalist.append(option);
    }
  }

  function applyTypedValue() {
    const raw = input.value.trim();
    syncing = true;
    if (!raw) {
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncing = false;
      return;
    }

    const lowered = raw.toLowerCase();
    const exact = knownValues.find(value => value.toLowerCase() === lowered);
    const partial = knownValues.filter(value => value.toLowerCase().includes(lowered));
    const resolved = exact || (partial.length === 1 ? partial[0] : raw);

    if (![...select.options].some(option => option.value === resolved)) {
      const option = document.createElement('option');
      option.value = resolved;
      option.textContent = resolved;
      option.dataset.typedOption = 'true';
      select.append(option);
    }
    select.value = resolved;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncing = false;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(applyTypedValue, 220);
  });
  input.addEventListener('change', applyTypedValue);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(timer);
      applyTypedValue();
    }
  });

  select.addEventListener('change', () => {
    if (!syncing && input.value && select.value !== input.value) input.value = '';
  });

  refreshList();
  return {
    input,
    addValues(values = []) {
      refreshList([...knownValues, ...values]);
    }
  };
}

async function loadProviderReportedValues(insuranceControl, approachControl) {
  const cfg = window.TV_GUIDE_SUPABASE;
  if (!cfg?.url || !cfg?.publishableKey) return;

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.4');
    const client = createClient(cfg.url, cfg.publishableKey);
    const { data, error } = await client.rpc('list_directory_profiles_v2', {
      page_size: 200,
      page_offset: 0
    });
    if (error) throw error;

    const insurance = [];
    const approaches = [];
    for (const row of data || []) {
      if (Array.isArray(row.insurance)) insurance.push(...row.insurance);
      if (Array.isArray(row.approaches)) approaches.push(...row.approaches);
    }
    insuranceControl?.addValues(insurance);
    approachControl?.addValues(approaches);
  } catch (error) {
    console.warn('Could not load provider-reported filter values', error);
  }
}

function initFlexiblePublicFilters() {
  setLocationCopy();
  addLgbtqiaOption();

  const insuranceControl = addFlexibleFilter({
    selectId: 'insuranceFilter',
    inputId: 'customInsuranceFilter',
    listId: 'customInsuranceOptions',
    label: 'Other insurance carrier or plan',
    placeholder: 'Type a carrier or plan'
  });

  const approachControl = addFlexibleFilter({
    selectId: 'approachFilter',
    inputId: 'customApproachFilter',
    listId: 'customApproachOptions',
    label: 'Other therapy approach',
    placeholder: 'Type an approach or modality'
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    setTimeout(() => {
      if (insuranceControl?.input) insuranceControl.input.value = '';
      if (approachControl?.input) approachControl.input.value = '';
      setLocationCopy();
    }, 0);
  });

  loadProviderReportedValues(insuranceControl, approachControl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlexiblePublicFilters, { once: true });
} else {
  initFlexiblePublicFilters();
}
