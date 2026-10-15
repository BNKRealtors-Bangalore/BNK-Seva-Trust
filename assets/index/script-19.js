(() => {
  const section = document.getElementById('seva-partner');
  if (!section) return;
  const options = [...section.querySelectorAll('.bnk-partner-choice')];
  const customWrap = section.querySelector('#bnkPartnerCustomWrap');
  const customInput = section.querySelector('#bnkPartnerCustomAmount');
  const button = section.querySelector('#bnkPartnerJoin');
  const status = section.querySelector('#bnkPartnerStatus');
  const modal = document.getElementById('sevaPartnerModal');
  const partnerForm = document.getElementById('sevaPartnerForm');
  const closePartnerForm = document.getElementById('closeSevaPartnerForm');
  const partnerAmountInput = document.getElementById('sevaPartnerFormAmount');
  const partnerFormStatus = document.getElementById('sevaPartnerFormStatus');
  let selected = '501';
  let lastFocused = null;
  const formatPartnerAmount = (amount) => '₹' + Number(amount).toLocaleString('en-IN');

  async function loadPartnerPricing() {
    try {
      const response = await fetch('/api/pricing-config', { cache: 'no-store' });
      if (!response.ok) return;
      const config = await response.json();
      if (!Array.isArray(config.sevaPartnerAmounts)) return;
      const amounts = config.sevaPartnerAmounts.filter((amount) => Number.isSafeInteger(Number(amount)) && Number(amount) > 0);
      options.filter((option) => option.dataset.monthly !== 'custom').forEach((option, index) => {
        const amount = amounts[index];
        if (!amount) return;
        option.dataset.monthly = String(amount);
        option.querySelector('strong').textContent = formatPartnerAmount(amount);
      });
      const active = options.find((option) => option.classList.contains('is-active') && option.dataset.monthly !== 'custom');
      if (active) selected = active.dataset.monthly;
    } catch {
      // Keep built-in defaults if admin pricing cannot load.
    }
  }

  options.forEach(option => option.addEventListener('click', () => {
    selected = option.dataset.monthly;
    for (const choice of options) {
      const active = choice === option;
      choice.classList.toggle('is-active', active);
      choice.setAttribute('aria-pressed', String(active));
    }
    customWrap.hidden = selected !== 'custom';
    status.hidden = true;
    if (selected === 'custom') customInput.focus();
  }));

  const closeModal = () => {
    modal.hidden = true;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    lastFocused?.focus?.();
  };

  button.addEventListener('click', () => {
    const amount = selected === 'custom' ? Number(customInput.value) : Number(selected);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      customInput.setCustomValidity('Please enter a whole rupee amount of at least ₹1.');
      customInput.reportValidity();
      customInput.focus();
      return;
    }
    customInput.setCustomValidity('');
    partnerAmountInput.value = String(amount);
    partnerFormStatus.hidden = true;
    partnerFormStatus.textContent = '';
    lastFocused = document.activeElement;
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    partnerForm.querySelector('input')?.focus();
    status.hidden = true;
  });
  closePartnerForm?.addEventListener('click', closeModal);
  modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  partnerForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!partnerForm.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(partnerForm).entries());
    payload.amount = Number(payload.amount);
    const submit = partnerForm.querySelector('.csr-form-submit');
    submit.disabled = true;
    submit.textContent = 'Submitting...';
    try {
      const endpoint = '/api/public-submissions/partner';
      const response = await fetch(window.location.protocol === 'file:' ? `http://127.0.0.1:3000${endpoint}` : endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not submit partner details.');
      const paymentDetails = {
        category: 'Seva Partner',
        amount: payload.amount,
        sevaName: `Monthly Seva Partner contribution (${formatPartnerAmount(payload.amount)})`
      };
      partnerForm.reset();
      partnerFormStatus.textContent = 'Thank you. Your Seva Partner details have been received.';
      partnerFormStatus.hidden = false;
      closeModal();
      document.dispatchEvent(new CustomEvent('bnk:donation-selected', { detail: paymentDetails }));
    } catch (error) {
      partnerFormStatus.textContent = error.message;
      partnerFormStatus.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Submit Details';
    }
  });
  customInput.addEventListener('input', () => { customInput.setCustomValidity(''); status.hidden = true; });
  loadPartnerPricing();
})();
