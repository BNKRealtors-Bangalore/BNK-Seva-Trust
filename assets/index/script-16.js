(() => {
'use strict';
// Demo catalog: Replace sample prices, availability and contents with verified store records.
const products=[
 {id:'box',name:'Baba Blessings Box',category:'Gift Boxes',price:1499,image:'images/optimized/baba-blessings-box-1448.webp',desc:'A curated gift collection of devotional essentials and spiritual keepsakes.',inside:['Baba Photo Frame','Hanuman Chalisa','Incense','Tulsi Mala','Spiritual Card','Blessing Card']},
 {id:'frame',name:'Neem Karoli Baba Photo Frame',category:'Photo Frames',price:499,image:'images/optimized/baba-photo-frame-1448.webp',desc:'A devotional photo frame for your home prayer space.',inside:['Baba Photo Frame']},
 {id:'chalisa',name:'Hanuman Chalisa',category:'Hanuman Chalisa',price:299,image:'images/optimized/hanuman-chalisa-1448.webp',desc:'A beautifully presented edition of Hanuman Chalisa.',inside:['Hanuman Chalisa']},
 {id:'books',name:'Spiritual Books',category:'Books',price:399,image:'images/optimized/spiritual-books-1448.webp',desc:'Selected devotional books and inspiring spiritual reading.',inside:['Spiritual Books']},
 {id:'mala',name:'Tulsi Mala',category:'Mala',price:799,image:'images/optimized/tulsi-mala-1448.webp',desc:'A traditional mala for japa and daily spiritual practice.',inside:['Tulsi Mala']},
 {id:'incense',name:'Sandalwood Incense',category:'Incense',price:349,image:'images/optimized/sandalwood-incense-1448.webp',desc:'Fragrant incense sticks for moments of reflection and prayer.',inside:['Incense Sticks']},
 {id:'idol',name:'Devotional Idol',category:'Devotional Items',price:1499,image:'images/optimized/devotional-idol-1448.webp',desc:'A finely detailed devotional keepsake.',inside:['Devotional Idol']},
 {id:'merch',name:'BNK Seva Trust T-Shirt',category:'Merchandise',price:599,image:'images/optimized/bnk-tshirts-1448.webp',desc:'Everyday merchandise inspired by the spirit of seva.',inside:['T-Shirt']}
];
const adminPriced=new Set();
const categories=['All Products','Photo Frames','Hanuman Chalisa','Books','Mala','Incense','Gift Boxes','Devotional Items','Merchandise'];
const root=document.getElementById('store');
if(!root)return;
const cartOverlay=document.createElement('div');
cartOverlay.id='bnkCartOverlay';
for(const id of ['floatingCartButton','shade','drawer','toast']){
 const element=root.querySelector('#'+id);if(element)cartOverlay.append(element);
}
document.body.append(cartOverlay);
const $=s=>root.querySelector(s)||cartOverlay.querySelector(s);
const navbar=document.querySelector('.site-header');
function updateCartOffset(){
 const bottom=navbar?Math.max(0,navbar.getBoundingClientRect().bottom):0;
 cartOverlay.style.setProperty('--bnk-navbar-bottom',Math.round(bottom)+'px');
}
updateCartOffset();
window.addEventListener('resize',updateCartOffset);
window.addEventListener('scroll',updateCartOffset,{passive:true});
if(navbar&&'ResizeObserver'in window)new ResizeObserver(updateCartOffset).observe(navbar);
const escapeStoreHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=n=>'₹'+n.toLocaleString('en-IN');
const productById=id=>products.find(p=>p.id===id);
let category='All Products',query='',selected='box',quantity=1,tab='inside',favouriteOnly=false,cartReturnFocus=null;
const safeRead=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}};
let cart=safeRead('bnk-demo-cart',{}),favs=safeRead('bnk-demo-favs',[]);
const persist=()=>{try{localStorage.setItem('bnk-demo-cart',JSON.stringify(cart));localStorage.setItem('bnk-demo-favs',JSON.stringify(favs))}catch{}};
let toastTimer;
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
async function loadStorePricing(){
 try{
  const response=await fetch('/api/pricing-config',{cache:'no-store'});
  if(!response.ok)return;
  const config=await response.json();
  if(!config.storePrices)return;
  products.forEach(p=>{const price=Number(config.storePrices[p.id]);if(!adminPriced.has(p.id)&&Number.isSafeInteger(price)&&price>0)p.price=price});
  renderCategories();renderProducts();renderCart();renderDetail();
 }catch{
  // Keep built-in defaults if admin pricing cannot load.
 }
}
function applyStoreContent(content){
 const items=(content?.records?.store||[]).filter(item=>item.status==='Active');
 if(!items.length)return;
 items.forEach((item,index)=>{
  const id=item.id||('admin-store-'+index);adminPriced.add(id);
  const existing=products.find(p=>p.id===id);
  const product={
   id,
   name:item.name||'Seva Store Product',
   category:item.category||'Devotional Items',
   price:Number(item.price)||0,available:item.available!==false,
   image:item.image||'images/optimized/baba-blessings-box-1448.webp',
   desc:item.description||'A seva store offering published by BNK Seva Trust.',
   inside:[item.name||'Seva Store Product']
  };
  if(existing)Object.assign(existing,product);else products.push(product);
  if(!categories.includes(product.category))categories.push(product.category);
 });
 renderCategories();renderProducts();renderCart();renderDetail();
}
async function loadStoreContent(){
 try{
  const response=await fetch('/api/site-content',{cache:'no-store'});
  if(!response.ok)return;
  applyStoreContent(await response.json());
 }catch{}
}
document.addEventListener('bnk:site-content',event=>applyStoreContent(event.detail));
if(window.BNK_SITE_CONTENT)applyStoreContent(window.BNK_SITE_CONTENT);
function urlForProduct(id){const url=new URL(window.location.href);url.searchParams.set('product',id);url.hash='#store';return url.pathname+url.search+url.hash}
function urlForStore(){const url=new URL(window.location.href);url.searchParams.delete('product');url.hash='#store';return url.pathname+url.search+url.hash}
function renderRoute(animate=true, scrollToStore=false){
 const requested=new URL(window.location.href).searchParams.get('product');
 const p=productById(requested);
 const showProduct=Boolean(p);
 $('#storePage').hidden=showProduct;
 $('#productPage').hidden=!showProduct;
 if(showProduct){selected=p.id;quantity=1;tab='inside';renderDetail();$('#productRouteName').textContent='BNK Seva Store / '+p.name}
 document.title=(showProduct?p.name+' | ':'')+'BNK Seva Trust — Seva, Shraddha, Samarpan';
 const visible=showProduct?$('#productPage'):$('#storePage');
 visible.classList.remove('view-enter');
 if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){void visible.offsetWidth;visible.classList.add('view-enter')}
 if(scrollToStore){requestAnimationFrame(()=>root.scrollIntoView({behavior:'instant',block:'start'}))}
}
function navigateProduct(id){if(!productById(id))return;history.pushState({product:id},'',urlForProduct(id));renderRoute(true,true)}
function navigateStore(){history.pushState({product:null},'',urlForStore());renderRoute(true,true);}
function renderCategories(){
 $('#categoryPills').innerHTML=categories.map(c=>`<button type="button" class="pill ${category===c?'active':''}" data-category="${escapeStoreHTML(c)}" aria-pressed="${category===c}">${escapeStoreHTML(c)}</button>`).join('');
 $('#categoryCircles').innerHTML=categories.slice(1).filter(c=>products.some(p=>p.category===c)).map(c=>{const p=products.find(p=>p.category===c);return `<button type="button" class="category ${category===c?'active':''}" data-category="${escapeStoreHTML(c)}" aria-pressed="${category===c}"><div class="category-photo"><img src="${escapeStoreHTML(p.image)}" alt="" loading="lazy" decoding="async"></div>${escapeStoreHTML(c)}</button>`}).join('');
}
function renderProducts(){
 const visible=products.filter(p=>(category==='All Products'||p.category===category)&&(!favouriteOnly||favs.includes(p.id))&&(`${escapeStoreHTML(p.name)} ${escapeStoreHTML(p.category)}`.toLowerCase().includes(query)));
 $('#productGrid').innerHTML=visible.length?visible.map(p=>`
  <article class="product">
    <button type="button" class="heart ${favs.includes(p.id)?'active':''}" data-fav="${escapeStoreHTML(p.id)}" aria-label="${favs.includes(p.id)?'Remove from':'Add to'} favourites" aria-pressed="${favs.includes(p.id)}">${favs.includes(p.id)?'♥':'♡'}</button>
    <a class="product-entry" href="${escapeStoreHTML(urlForProduct(p.id))}" data-product-link="${escapeStoreHTML(p.id)}" aria-label="View details for ${escapeStoreHTML(p.name)}">
      <img src="${escapeStoreHTML(p.image)}" loading="lazy" alt="${escapeStoreHTML(p.name)}" decoding="async">
      <div class="product-body"><h3 class="product-title">${escapeStoreHTML(p.name)}</h3><p class="price">${money(p.price)}*</p></div>
    </a>
    <button type="button" class="tiny-btn" data-add="${escapeStoreHTML(p.id)}" ${p.available===false?'disabled':''}>${p.available===false?'OUT OF STOCK':'ADD TO CART'} →</button>
  </article>`).join(''):'<p style="grid-column:1/-1;padding:20px">No products match this selection.</p>';
 $('#favCount').textContent=favs.length;
}
function renderDetail(){
 const p=productById(selected);if(!p)return;
 $('#detailTitle').textContent=p.name;$('#detailDescription').textContent=p.desc;$('#detailPrice').textContent=money(p.price)+'*';$('#detailCrumb').textContent=p.category;
 $('#detailMainImage').src=p.image;$('#detailMainImage').alt=p.name;
 const images=p.gallery?.length?p.gallery:[p.image];
 $('#detailThumbs').innerHTML=images.map((src,i)=>`<button type="button" class="thumb ${i===0?'active':''}" data-thumb="${i}" aria-label="View product photo ${i+1}"><img src="${escapeStoreHTML(src)}" alt="" decoding="async" loading="lazy"></button>`).join('');
 $('#quantityValue').textContent=quantity;renderTab();
}
function renderTab(){
 const p=productById(selected);
 const tabContent=$('#tabContent');
 if(!p||!tabContent)return;
 root.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
 let html='';
 if(tab==='inside')html=`<div class="inside-grid">${p.inside.map((x,i)=>`<div class="inside-item"><span class="item-symbol" aria-hidden="true">${['✦','❀','☼','♧','♡','✧'][i%6]}</span><span>${escapeStoreHTML(x)}</span></div>`).join('')}</div>`;
 else if(tab==='overview')html=`<p>${escapeStoreHTML(p.desc)}</p><p>Product details, dimensions, materials and origin must be confirmed before publication.</p>`;
 else if(tab==='impact')html='<p><strong>How sale proceeds are handled:</strong> The allocation of proceeds, related operational costs and any charitable transfer amounts have not yet been verified or configured. Publish accurate information here before accepting orders. A product purchase is not automatically a charitable donation.</p>';
 else html='<p>Shipping charges, dispatch timelines, cancellation, returns, refund policy and store contact information must be added before real checkout is enabled.</p>';
 tabContent.innerHTML=html;
}
function addCart(id,qty=1){if(productById(id)?.available===false){toast('This item is out of stock.');return}cart[id]=(cart[id]||0)+qty;persist();renderCart();toast('Added to cart')}
function syncFloatingCart(){
 const count=Object.entries(cart).filter(([id,n])=>n>0&&productById(id)).reduce((sum,[,n])=>sum+n,0);
 const open=$('#drawer').classList.contains('open');
 $('#floatingCartButton').hidden=count===0||open;
 $('#floatingCartCount').textContent=count;
 $('#floatingCartButton').setAttribute('aria-label','View cart, '+count+' '+(count===1?'item':'items'));
 $('#floatingCartButton').setAttribute('aria-expanded',String(open));
}
function renderCart(){
 syncFloatingCart();
 const entries=Object.entries(cart).filter(([id,n])=>n>0&&productById(id));
 $('#cartCount').textContent=entries.reduce((s,[,n])=>s+n,0);
 $('#cartTotal').textContent=money(entries.reduce((sum,[id,n])=>sum+productById(id).price*n,0));
 $('#cartItems').innerHTML=entries.length?entries.map(([id,n])=>{const p=productById(id);return `<div class="cart-line"><img src="${escapeStoreHTML(p.image)}" alt="" decoding="async" loading="lazy"><div><b>${escapeStoreHTML(p.name)}</b><div class="muted">${money(p.price)} × ${n}</div><button type="button" data-remove="${id}">Remove</button></div><div><button type="button" data-change="${id}" data-delta="-1" aria-label="Reduce ${escapeStoreHTML(p.name)}">−</button> ${n} <button type="button" data-change="${id}" data-delta="1" aria-label="Increase ${escapeStoreHTML(p.name)}">+</button></div></div>`}).join(''):'<p>Your cart is empty.</p>';
}
function checkoutCart(){
 const entries=Object.entries(cart).filter(([id,n])=>n>0&&productById(id));
 if(!entries.length){toast('Your cart is empty.');return}
 const items=entries.map(([id,quantity])=>{const p=productById(id);return{id,name:p.name,quantity,lineTotalPaise:Math.round(p.price*100)*quantity}});
 drawer(false);
 document.dispatchEvent(new CustomEvent('bnk:store-checkout',{detail:{items}}));
}
document.addEventListener('bnk:purchase-submitted',event=>{
 for(const item of event.detail.items){cart[item.id]=Math.max(0,(cart[item.id]||0)-item.quantity);if(!cart[item.id])delete cart[item.id]}
 persist();renderCart();
});
function drawer(open){
 updateCartOffset();
 $('#drawer').inert=!open;
 $('#shade').classList.toggle('open',open);$('#drawer').classList.toggle('open',open);$('#drawer').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':'';
 if(open){cartReturnFocus=document.activeElement;syncFloatingCart();$('#closeDrawer').focus()}else{syncFloatingCart();if(cartReturnFocus?.isConnected&&!cartReturnFocus.hidden)cartReturnFocus.focus();else $('#cartButton').focus()}
}
for(const target of [root,cartOverlay])target.addEventListener('click',event=>{
 const link=event.target.closest('a[data-product-link]');
 if(link&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();navigateProduct(link.dataset.productLink);return}
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.category){category=b.dataset.category;favouriteOnly=false;renderCategories();renderProducts()}
 if(b.dataset.add)addCart(b.dataset.add);
 if(b.dataset.fav){const id=b.dataset.fav;favs=favs.includes(id)?favs.filter(x=>x!==id):[...favs,id];persist();renderProducts()}
 if(b.dataset.tab){tab=b.dataset.tab;renderTab()}
 if(b.dataset.thumb!=null){const p=productById(selected);const images=p.gallery?.length?p.gallery:[p.image];$('#detailMainImage').src=images[Number(b.dataset.thumb)]||p.image;root.querySelectorAll('.thumb').forEach(x=>x.classList.toggle('active',x===b))}
 if(b.dataset.remove){delete cart[b.dataset.remove];persist();renderCart()}
 if(b.dataset.change){const id=b.dataset.change;cart[id]=Math.max(0,(cart[id]||0)+Number(b.dataset.delta));if(!cart[id])delete cart[id];persist();renderCart()}
});
$('#productSearch').addEventListener('input',e=>{query=e.target.value.toLowerCase().trim();renderProducts()});
$('#quantityMinus').addEventListener('click',()=>{$('#quantityValue').textContent=quantity=Math.max(1,quantity-1)});
$('#quantityPlus').addEventListener('click',()=>{$('#quantityValue').textContent=quantity=Math.min(99,quantity+1)});
$('#addSelected').addEventListener('click',()=>addCart(selected,quantity));
$('#featuredBtn').addEventListener('click',()=>navigateProduct('box'));
$('#backToStore').addEventListener('click',navigateStore);

