(() => {
  "use strict";
  const dialog=document.createElement("dialog");
  dialog.id="bnkPurchaseDialog";
  dialog.setAttribute("aria-labelledby","purchaseHeading");
  dialog.innerHTML='<button type="button" class="purchase-close" aria-label="Close checkout">×</button><p class="purchase-eyebrow">BNK SEVA STORE</p><h2 id="purchaseHeading">Complete your purchase</h2><div id="purchaseSummary"></div><form id="purchaseForm"><div class="purchase-fields"><label>Full name<input name="name" autocomplete="name" maxlength="120" required></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="purchase-wide">Delivery address<textarea name="address" autocomplete="street-address" maxlength="1000" rows="3" required></textarea></label></div><button type="submit" class="purchase-primary">Continue to UPI payment</button></form><section id="purchasePayment" hidden><h3>Scan QR to pay</h3><p id="purchaseAmount"></p><img class="purchase-qr" src="/payment/scanner.jpeg" alt="UPI QR code to pay BNK Seva Trust"><p>Pay the exact total using any UPI app, then enter the transaction reference below.</p><a href="/payment/scanner.jpeg" target="_blank" rel="noopener noreferrer">Open QR image</a><label>UPI transaction / reference ID<input id="purchaseReference" maxlength="120" required></label><button type="button" class="purchase-primary" id="purchasePaid">I Have Paid</button><p>Payment will be checked by the Trust before your purchase is marked verified.</p></section><p id="purchaseMessage" role="status" aria-live="polite"></p>';
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector);
  const form=$("#purchaseForm"),pay=$("#purchasePayment"),submit=form.querySelector('button[type="submit"]'),paid=$("#purchasePaid");
  const money=paise=>"₹"+(paise/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const escape=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let items=[],order=null,paymentToken=null,returnFocus=null,busy=false;
  function summary(lines,total) {
    $("#purchaseSummary").innerHTML='<h3>Your items</h3><ul>'+lines.map(item=>'<li><span>'+escape(item.name)+' × '+item.quantity+'</span><strong>'+money(item.lineTotalPaise)+'</strong></li>').join("")+'</ul><div class="purchase-total"><span>Total</span><strong>'+money(total)+'</strong></div>';
  }
  async function request(url,body) {
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      const local=["localhost","127.0.0.1","::1"].includes(location.hostname);
      const fallback=local&&(response.status===404||response.status===405)?"Checkout needs the project server. Open http://localhost:3000 instead of the static preview, then try again.":"Checkout service unavailable (HTTP "+response.status+"). Please try again.";
      throw Error(result.error||fallback);
    }
    if(!result.purchase)throw Error("The checkout service did not confirm your purchase. Please try again.");
    return result;
  }
  function setBusy(value) {
    busy=value;submit.disabled=value;paid.disabled=value;
    dialog.setAttribute("aria-busy",String(value));
  }
  document.addEventListener("bnk:store-checkout",event=>{
    if(busy)return;
    items=event.detail.items.map(item=>({id:item.id,quantity:item.quantity}));
    order=null;paymentToken=null;form.reset();form.hidden=false;pay.hidden=true;
    $("#purchaseReference").value="";$("#purchaseMessage").textContent="";
    summary(event.detail.items,event.detail.items.reduce((sum,item)=>sum+item.lineTotalPaise,0));
    returnFocus=document.activeElement;dialog.showModal();form.elements.name.focus();
  });
  const close=()=>{if(busy)return;dialog.close();returnFocus?.focus()};
  $(".purchase-close").addEventListener("click",close);
  dialog.addEventListener("cancel",event=>{if(busy)event.preventDefault()});
  dialog.addEventListener("close",()=>returnFocus?.focus());
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(!form.reportValidity()||busy)return;
    setBusy(true);$("#purchaseMessage").textContent="Saving purchase details...";
    try {
      const fields=Object.fromEntries(new FormData(form));
      const result=await request("/api/purchases",{...fields,items});
      order=result.purchase;paymentToken=result.paymentToken;
      summary(order.items,order.totalPaise);form.hidden=true;pay.hidden=false;
      $("#purchaseAmount").textContent="Amount to pay: "+money(order.totalPaise);
      $("#purchaseMessage").textContent="Purchase saved. Complete your UPI payment below.";
      $("#purchaseReference").focus();
    }catch(error){$("#purchaseMessage").textContent=error.message}
    finally{setBusy(false)}
  });
  paid.addEventListener("click",async()=>{
    const reference=$("#purchaseReference");if(!reference.reportValidity()||!reference.value.trim()||busy||!order)return;
    setBusy(true);$("#purchaseMessage").textContent="Submitting payment reference...";
    try {
      const result=await request("/api/purchases/"+encodeURIComponent(order.id)+"/payment",{paymentToken,reference:reference.value.trim()});
      pay.hidden=true;$("#purchaseMessage").textContent="Purchase "+result.purchase.id+" recorded. Your payment is pending verification by the Trust.";
      document.dispatchEvent(new CustomEvent("bnk:purchase-submitted",{detail:{items:order.items}}));
      $("#purchaseMessage").setAttribute("tabindex","-1");$("#purchaseMessage").focus();
    }catch(error){$("#purchaseMessage").textContent=error.message}
    finally{setBusy(false)}
  });
})();
