function enhanceProviderProfileFields() {
  const populationChips = document.querySelector('.profile-chips[data-field="populations"]');
  if (populationChips && !populationChips.querySelector('[data-value="LGBTQIA+"]')) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.dataset.value = 'LGBTQIA+';
    chip.textContent = 'LGBTQIA+';
    populationChips.append(chip);
  }

  const improvements = [
    {
      inputId: 'customPopulationInput',
      placeholder: 'Type another population or community',
      help: 'Choose common populations above, or add another population/community if it is not listed.'
    },
    {
      inputId: 'customInsuranceInput',
      placeholder: 'Type another insurance carrier or payment option',
      help: 'Choose common carriers above, or type another carrier/payment option. You can also add exact contracted plan names below.'
    },
    {
      inputId: 'customApproachInput',
      placeholder: 'Type another therapy approach or modality',
      help: 'Choose common approaches above, or add any therapy approach/modality that is not listed.'
    }
  ];

  for (const item of improvements) {
    const input = document.getElementById(item.inputId);
    if (!input) continue;
    input.placeholder = item.placeholder;
    const block = input.closest('.edit-block');
    if (!block) continue;
    let label = input.closest('.custom-option-row')?.previousElementSibling;
    if (!label || !label.classList?.contains('custom-entry-label')) {
      label = document.createElement('p');
      label.className = 'field-help custom-entry-label';
      label.style.marginTop = '12px';
      input.closest('.custom-option-row')?.insertAdjacentElement('beforebegin', label);
    }
    label.textContent = item.help;
  }

  const office = document.getElementById('officeAddress');
  if (office) {
    office.placeholder = 'Street address, ZIP code, or city';
    const label = office.closest('label');
    if (label) {
      for (const node of [...label.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().startsWith('Office address')) {
          node.textContent = 'Practice location for distance search ';
          break;
        }
      }
      const smallInline = [...label.querySelectorAll('small')].find(el => !el.classList.contains('field-help'));
      if (smallInline) smallInline.textContent = '(street address, ZIP code, or city)';
      const help = label.querySelector('.field-help');
      if (help) {
        help.textContent = 'Use a full street address for the most accurate distance search, a ZIP code for approximate area matching, or a city for broad matching. The public profile shows your primary city, not the location text entered here.';
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceProviderProfileFields, { once: true });
} else {
  enhanceProviderProfileFields();
}