$('#exploreBtn').addEventListener('click',()=>$('#catalog').scrollIntoView({behavior:'smooth',block:'start'}));
$('#cartButton').addEventListener('click',()=>drawer(true));
$('#floatingCartButton').addEventListener('click',()=>drawer(true));
$('#closeDrawer').addEventListener('click',()=>drawer(false));
$('#shade').addEventListener('click',()=>drawer(false));
$('#drawer').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const focusable=[...$('#drawer').querySelectorAll('button:not([disabled])')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#drawer').classList.contains('open'))drawer(false)});
$('#favsButton').addEventListener('click',()=>{const already=favouriteOnly;favouriteOnly=!already;category='All Products';renderCategories();renderProducts();if(!$('#productPage').hidden)navigateStore();$('#catalog').scrollIntoView({behavior:'smooth',block:'start'});toast(favouriteOnly?'Showing saved favourites':'Showing all products')});
$('#checkoutButton').addEventListener('click',checkoutCart);
$('#impactBtn')?.addEventListener('click',()=>{tab='impact';renderTab();$('#detailTabs')?.scrollIntoView({behavior:'smooth',block:'nearest'})});
$('#taxBtn')?.addEventListener('click',()=>toast('Add the verified tax policy page URL.'));
$('#transparencyBtn')?.addEventListener('click',()=>{location.href='/transparency'});
window.BNKStoreSyncSection = () => renderRoute(false, false);
window.addEventListener('popstate', () => {
  const product = new URL(window.location.href).searchParams.get('product');
  renderRoute(false, Boolean(product));
});
renderCategories();renderProducts();renderCart();renderRoute(false,Boolean(new URL(location.href).searchParams.get('product')));loadStorePricing();loadStoreContent();
// Smooth entrance animations, without hiding non-JavaScript content.
if('IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}})},{threshold:.06});root.querySelectorAll('.bnk-store-reveal').forEach((el,i)=>{el.style.transitionDelay=`${Math.min(i,6)*80}ms`;observer.observe(el)})}
else root.querySelectorAll('.bnk-store-reveal').forEach(el=>el.classList.add('visible'));
})();
