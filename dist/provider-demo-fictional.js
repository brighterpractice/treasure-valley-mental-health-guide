function applyFictionalProviderPreview() {
  const card = document.querySelector('.provider-preview-card');
  if (!card) return;

  const avatar = card.querySelector('.avatar-xl');
  const heading = card.querySelector('h3');
  const practice = card.querySelector('h3 + p');
  const tags = card.querySelector('.preview-tags');
  const stats = card.querySelectorAll('.mini-stats > div');
  const note = card.querySelector('small');

  if (avatar) avatar.textContent = 'JM';
  if (heading) heading.textContent = 'Jordan Miller, LPC';
  if (practice) practice.textContent = 'Summit Path Counseling · Boise';

  if (tags) {
    tags.innerHTML = '<span>Stress</span><span>Relationships</span><span>Depression</span><span>Adults</span>';
  }

  const examples = [
    ['112', 'Profile views'],
    ['23', 'Website clicks'],
    ['11', 'Contact clicks'],
  ];

  stats.forEach((item, index) => {
    const data = examples[index];
    if (!data) return;
    const value = item.querySelector('strong');
    const label = item.querySelector('span');
    if (value) value.textContent = data[0];
    if (label) label.textContent = data[1];
  });

  if (note) {
    note.textContent = 'Fictional example showing the analytics available with an Advanced profile.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyFictionalProviderPreview, { once: true });
} else {
  applyFictionalProviderPreview();
}
