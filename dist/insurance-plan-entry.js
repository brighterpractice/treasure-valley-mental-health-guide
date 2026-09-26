function addInsurancePlanBuilder() {
  const chips = document.querySelector('.profile-chips[data-field="insurance"]');
  if (!chips) return;
  const block = chips.closest('.edit-block');
  if (!block || block.querySelector('#insurancePlanBuilder')) return;

  const help = block.querySelector('.field-help');
  if (help) {
    help.textContent = 'Select the insurance carriers or payment options you currently accept. For specific contracted plans, add the exact plan or network name below.';
  }

  const carriers = [...chips.querySelectorAll('.filter-chip')]
    .map(chip => chip.dataset.value)
    .filter(Boolean)
    .filter(value => value !== 'Self-pay');

  const wrapper = document.createElement('div');
  wrapper.id = 'insurancePlanBuilder';
  wrapper.className = 'custom-option-row';
  wrapper.style.alignItems = 'end';
  wrapper.innerHTML = `
    <label style="flex:1;min-width:180px">Carrier
      <select id="insurancePlanCarrier" class="input">
        <option value="">Choose carrier</option>
        ${carriers.map(value => `<option value="${value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">${value.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}
      </select>
    </label>
    <label style="flex:2;min-width:240px">Specific plan / network
      <input id="insurancePlanName" class="input" placeholder="Enter the exact plan or network name">
    </label>
    <button type="button" class="button secondary small-btn" id="addInsurancePlan">Add plan</button>
  `;

  const customRow = block.querySelector('.custom-option-row');
  block.insertBefore(wrapper, customRow || chips.nextSibling);

  const note = document.createElement('p');
  note.className = 'field-help';
  note.textContent = 'Only list plans for which you are currently contracted/in-network. Specific plans are saved as “Carrier — Plan” so clients can filter by the exact plan name. Network participation can change, so keep this section current.';
  wrapper.insertAdjacentElement('afterend', note);

  const customInput = document.getElementById('customInsuranceInput');
  if (customInput) customInput.placeholder = 'Add another carrier or payment option';

  const list = document.getElementById('customInsurance');
  const carrier = document.getElementById('insurancePlanCarrier');
  const plan = document.getElementById('insurancePlanName');
  const button = document.getElementById('addInsurancePlan');

  function existingValues() {
    return [...(list?.querySelectorAll('.custom-tag') || [])].map(tag => String(tag.dataset.value || '').toLowerCase());
  }

  function addPlan() {
    const carrierName = String(carrier?.value || '').trim();
    const planName = String(plan?.value || '').trim().replace(/\s+/g, ' ');
    if (!carrierName) {
      carrier?.focus();
      return;
    }
    if (!planName) {
      plan?.focus();
      return;
    }
    const value = `${carrierName} — ${planName}`;
    if (existingValues().includes(value.toLowerCase())) {
      plan.value = '';
      plan.focus();
      return;
    }

    const tag = document.createElement('span');
    tag.className = 'custom-tag';
    tag.dataset.value = value;
    tag.append(document.createTextNode(value));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${value}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => tag.remove());
    tag.append(remove);
    list?.append(tag);
    plan.value = '';
    plan.focus();
  }

  button?.addEventListener('click', addPlan);
  plan?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addPlan();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addInsurancePlanBuilder, { once: true });
} else {
  addInsurancePlanBuilder();
}
