(() => {
  const dialog = document.createElement("div");
  dialog.className = "bnk-donation-dialog";
  dialog.id = "bnkDonationDialog";
  dialog.hidden = true;
  dialog.innerHTML = `
    <section class="bnk-donation-panel" role="dialog" aria-modal="true" aria-labelledby="bnkDonationTitle">
      <button class="bnk-donation-close" type="button" aria-label="Close donation form">×</button>
      <div class="bnk-donation-form-view">
        <p class="bnk-donation-eyebrow">BNK Seva Trust</p>
        <h2 class="bnk-donation-title" id="bnkDonationTitle">Make a donation</h2>
        <p class="bnk-donation-intro">Share your details for the Trust's donation record and acknowledgement.</p>
        <form id="bnkDonationForm">
          <div class="bnk-donation-grid">
            <label class="bnk-donation-field">
              Donor name
              <input name="donorName" autocomplete="name" maxlength="120" required />
            </label>
            <label class="bnk-donation-field">
              Mobile
              <input name="mobile" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required />
            </label>
            <label class="bnk-donation-field bnk-donation-field-full">
              Email
              <input name="email" type="email" autocomplete="email" maxlength="254" required />
            </label>
            <label class="bnk-donation-field">
              Donation category
              <select name="donationCategory" required>
                <option value="Temple Project">Temple Project</option>
                <option value="Seva">Seva</option>
                <option value="Sponsorship">Sponsorship</option>
                <option value="General Donation">General Donation</option>
              </select>
            </label>
            <label class="bnk-donation-field">
              Amount (INR)
              <input name="amount" type="number" min="1" max="10000000" step="1" inputmode="numeric" required />
            </label>
            <label class="bnk-donation-field">
              Payment method
              <select name="paymentMethod" required>
                <option value="auto">Choose in secure checkout</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Net Banking</option>
                <option value="other">Other supported methods</option>
              </select>
            </label>
            <label class="bnk-donation-field bnk-donation-field-full">
              Donation purpose
              <textarea name="purpose" maxlength="500" required></textarea>
            </label>
            <label class="bnk-donation-field bnk-donation-field-full">
              Name display preference
              <select name="visibility" required>
                <option value="anonymous">Keep my donation anonymous</option>
                <option value="public">Show my name publicly</option>
              </select>
              <span class="bnk-donation-help">Your name and contact details required for payment records and the receipt.</span>
            </label>
          </div>
          <p class="bnk-donation-status" role="status" aria-live="polite"></p>
          <div class="bnk-donation-actions">
            <button class="bnk-donation-submit" type="submit">Continue to secure payment</button>
          </div>
        </form>
        <p class="bnk-donation-legal"></p>
      </div>
      <section class="bnk-donation-receipt" hidden aria-labelledby="bnkReceiptTitle">
        <p class="bnk-donation-eyebrow">BNK Seva Trust · Payment confirmed</p>
        <h2 class="bnk-receipt-heading" id="bnkReceiptTitle">Your Seva has been received.</h2>
        <p class="bnk-receipt-thanks">Thank you for becoming a part of this sacred journey.</p>
        <table class="bnk-receipt-table"><tbody></tbody></table>
        <article class="bnk-certificate" aria-labelledby="bnkCertificateTitle">
          <div class="bnk-certificate-border">
            <p class="bnk-certificate-kicker">BNK Seva Trust</p>
            <h3 id="bnkCertificateTitle">Certificate of Seva</h3>
            <p class="bnk-certificate-text">This certificate is presented to</p>
            <strong class="bnk-certificate-name" data-certificate-name></strong>
            <p class="bnk-certificate-text">
              with gratitude for a heartfelt contribution of
              <span data-certificate-amount></span>
              towards <span data-certificate-purpose></span>.
            </p>
            <div class="bnk-certificate-meta">
              <span>Receipt: <b data-certificate-receipt></b></span>
              <span>Date: <b data-certificate-date></b></span>
            </div>
            <p class="bnk-certificate-blessing">Love everyone. Serve everyone. Remember God.</p>
          </div>
        </article>
        <p class="bnk-donation-legal"></p>
        <div class="bnk-donation-actions">
          <button class="bnk-certificate-download" type="button">Download certificate</button>
          <button class="bnk-donation-print" type="button">Print / Save receipt</button>
        </div>
      </section>
    </section>
  `;
  document.body.append(dialog);

  const form = dialog.querySelector("#bnkDonationForm");
  const formView = dialog.querySelector(".bnk-donation-form-view");
  const receiptView = dialog.querySelector(".bnk-donation-receipt");
  const status = dialog.querySelector(".bnk-donation-status");
  const legalNotes = dialog.querySelectorAll(".bnk-donation-legal");
  const closeButton = dialog.querySelector(".bnk-donation-close");
  const submitButton = dialog.querySelector(".bnk-donation-submit");
  let paymentConfig;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));

  const fetchJSON = async (url, options) => {
    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 202) {
      throw new Error(result.error || "The donation service could not complete this request.");
    }
    return { response, result };
  };

  const loadPaymentConfig = async () => {
    if (!paymentConfig) {
      const { result } = await fetchJSON("/api/payment-config");
      paymentConfig = result;
      legalNotes.forEach((note) => {
        note.textContent = result.receiptPolicyNote || "A statutory or tax-exemption certificate is issued only where applicable under Trust policy and law.";
      });
    }
    if (!paymentConfig.configured) {
      throw new Error("Online donations are not configured yet. Please contact BNK Seva Trust.");
    }
    return paymentConfig;
  };

  const loadRazorpay = async () => {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Secure payment checkout could not be loaded. Please try again."));
      document.head.append(script);
    });
  };

  const setField = (name, value) => {
    if (value === undefined || value === null || value === "") return;
    const field = form.elements.namedItem(name);
    if (field) field.value = String(value);
  };

  const openDialog = (details = {}) => {
    form.reset();
    formView.hidden = false;
    receiptView.hidden = true;
    setStatus("");
    setField("donationCategory", details.category);
    setField("amount", details.amount);
    const purpose = form.elements.namedItem("purpose");
    purpose.value = details.sevaName || details.name || "Donation to BNK Seva Trust";
    dialog.hidden = false;
    document.body.style.overflow = "hidden";
    loadPaymentConfig().catch((error) => setStatus(error.message));
    window.setTimeout(() => form.elements.namedItem("donorName").focus(), 0);
  };

  const closeDialog = () => {
    dialog.hidden = true;
    document.body.style.overflow = "";
  };

  const formatDate = (value) => new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));

  const formatCertificateDate = (value) => new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));

  const formatAmount = (amount) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);

  const certificateState = { receipt: null };

  const updateCertificate = (receipt) => {
    certificateState.receipt = receipt;
    dialog.querySelector("[data-certificate-name]").textContent = receipt.anonymous ? "Anonymous Sevak" : receipt.donorName;
    dialog.querySelector("[data-certificate-amount]").textContent = formatAmount(receipt.amount);
    dialog.querySelector("[data-certificate-purpose]").textContent = receipt.purpose;
    dialog.querySelector("[data-certificate-receipt]").textContent = receipt.receiptNumber;
    dialog.querySelector("[data-certificate-date]").textContent = formatCertificateDate(receipt.date);
  };

  const certificateSVG = (receipt) => {
    const donorName = receipt.anonymous ? "Anonymous Sevak" : receipt.donorName;
    const amount = formatAmount(receipt.amount);
    const date = formatCertificateDate(receipt.date);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100">
  <defs>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#fffaf0"/>
      <stop offset="0.55" stop-color="#f8e8c7"/>
      <stop offset="1" stop-color="#fff4d8"/>
    </linearGradient>
    <linearGradient id="maroon" x1="0" x2="1">
      <stop offset="0" stop-color="#8b1026"/>
      <stop offset="1" stop-color="#b3132f"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1100" fill="url(#paper)"/>
  <rect x="70" y="70" width="1460" height="960" rx="22" fill="none" stroke="#c48a32" stroke-width="7"/>
  <rect x="98" y="98" width="1404" height="904" rx="18" fill="none" stroke="#d8ad65" stroke-width="2"/>
  <text x="800" y="205" text-anchor="middle" fill="#b77a2f" font-family="Arial, sans-serif" font-size="34" letter-spacing="12">BNK SEVA TRUST</text>
  <text x="800" y="330" text-anchor="middle" fill="url(#maroon)" font-family="Georgia, serif" font-size="96" font-weight="600">Certificate of Seva</text>
  <text x="800" y="430" text-anchor="middle" fill="#5e4b40" font-family="Georgia, serif" font-size="34" font-style="italic">This certificate is presented to</text>
  <text x="800" y="535" text-anchor="middle" fill="#800b23" font-family="Georgia, serif" font-size="72" font-weight="600">${escapeHTML(donorName)}</text>
  <text x="800" y="635" text-anchor="middle" fill="#5e4b40" font-family="Georgia, serif" font-size="34">with gratitude for a heartfelt contribution of</text>
  <text x="800" y="710" text-anchor="middle" fill="#800b23" font-family="Georgia, serif" font-size="52" font-weight="600">${escapeHTML(amount)}</text>
  <text x="800" y="780" text-anchor="middle" fill="#5e4b40" font-family="Georgia, serif" font-size="32">towards ${escapeHTML(receipt.purpose)}</text>
  <text x="260" y="910" fill="#6b5a4d" font-family="Arial, sans-serif" font-size="26">Receipt: ${escapeHTML(receipt.receiptNumber)}</text>
  <text x="1340" y="910" text-anchor="end" fill="#6b5a4d" font-family="Arial, sans-serif" font-size="26">Date: ${escapeHTML(date)}</text>
  <text x="800" y="965" text-anchor="middle" fill="#a86f2e" font-family="Georgia, serif" font-size="30" font-style="italic">Love everyone. Serve everyone. Remember God.</text>
</svg>`;
  };

  const downloadCertificate = () => {
    if (!certificateState.receipt) return;
    const blob = new Blob([certificateSVG(certificateState.receipt)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeReceipt = String(certificateState.receipt.receiptNumber || "certificate").replace(/[^a-z0-9-]+/gi, "-");
    link.href = url;
    link.download = `BNK-Seva-Certificate-${safeReceipt}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const displayReceipt = (receipt) => {
    const rows = [
      ["Receipt number", receipt.receiptNumber],
      ["Date", formatDate(receipt.date)],
      ["Donor name", receipt.donorName],
      ["Mobile", receipt.mobile],
      ["Email", receipt.email],
      ["Donation category", receipt.donationCategory],
      ["Donation purpose", receipt.purpose],
      ["Amount", formatAmount(receipt.amount)],
      ["Payment method", receipt.paymentMethod],
      ["Payment reference", receipt.paymentReference],
      ["Name display", receipt.anonymous ? "Anonymous" : "Public"]
    ];
    dialog.querySelector(".bnk-receipt-table tbody").innerHTML = rows.map(([label, value]) =>
      `<tr><th scope="row">${escapeHTML(label)}</th><td>${escapeHTML(value)}</td></tr>`
    ).join("");
    updateCertificate(receipt);
    formView.hidden = true;
    receiptView.hidden = false;
    document.dispatchEvent(new CustomEvent("bnk:donation-confirmed", { detail: receipt }));
    closeButton.focus();
  };

  const verifyPayment = async (payment) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { result } = await fetchJSON("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment)
      });
      if (result.receipt) {
        displayReceipt(result.receipt);
        return;
      }
      setStatus("Payment received. Verification is still in progress; please keep this page open.");
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }
    setStatus("Your payment is being verified. The Trust will issue your receipt once the payment is confirmed. Please contact the Trust if it does not arrive.");
  };

  closeButton.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) closeDialog();
  });
  dialog.querySelector(".bnk-donation-print").addEventListener("click", () => window.print());
  dialog.querySelector(".bnk-certificate-download").addEventListener("click", downloadCertificate);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    setStatus("Preparing secure payment…");
    try {
      const config = await loadPaymentConfig();
      await loadRazorpay();
      const fields = new FormData(form);
      const payload = {
        donorName: fields.get("donorName"),
        mobile: fields.get("mobile"),
        email: fields.get("email"),
        donationCategory: fields.get("donationCategory"),
        amount: Number(fields.get("amount")),
        purpose: fields.get("purpose"),
        anonymous: fields.get("visibility") === "anonymous",
        paymentMethod: fields.get("paymentMethod")
      };
      const { result: order } = await fetchJSON("/api/donations/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setStatus("");
      const selectedMethod = ["upi", "card", "netbanking"].includes(payload.paymentMethod)
        ? payload.paymentMethod
        : undefined;
      const checkout = new window.Razorpay({
        key: config.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "BNK Seva Trust",
        description: `Donation to BNK Seva Trust`,
        order_id: order.id,
        prefill: { name: payload.donorName, email: payload.email, contact: payload.mobile },
        theme: { color: "#884b34" },
        ...(selectedMethod ? { method: selectedMethod } : {}),
        modal: { ondismiss: () => setStatus("Payment was not completed. You may try again when ready.") },
        handler: (response) => verifyPayment({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature
        }).catch((error) => setStatus(error.message))
      });
      checkout.on("payment.failed", (response) => {
        setStatus(response.error?.description || "Payment was not completed. Please try another supported method.");
      });
      checkout.open();
    } catch (error) {
      setStatus(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.addEventListener("bnk:donation-selected", (event) => openDialog(event.detail));
  document.addEventListener("bnk:seva-donation", (event) => openDialog({
    ...event.detail,
    category: "Seva"
  }));
  document.addEventListener("temple:sponsor-selected", (event) => openDialog({
    ...event.detail,
    category: "Sponsorship"
  }));
  document.addEventListener("click", (event) => {
    const donateLink = event.target.closest('a[href$="#donate"]');
    if (donateLink) {
      event.preventDefault();
      openDialog({
        category: donateLink.dataset.donationCategory || "General Donation",
        sevaName: donateLink.dataset.donationPurpose || "General Donation"
      });
    }
  });
})();
