'use strict';
const KEY='bnk_seva_admin_prototype_v1';
const stages=['Vision','Land & Site','Architectural Design','Approvals','Ground Breaking','Foundation','Construction','Murti Sthapana','Pran Pratishtha'];
const menus=[['dashboard','▦','Dashboard'],['donations','♡','Donations'],['temple','♜','Temple Project'],['initiatives','♧','Seva Initiatives'],['store','▣','Seva Store'],['stories','▤','Voices of Seva'],['csr','◇','CSR Partnerships'],['partners','♢','Seva Partners'],['volunteers','♙','Volunteers'],['beneficiaries','♧','Beneficiaries'],['users','♙','Users & Roles'],['settings','⚙','Settings']];
const schemas={
 donations:{title:'Donations',desc:'Record and review verified donations; no payment processing is included.',fields:[['name','Donor Name','text',true],['amount','Amount (₹)','number',true],['type','Seva Type','select',true,['Temple Project','General Seva','Anna Seva','Education Seva','Healthcare Seva','Gau Seva','Environment Seva','Temple by Sq. Ft.','Seva Store','CSR','Other']],['source','Source','select',true,['Online','Seva Store','CSR','Direct Transfer','Others']],['date','Date','date',true],['reference','Transaction Reference','text',false],['status','Verification','select',true,['Verified','Pending','Rejected']]]},
 initiatives:{title:'Seva Initiatives',desc:'Manage campaigns shown when visitors open View All Events.',fields:[['campaignName','Campaign Name','text',true],['location','Location','text',true],['date','Date','date',true],['image','Image','text',false],['status','Status','select',true,['Active','Planned','Completed']]]},
 store:{title:'Seva Store',desc:'Manage charitable store offerings and their prices.',fields:[['name','Item Name','text',true],['price','Price (₹)','number',true],['stock','Stock available (blank = unlimited)','number',false],['status','Status','select',true,['Active','Draft','Out of Stock']],['image','Image URL / Path','text',false]]},
 stories:{title:'Voices of Seva',desc:'Manage approved donor, beneficiary, community member and volunteer voices.',fields:[['name','Name','text',true],['quote','Quote','textarea',true],['image','Image','text',false],['category','Category','select',true,['Donor','Beneficiary','Community Member','Volunteer']],['status','Status','select',true,['Draft','Published']]]},
 csr:{title:'CSR Partnerships',desc:'Track corporate collaboration opportunities and proposals.',fields:[['organisation','Organisation Name','text',true],['contactName','Contact Person','text',false],['email','Email Address','email',false],['phone','Phone Number','tel',false],['interest','Partnership Interest','text',false],['budget','Preferred Budget','text',false],['message','Message','textarea',false],['submittedAt','Submitted At','text',false],['status','Status','select',true,['Enquiry','In Discussion','Active','Closed']]]},
 partners:{title:'Seva Partners',desc:'Track recurring partner commitments; this prototype does not collect recurring payments.',fields:[['name','Partner Name','text',true],['email','Email','email',false],['amount','Monthly Pledge (₹)','number',true],['start','Start Date','date',true],['status','Status','select',true,['Active','Paused','Ended']]]},
 volunteers:{title:'Volunteers',desc:'Keep volunteer profiles and activity assignments.',fields:[['name','Volunteer Name','text',true],['phone','Phone','tel',false],['email','Email','email',false],['city','City','text',false],['areaOfInterest','Area of Interest','text',false],['availability','Availability','text',false],['submittedAt','Submitted At','text',false],['status','Status','select',true,['Active','Inactive']]]},
 beneficiaries:{title:'Beneficiaries',desc:'Manage consent-based beneficiary information responsibly.',fields:[['name','Beneficiary Name','text',true],['category','Seva Supported','text',true],['date','Date','date',false],['notes','Notes','textarea',false]]},
 users:{title:'Users & Roles',desc:'Manage backend admin users and enforced roles.',fields:[['name','User Name','text',true],['email','Email','email',true],['password','New Password','password',false],['role','Role','select',true,['Admin','Editor','Viewer']],['status','Status','select',true,['Active','Disabled']]]}
};
menus.push(['certificates','&#9993;','Certificates']);
menus.push(['purchases','&#128722;','Purchases']);
menus.push(['newsletter','@','Email Subscribers']);menus.push(['operations','&#9881;','Backups & Audit']);
menus.splice(3,0,['updates','↗','Temple Updates']);
schemas.updates={title:'Temple Updates',desc:'Publish updates shown in the Follow the Journey section.',fields:[['name','Update Title','text',true],['category','Category','select',true,['Featured Update','Construction Updates','Site Updates','Architectural Updates','Seva Activities','Events','Volunteer Activities','Temple Milestones']],['status','Status','select',true,['Published','Draft']],['description','Description','textarea',false],['image','Image URL / Path','text',false]]};

const defaultInitiatives=[{id:'initiative_medical_camp',campaignName:'Free Medical Camp',location:'Newtown, Kolkata',date:'2026-10-15',image:'images/optimized/medical-camp-event-1095.webp',status:'Active'},{id:'initiative_food_distribution',campaignName:'Food Distribution Drive',location:'Siliguri',date:'2026-10-22',image:'images/optimized/food-distribution-event-822.webp',status:'Active'},{id:'initiative_education_support',campaignName:'Educational Support Programme',location:'Bengaluru',date:'2026-11-02',image:'images/optimized/education-event-822.webp',status:'Active'}];
const seed=()=>({records:{...Object.fromEntries(Object.keys(schemas).map(k=>[k,[]])),initiatives:defaultInitiatives.map(x=>({...x,name:x.campaignName}))},milestones:stages.map((name,i)=>({name,status:i===0?'Completed':'Upcoming'})),goal:0,templeNote:'',sqft:[{sqft:1,amount:2500},{sqft:2,amount:5000},{sqft:5,amount:12500},{sqft:10,amount:25000},{sqft:20,amount:50000},{sqft:50,amount:125000},{sqft:100,amount:250000}],partnerAmounts:[501,1001,2501],donationPresets:[501,1001,2501,5001,11000]});

let state;try{state=JSON.parse(localStorage.getItem(KEY))||seed()}catch{state=seed()}

function normalize(){const d=seed();if(!state||typeof state!=='object')state=d;state.records=state.records||{};for(const k of Object.keys(schemas))if(!Array.isArray(state.records[k]))state.records[k]=[];if(!state.records.initiatives.length)state.records.initiatives=d.records.initiatives;state.records.initiatives=state.records.initiatives.map(r=>({...r,campaignName:r.campaignName||r.name||'',name:r.name||r.campaignName||''}));if(!Array.isArray(state.milestones)||state.milestones.length!==9)state.milestones=d.milestones;state.goal=Number(state.goal)||0;state.sqft=Array.isArray(state.sqft)?state.sqft:d.sqft;state.partnerAmounts=Array.isArray(state.partnerAmounts)?state.partnerAmounts:d.partnerAmounts;state.donationPresets=Array.isArray(state.donationPresets)?state.donationPresets:d.donationPresets;state.templeNote=state.templeNote||''}normalize();
function persistPublicDraft(){
 const fields=["id","name","status","campaignName","location","date","image","category","description","quote","price","stock"];
 const records={};for(const key of ["store","initiatives","updates","stories"])records[key]=(state.records[key]||[]).map(row=>Object.fromEntries(fields.filter(field=>row[field]!==undefined).map(field=>[field,row[field]])));
 localStorage.setItem(KEY,JSON.stringify({records,milestones:state.milestones,goal:state.goal,templeNote:state.templeNote,_version:state._version}));
}
persistPublicDraft();
let contentRevision=0,contentBusy=false;
function contentStatus(message){el('contentSaveStatus').textContent=message}
function save(){contentRevision++;persistPublicDraft();localStorage.setItem(KEY+'_unsaved','1');contentStatus('Unsaved changes. Save or publish to update the website.')}
function contentControls(busy){contentBusy=busy;for(const id of ['publishContent','loadContent','addRecord'])el(id).disabled=busy;el('recordForm').querySelector('[type="submit"]').disabled=busy}
function applySiteContent(data){state={...seed(),...data,records:{...seed().records,...(data.records||{})}};normalize();persistPublicDraft();localStorage.removeItem(KEY+'_unsaved');if(schemas[page])renderManager();if(page==='dashboard')renderDashboard();if(page==='temple')renderTemple()}
async function loadSiteContent(showToast=true){
 if(contentBusy||(localStorage.getItem(KEY+'_unsaved')&&Number.isInteger(state._version))){contentStatus('You have unsaved changes. Publish them before loading website content.');return}
 const revision=contentRevision;
 try{const res=await authFetch('/api/admin/site-content',{cache:'no-store'});if(!res.ok)throw Error('Site content API unavailable (HTTP '+res.status+').');const data=await res.json();if(revision!==contentRevision||contentBusy)return;const publishedIds=new Set((data.records?.store||[]).map(item=>item.id));const unpublished=(state.records.store||[]).filter(item=>item.id&&!publishedIds.has(item.id));if(unpublished.length){data.records=data.records||{};data.records.store=[...(data.records.store||[]),...unpublished];applySiteContent(data);save();contentStatus('Recovered '+unpublished.length+' store item(s) saved in this browser but missing from the website. Use Publish Content to publish them.');return}applySiteContent(data);contentStatus('Website content loaded.');if(showToast)toast('Loaded website content')}
 catch(err){contentStatus(err.message);if(showToast)toast(err.message)}
}
async function publishSiteContent(){save();await persistSiteContent('Published content to website')}
async function persistSiteContent(message='Saved to website'){
 if(contentBusy)return false;
 const revision=contentRevision;
 const payload=JSON.stringify(state);
 contentControls(true);contentStatus('Saving to website...');
 try{
  const res=await authFetch('/api/admin/site-content',{method:'PUT',headers:{'Content-Type':'application/json'},body:payload});const result=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(result.error||'Save failed (HTTP '+res.status+').');
  if(!result.records)throw Error('The server did not confirm the saved records.');
  if(revision===contentRevision)applySiteContent(result);
  contentStatus(message+'.'+(result.certificateNotice?' '+result.certificateNotice:''));toast(message);if(typeof processCertificateQueue==='function')processCertificateQueue();return true;
 }catch(err){contentStatus('Not published: '+err.message+' Your edits remain open; retry Save or Publish Content before closing this page.');toast('Save failed: '+err.message);return false}
 finally{contentControls(false)}
}
const el=id=>document.getElementById(id);const money=n=>'₹'+Math.max(0,Number(n)||0).toLocaleString('en-IN',{maximumFractionDigits:0});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;function toast(msg){const e=el('toast');e.textContent=msg;e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,2800)}
let currentUser=null;
async function authFetch(url,options={}){const session=currentUser;const res=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.headers||{})}});if(session!==currentUser)throw Error('Your session changed. Reload this page before continuing.');if(res.status===401){el('authScreen').hidden=false;throw Error('Login required.')}return res}
function setSessionUser(user){currentUser=user;el('sessionUser').textContent=user?`${user.name} · ${user.role}`:'Not signed in';el('authScreen').hidden=Boolean(user);if(!user){for(const key of ["donations","csr","partners","volunteers","beneficiaries","users"])state.records[key]=[];for(const id of ["managerBody","recentDonations","purchaseRows","certificateRows","subscriberRows","dialogFields","auditRows"])el(id)?.replaceChildren();persistPublicDraft()}}
async function checkSession(){try{const res=await fetch('/api/admin/me',{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw Error();const data=await res.json();setSessionUser(data.user);loadSiteContent(false);loadAdminUsers(false)}catch{setSessionUser(null)}}
async function loadAdminUsers(showToast=true){try{const res=await authFetch('/api/admin/users',{cache:'no-store'});if(!res.ok)return;const data=await res.json();state.records.users=(data.users||[]).map(u=>({...u,password:''}));if(page==='users')renderManager();if(showToast)toast('Loaded admin users')}catch(err){if(showToast)toast(err.message)}}
async function saveAdminUsers(){try{const res=await authFetch('/api/admin/users',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({users:state.records.users})});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Could not save users');state.records.users=(data.users||[]).map(u=>({...u,password:''}));if(page==='users')renderManager();toast('Saved admin users')}catch(err){toast(err.message)}}
el('loginForm').addEventListener('submit',async e=>{e.preventDefault();el('loginError').textContent='';try{const res=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:el('loginEmail').value,password:el('loginPassword').value})});const isJSON=(res.headers.get('content-type')||'').includes('application/json');const data=isJSON?await res.json().catch(()=>({})):{};if(!res.ok){if(res.status===404||res.status===405)throw Error('The admin login API is unavailable on this deployment (HTTP '+res.status+'). The Node.js backend must be deployed.');if(res.status>=500)throw Error(data.error||'The login server failed (HTTP '+res.status+'). Check deployment logs and database configuration.');throw Error(data.error||'Login failed (HTTP '+res.status+').')}if(!data.user)throw Error('The login API did not return a valid response. Check that this deployment runs the Node.js backend.');setSessionUser(data.user);el('loginPassword').value='';loadSiteContent(true);toast('Signed in')}catch(err){el('loginError').textContent=err.message}});
el('logoutButton').addEventListener('click',async()=>{await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});setSessionUser(null);toast('Signed out')});
async function processCertificateQueue(){
 if(!['Admin','Editor'].includes(currentUser?.role))return;
 try{for(let i=0;i<3;i++){const res=await authFetch('/api/admin/certificates/process',{method:'POST'});const data=await res.json();if(!res.ok||!data.configured||!data.hasMore)break;}if(page==='certificates')await loadCertificates()}catch{contentStatus('Records saved. Check Certificates for queued delivery status.')}
}
async function persistRecord(category,id,record,remove=false){
 contentControls(true);
 try{const res=await authFetch('/api/admin/records/'+encodeURIComponent(category)+'/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:state._version,record,remove})});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not save record');applySiteContent(data);contentStatus(remove?'Record deleted.':'Record saved.');processCertificateQueue();return true}
 catch(error){contentStatus(error.message+' Your edits are still open. Use Load Site to load the latest records before retrying.');return false}
 finally{contentControls(false)}
}
async function loadCertificates(){
 el('certificateRows').replaceChildren();
 try{const res=await authFetch('/api/admin/certificates',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not load certificates');
 el('certificateStatus').textContent=data.configured?'Email sending is configured. Submitted means accepted by the email server; it does not confirm inbox delivery.':'Email sending needs setup. Configure the Gmail App Password to send verified certificates.';
 el('certificateRows').innerHTML=data.certificates.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.donation_id)+'</td><td>'+esc(c.email)+'</td><td>'+esc(c.status)+(c.last_error?'<br>'+esc(c.last_error):'')+'</td><td>'+(['Ready','Setup required','Failed','Not issued'].includes(c.status)&&['Admin','Editor'].includes(currentUser?.role)?'<button type="button" class="btn tiny" data-send-certificate="'+esc(c.donation_id)+'">Send certificate</button>':'')+(c.status==='Check mail provider'&&currentUser?.role==='Admin'?'<button type="button" class="btn tiny" data-resolve-certificate="'+esc(c.donation_id)+'" data-resolution="delivered">Confirm already sent</button><button type="button" class="btn tiny" data-resolve-certificate="'+esc(c.donation_id)+'" data-resolution="retry">Retry after checking mailbox</button>':'')+'</td></tr>').join('');
 }catch(error){el('certificateStatus').textContent=error.message}
}
el('refreshCertificates').addEventListener('click',()=>{processCertificateQueue();loadCertificates()});
el('certificateRows').addEventListener('click',async event=>{const b=event.target.closest('[data-resolve-certificate]');if(!b)return;if(!confirm('Confirm that you checked the sender mailbox. Retry can send a duplicate if the original email was accepted.'))return;b.disabled=true;try{const res=await authFetch('/api/admin/certificates/'+encodeURIComponent(b.dataset.resolveCertificate)+'/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,resolution:b.dataset.resolution})});const data=await res.json();if(!res.ok)throw Error(data.error);await processCertificateQueue();await loadCertificates()}catch(error){el('certificateStatus').textContent=error.message}finally{b.disabled=false}});
el('certificateRows').addEventListener('click',async event=>{const button=event.target.closest('[data-send-certificate]');if(!button)return;button.disabled=true;try{const res=await authFetch('/api/admin/certificates/'+encodeURIComponent(button.dataset.sendCertificate)+'/send',{method:'POST'});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not send certificate');await loadCertificates()}catch(error){el('certificateStatus').textContent=error.message}finally{button.disabled=false}});
let purchasesOffset=0;
const purchasePager=document.createElement('div');purchasePager.className='toolbar';purchasePager.innerHTML='<button type="button" class="btn" id="purchasesPrevious">Previous</button><span id="purchasesPage"></span><button type="button" class="btn" id="purchasesNext">Next</button>';el('purchases').append(purchasePager);
el('purchasesPrevious').onclick=()=>{purchasesOffset=Math.max(0,purchasesOffset-50);loadPurchases()};el('purchasesNext').onclick=()=>{purchasesOffset+=50;loadPurchases()};
async function loadPurchases(){
 el('purchaseRows').replaceChildren();el('purchasesStatus').textContent='Loading purchases...';
 try{
  const res=await authFetch('/api/admin/purchases?limit=50&offset='+purchasesOffset,{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not load purchases');
  el('purchasesStatus').textContent=data.total+' purchase(s)';el('purchasesPage').textContent='Page '+(Math.floor(purchasesOffset/50)+1)+' of '+Math.max(1,Math.ceil(data.total/50));el('purchasesPrevious').disabled=purchasesOffset===0;el('purchasesNext').disabled=purchasesOffset+50>=data.total;
  el('purchaseRows').innerHTML=data.purchases.map(p=>{
   const editable=p.status!=='Verified'&&p.reference&&['Admin','Editor'].includes(currentUser?.role);
   const controls=editable?'<select aria-label="Payment verification" data-purchase-status="'+esc(p.id)+'">'+['Pending Verification','Verified','Rejected'].map(status=>'<option '+(status===p.status?'selected':'')+'>'+status+'</option>').join('')+'</select><button class="btn tiny" type="button" data-purchase-save="'+esc(p.id)+'">Save status</button>':'<span class="pill">'+esc(p.status)+'</span>';
   return '<tr><td style="max-width:230px;overflow-wrap:anywhere"><strong>'+esc(p.id)+'</strong><br>'+esc(new Date(p.createdAt).toLocaleString())+'</td><td style="min-width:200px;max-width:300px;white-space:pre-line"><strong>'+esc(p.name)+'</strong><br>'+esc(p.phone)+'<br>'+esc(p.email)+'<br>'+esc(p.address)+'</td><td>'+p.items.map(item=>'<div><strong>'+esc(item.name)+'</strong> ? '+item.quantity+'<br>'+money(item.unitPricePaise/100)+' each ? '+money(item.lineTotalPaise/100)+'</div>').join('')+'</td><td>'+money(p.totalPaise/100)+'</td><td>'+controls+'<p>'+esc(p.reference||'Waiting for payment reference')+'</p></td></tr>';
  }).join('');
 }catch(error){el('purchasesStatus').textContent=error.message}
}
el('refreshPurchases').addEventListener('click',loadPurchases);
el('purchaseRows').addEventListener('click',async event=>{
 const button=event.target.closest('[data-purchase-save]');if(!button)return;const id=button.dataset.purchaseSave;const status=button.closest('td').querySelector('select').value;button.disabled=true;
 try{const res=await authFetch('/api/admin/purchases/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not update purchase');await loadPurchases();toast('Purchase status updated')}
 catch(error){el('purchasesStatus').textContent=error.message}finally{button.disabled=false}
});
async function loadSubscribers(){
  el('subscriberRows').replaceChildren();el('subscriberStatus').textContent='Loading subscribers?';
  try{const res=await authFetch('/api/admin/newsletter',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Could not load subscribers');el('subscriberStatus').textContent=data.subscribers.length+' subscribers';el('subscriberRows').innerHTML=data.subscribers.map(row=>'<tr><td>'+esc(row.email)+'</td><td>'+esc(new Date(row.subscribedAt).toLocaleString())+'</td></tr>').join('');}
  catch(err){el('subscriberStatus').textContent=err.message;}
}
el('refreshSubscribers').addEventListener('click',loadSubscribers);
const nav=el('nav');nav.innerHTML=menus.map(([id,icon,label])=>`<button type="button" data-section="${id}"><span class="symbol">${icon}</span>${label}</button>`).join('');
let page='dashboard',editing=null,managerPage=0,auditOffset=0;
const recordPager=document.createElement('div');recordPager.className='toolbar';recordPager.innerHTML='<button class="btn" type="button" id="recordsPrevious">Previous</button><span id="recordsPage"></span><button class="btn" type="button" id="recordsNext">Next</button>';el('manager').append(recordPager);
el('recordsPrevious').onclick=()=>{managerPage=Math.max(0,managerPage-1);renderManager()};el('recordsNext').onclick=()=>{managerPage++;renderManager()};
async function loadOperations(){try{const res=await authFetch('/api/admin/operations',{cache:'no-store'}),data=await res.json();if(!res.ok)throw Error(data.error);el('operationsStatus').textContent=(data.backupConfigured?'Encrypted private backups configured. ':'Backup setup required. ')+(data.cronConfigured?'Scheduled maintenance enabled. ':'Scheduled maintenance needs configuration. ')+data.checks.map(x=>x.key+': '+x.status+' ('+new Date(x.updatedAt).toLocaleString()+')').join('; ');const events=await authFetch('/api/admin/audit?offset='+auditOffset,{cache:'no-store'}),log=await events.json();if(!events.ok)throw Error(log.error);el('auditRows').innerHTML=log.events.map(row=>'<tr><td>'+esc(new Date(row.created_at).toLocaleString())+'</td><td>'+esc(row.actor_id)+'</td><td>'+esc(row.action)+'</td><td>'+esc(row.target)+'</td></tr>').join('');el('auditPrevious').disabled=auditOffset===0;el('auditNext').disabled=log.events.length<100}catch(error){el('operationsStatus').textContent=error.message}}
el('refreshOperations').onclick=loadOperations;el('auditPrevious').onclick=()=>{auditOffset=Math.max(0,auditOffset-100);loadOperations()};el('auditNext').onclick=()=>{auditOffset+=100;loadOperations()};
el('runBackup').onclick=async()=>{el('runBackup').disabled=true;try{const res=await authFetch('/api/admin/backup',{method:'POST'});const data=await res.json();if(!res.ok)throw Error(data.status==='Setup required'?'Configure encrypted private backup storage before creating a backup.':data.error||'Backup failed');await loadOperations();toast('Encrypted backup completed')}catch(error){el('operationsStatus').textContent=error.message}finally{el('runBackup').disabled=false}};

function go(id){page=id;managerPage=0;if(id==='operations')loadOperations();if(id==='certificates')loadCertificates();if(id==='purchases')loadPurchases();if(id==='newsletter')loadSubscribers();for(const node of document.querySelectorAll('.section-panel'))node.hidden=true;el(schemas[id]?'manager':id).hidden=false;nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.section===id));let label=menus.find(x=>x[0]===id)?.[2]||'Dashboard';el('topTitle').textContent=id==='dashboard'?'Welcome, Admin':label;el('topSubtitle').textContent=id==='dashboard'?'Together in Seva, Building a Better Tomorrow':'BNK Seva Trust · Administration';if(id==='users')loadAdminUsers(false);if(schemas[id])renderManager();if(id==='dashboard')renderDashboard();if(id==='temple')renderTemple();if(id==='settings')renderPricingSettings();el('sidebar').classList.remove('open');el('overlay').classList.remove('show');window.scrollTo({top:0,behavior:'instant'})}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(b)go(b.dataset.section)});document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)});
el('menuBtn').onclick=()=>{el('sidebar').classList.add('open');el('overlay').classList.add('show')};el('overlay').onclick=()=>{el('sidebar').classList.remove('open');el('overlay').classList.remove('show')};if(el('profileBtn'))el('profileBtn').onclick=()=>toast('Admin profile · local preview only');el('loadContent').onclick=()=>{if(localStorage.getItem(KEY+'_unsaved')&&!confirm('Discard unsaved local edits and load the latest website records?'))return;localStorage.removeItem(KEY+'_unsaved');loadSiteContent(true)};el('publishContent').onclick=publishSiteContent;
function verified(){return state.records.donations.filter(r=>r.status==='Verified')}
function renderDashboard(){const donations=verified(),sum=donations.reduce((a,r)=>a+(Number(r.amount)||0),0),temple=donations.filter(r=>r.type==='Temple Project'||r.type==='Temple by Sq. Ft.').reduce((a,r)=>a+(Number(r.amount)||0),0),active=state.records.partners.filter(r=>r.status==='Active'),pct=state.goal?Math.min(100,temple/state.goal*100):0;
el('totalDonations').textContent=money(sum);el('donationFoot').textContent=donations.length+' verified donation(s)';el('templeTotal').textContent=money(temple);el('templeProgressFill').style.width=pct+'%';el('templeFundFoot').textContent=state.goal?`${pct.toFixed(1)}% of ${money(state.goal)} goal · ${money(Math.max(0,state.goal-temple))} remaining`:'Set your verified fundraising goal in Temple Project';el('partnerCount').textContent=active.length;el('partnerCount2').textContent=active.length;el('pledgeTotal').textContent=money(active.reduce((a,r)=>a+(Number(r.amount)||0),0));el('initiativeCount').textContent=state.records.initiatives.filter(r=>r.status==='Active').length;el('beneficiaryCount').textContent=state.records.beneficiaries.length;el('storyCount').textContent=state.records.stories.filter(r=>r.status==='Published').length;el('volunteerCount').textContent=state.records.volunteers.length;
const recent=[...donations].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);el('recentDonations').innerHTML=recent.length?recent.map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.amount)}</td><td>${esc(r.type)}</td><td>${esc(r.date)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No verified donations recorded yet.</td></tr>';
el('dashboardSteps').innerHTML=state.milestones.map((s,i)=>`<div class="step ${s.status==='Completed'?'done':''}"><div class="bubble">${s.status==='Completed'?'✓':i+1}</div><strong>${esc(s.name)}</strong></div>`).join('');renderChart();renderDonut(donations,sum)}
function renderChart(){const months=Number(el('chartRange').value)||6,don=verified(),now=new Date(),items=[];for(let i=months-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=d.toISOString().slice(0,7),total=don.filter(r=>String(r.date).slice(0,7)===key).reduce((a,r)=>a+(Number(r.amount)||0),0);items.push({name:d.toLocaleString('en-IN',{month:'short'}),total})}let max=Math.max(...items.map(d=>d.total),1);el('chart').innerHTML=items.map(d=>`<div class="chartbar" title="${esc(d.name)}: ${money(d.total)}"><div class="caption">${d.total?money(d.total):''}</div><div class="column" style="height:${Math.max(2,d.total/max*152)}px"></div><label>${esc(d.name)}</label></div>`).join('')}
el('chartRange').onchange=renderChart;
function renderDonut(don,sum){const sources=['Online','Seva Store','CSR','Direct Transfer','Others'],colors=['#800b23','#b45f22','#d5a05e','#dfbe95','#ece0d0'];let angle=0,parts=[],legend=[];sources.forEach((s,i)=>{const n=don.filter(x=>x.source===s).reduce((a,r)=>a+(Number(r.amount)||0),0),pct=sum?100*n/sum:0;parts.push(`${colors[i]} ${angle}% ${angle+pct}%`);angle+=pct;legend.push(`<div class="legend-line"><span><i class="dot" style="background:${colors[i]}"></i>${esc(s)}</span><strong>${pct.toFixed(0)}%</strong></div>`)});el('donut').style.background=sum?`conic-gradient(${parts.join(',')})`:'#eee7df';el('donutTotal').textContent=money(sum);el('legend').innerHTML=legend.join('')}
function renderManager(){const schema=schemas[page];el('managerTitle').textContent=schema.title;el('managerDesc').textContent=schema.desc;const query=el('search').value.trim().toLowerCase();const matches=state.records[page].filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(query)));managerPage=Math.min(managerPage,Math.max(0,Math.ceil(matches.length/50)-1));const records=matches.slice(managerPage*50,(managerPage+1)*50);el('recordCount').textContent=matches.length+' record(s)';el('recordsPage').textContent='Page '+(managerPage+1)+' of '+Math.max(1,Math.ceil(matches.length/50));el('recordsPrevious').disabled=managerPage===0;el('recordsNext').disabled=(managerPage+1)*50>=matches.length;const fields=(page==='csr'||page==='volunteers'||page==='initiatives'||page==='stories')?schema.fields:schema.fields.slice(0,4);el('managerHead').innerHTML=`<tr>${fields.map(f=>`<th>${esc(f[1])}</th>`).join('')}<th>Actions</th></tr>`;el('managerBody').innerHTML=records.length?records.map(r=>`<tr>${fields.map(f=>`<td>${f[0]==='amount'||f[0]==='price'?money(r[f[0]]):esc(r[f[0]])}</td>`).join('')}<td><div class="records-actions"><button class="btn tiny" data-edit="${esc(r.id)}">Edit</button><button class="btn tiny danger" data-delete="${esc(r.id)}">Delete</button></div></td></tr>`).join(''):`<tr><td colspan="${fields.length+1}" class="empty">No records yet. Click Add Record to begin.</td></tr>`}
el('search').addEventListener('input',()=>{managerPage=0;if(schemas[page])renderManager()});el('addRecord').onclick=()=>openRecord(null);
el('managerBody').onclick=e=>{const a=e.target.closest('[data-edit]'),b=e.target.closest('[data-delete]');if(a)openRecord(a.dataset.edit);if(b&&confirm('Delete this record?')){state.records[page]=state.records[page].filter(x=>x.id!==b.dataset.delete);save();renderManager();if(page==='users')saveAdminUsers();else persistRecord(page,b.dataset.delete,null,true)}};
function fieldMarkup([key,label,type,required,options],old){if(type==='select')return `<label class="field">${esc(label)}<select name="${key}" ${required?'required':''}><option value="">Select...</option>${options.map(x=>`<option value="${esc(x)}" ${old[key]===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;if(type==='textarea')return `<label class="field wide">${esc(label)}<textarea name="${key}" ${required?'required':''}>${esc(old[key]||'')}</textarea></label>`;if(key==='image')return `<label class="field wide">${esc(label)}<div class="upload-row"><input name="${key}" type="text" value="${esc(old[key]||'')}" placeholder="/uploads/image.jpg"><input class="image-file" type="file" accept="image/png,image/jpeg,image/webp"><button class="btn tiny upload-image" type="button">Upload</button></div><img class="upload-preview" src="${esc(old[key]||'')}" alt="" ${old[key]?'':'hidden'} decoding="async"></label>`;return `<label class="field">${esc(label)}<input name="${key}" type="${type}" ${type==='number'?'min="0" step="1"':''} ${required?'required':''} value="${esc(old[key]||'')}"></label>`}
function openRecord(id){editing=id;const schema=schemas[page];const old=state.records[page].find(x=>x.id===id)||(page==='store'?{status:'Active'}:{});el('dialogTitle').textContent=(id?'Edit ':'Add ')+schema.title.replace(/s$/,'');el('dialogFields').innerHTML=schema.fields.map(field=>fieldMarkup(field,old)).join('');el('recordDialog').showModal()}
el('dialogFields').addEventListener('click',async e=>{const button=e.target.closest('.upload-image');if(!button)return;const row=button.closest('.upload-row'),file=row.querySelector('.image-file').files[0],input=row.querySelector('input[type="text"]');if(!file)return toast('Choose an image first');button.disabled=true;button.textContent='Uploading...';try{const data=new FormData();data.append('image',file);const res=await authFetch('/api/admin/upload-image',{method:'POST',body:data});const result=await res.json().catch(()=>({}));if(!res.ok)throw Error(result.error||'Upload failed');input.value=result.url;const preview=button.closest('.field').querySelector('.upload-preview');preview.src=result.url;preview.hidden=false;toast('Image uploaded')}catch(err){toast(err.message)}finally{button.disabled=false;button.textContent='Upload'}});
el('closeDialog').onclick=()=>el('recordDialog').close();el('recordForm').onsubmit=async e=>{e.preventDefault();if(contentBusy)return;const records=state.records[page];const index=records.findIndex(x=>x.id===editing);const previous=index>=0?records[index]:{};const obj={...previous,...Object.fromEntries(new FormData(e.currentTarget))};obj.id=editing||'rec_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);if(index>=0)records[index]=obj;else records.push(obj);save();editing=obj.id;renderManager();if(page==='users'){await saveAdminUsers();el('recordDialog').close()}else if(await persistRecord(page,obj.id,obj))el('recordDialog').close()};
function renderTemple(){el('templeGoal').value=state.goal||'';el('templeNote').value=state.templeNote;el('milestoneEditor').innerHTML=state.milestones.map((s,i)=>`<div class="milestone"><span class="pill">STAGE ${i+1}</span><h3>${esc(s.name)}</h3><label class="field">Progress<select data-stage="${i}"><option ${s.status==='Upcoming'?'selected':''}>Upcoming</option><option ${s.status==='In Progress'?'selected':''}>In Progress</option><option ${s.status==='Completed'?'selected':''}>Completed</option></select></label><small>${i===0?'Vision is initially completed.':'Update only using verified project records.'}</small></div>`).join('')}
el('milestoneEditor').onchange=e=>{const s=e.target.closest('[data-stage]');if(s){state.milestones[Number(s.dataset.stage)].status=s.value;save()}};el('saveTemple').onclick=()=>{state.goal=Math.max(0,Number(el('templeGoal').value)||0);state.templeNote=el('templeNote').value.trim();save()};
function renderSettings(){if(!el('squareSettings')||!el('partnerSettings')||!el('donationPresets'))return;el('squareSettings').innerHTML=state.sqft.map((x,i)=>`<label class="field amount-edit"><span>${x.sqft} Sq. Ft.</span><input data-sqft="${i}" type="number" min="0" step="1" value="${Number(x.amount)}"></label>`).join('');el('partnerSettings').innerHTML=state.partnerAmounts.map((x,i)=>`<label class="field amount-edit"><span>Monthly option ${i+1}</span><input data-partner="${i}" type="number" min="0" step="1" value="${Number(x)}"></label>`).join('');el('donationPresets').value=state.donationPresets.join(', ')}
if(el('saveSettings'))el('saveSettings').onclick=()=>{state.sqft.forEach((x,i)=>x.amount=Math.max(0,Number(document.querySelector(`[data-sqft="${i}"]`).value)||0));state.partnerAmounts=state.partnerAmounts.map((_,i)=>Math.max(0,Number(document.querySelector(`[data-partner="${i}"]`).value)||0));const nums=el('donationPresets').value.split(',').map(x=>Number(x.trim())).filter(n=>Number.isFinite(n)&&n>0);if(!nums.length)return toast('Enter at least one valid donation amount');state.donationPresets=nums;save()};
function download(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportJson(){download('bnk-seva-admin-backup.json',JSON.stringify(state,null,2),'application/json')}
function csvSafeCell(value){const text=String(value??'');return /^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text)?"'"+text:text}
function exportCsv(category){const fields=schemas[category].fields.map(f=>f[0]),rows=[fields,...state.records[category].map(r=>fields.map(f=>r[f]||''))],csv=rows.map(r=>r.map(v=>'"'+csvSafeCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');download(`bnk-${category}.csv`,csv,'text/csv;charset=utf-8')}
if(el('backupTop'))el('backupTop').onclick=exportJson;if(el('exportJson'))el('exportJson').onclick=exportJson;if(el('exportDonations'))el('exportDonations').onclick=()=>exportCsv('donations');if(el('exportPartners'))el('exportPartners').onclick=()=>exportCsv('partners');if(el('importTrigger')&&el('importJson')){el('importTrigger').onclick=()=>el('importJson').click();el('importJson').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||typeof data!=='object'||!data.records||!Array.isArray(data.milestones))throw Error('Invalid data');if(!confirm('Replace all browser records with this backup?'))return;state=data;normalize();save();go('dashboard')}catch(err){toast('Import failed: invalid backup format')}finally{e.target.value=''}};}

// Website pricing is separate from this prototype's local management records.
// It loads from GET /api/pricing-config and saves through PUT /api/admin/pricing-config.
const pricingSponsorshipLabels={
 "temple-bell":"Temple Bell","murti-sthapana":"Murti Sthapana",
 "prayer-hall":"Prayer Hall","temple-garden":"Temple Garden",
 "main-entrance":"Main Entrance","marble-flooring":"Marble Flooring",
 "temple-lighting":"Temple Lighting","anna-seva-kitchen":"Prasad & Anna Seva Kitchen",
 "water-facility":"Water Facility","spiritual-library":"Spiritual Library",
 "community-hall":"Community Hall","satsang-space":"Satsang Space",
 "other-facilities":"Other Temple Facilities"
};
const pricingStoreLabels={
 box:"Baba Blessings Box",frame:"Neem Karoli Baba Photo Frame",chalisa:"Hanuman Chalisa",
 books:"Spiritual Books",mala:"Tulsi Mala",incense:"Sandalwood Incense",
 idol:"Devotional Idol",merch:"BNK Seva Trust T-Shirt"
};
const pricingDefaults={
 contributionOptions:[{sqft:1,amount:2500},{sqft:2,amount:5000},{sqft:5,amount:12500},
  {sqft:10,amount:25000},{sqft:20,amount:50000},{sqft:50,amount:125000},{sqft:100,amount:250000}],
 sponsorshipAmounts:Object.fromEntries(Object.keys(pricingSponsorshipLabels).map(k=>[k,null])),
 sevaDonationAmounts:[501,1001,2501,5001,11000],
 specialSevaChalisa:[{copies:108,amount:2100},{copies:216,amount:4200},
  {copies:501,amount:null},{copies:1008,amount:null}],
 sevaPartnerAmounts:[501,1001,2501],
 storePrices:{box:1499,frame:499,chalisa:299,books:399,mala:799,incense:349,idol:1499,merch:599}
};
let pricingConfig=null,pricingLoaded=false;
const pricingInt=v=>{if(String(v).trim()==='')return null;const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null};
function pricingMessage(message,type=''){
 const target=el('pricingStatus');
 if(!target)return;
 target.textContent=message;target.className='pricing-status '+type;
 const chip=el('pricingConnection');
 chip.textContent=pricingLoaded?'Server connected':'Preview only';
}
function pricingField(name,val,cls){
 const input=document.createElement('input');
 input.type='number';input.min='1';input.step='1';input.className=cls;input.value=val??'';
 const lab=document.createElement('label');lab.className='field';lab.textContent=name;lab.append(input);return lab;
}
function pricingRow(container,parts,removable=false){
 const row=document.createElement('div');row.className='pricing-row'+(removable?' three':'');
 parts.forEach(p=>row.append(p));
 if(removable){const b=document.createElement('button');b.type='button';b.className='btn tiny danger';b.textContent='Remove';b.onclick=()=>row.remove();row.append(b)}
 container.append(row);return row;
}
function pricingPlain(label){
 const span=document.createElement('div');span.className='pricing-row-title';span.textContent=label;return span;
}
function renderPricingSettings(config=pricingConfig||pricingDefaults){
 pricingConfig={
 contributionOptions:(config.contributionOptions||pricingDefaults.contributionOptions).map(x=>({...x})),
 sponsorshipAmounts:{...pricingDefaults.sponsorshipAmounts,...config.sponsorshipAmounts},
 sevaDonationAmounts:[...(config.sevaDonationAmounts||pricingDefaults.sevaDonationAmounts)],
 specialSevaChalisa:(config.specialSevaChalisa||pricingDefaults.specialSevaChalisa).map(x=>({...x})),
 sevaPartnerAmounts:[...(config.sevaPartnerAmounts||pricingDefaults.sevaPartnerAmounts)],
 storePrices:{...pricingDefaults.storePrices,...config.storePrices}
 };
 for(const id of ['pricingSqft','pricingSeva','pricingSponsorship','pricingStore','pricingChalisa','pricingPartner'])el(id).replaceChildren();
 pricingConfig.contributionOptions.forEach(x=>pricingRow(el('pricingSqft'),
  [pricingField('Square feet',x.sqft,'sqft'),pricingField('Amount (₹)',x.amount,'amount')],true));
 for(let i=0;i<5;i++)pricingRow(el('pricingSeva'),[pricingPlain('Button '+(i+1)),
  pricingField('Amount (₹)',pricingConfig.sevaDonationAmounts[i],'amount')]);
 Object.entries(pricingSponsorshipLabels).forEach(([id,name])=>{
  const row=pricingRow(el('pricingSponsorship'),[pricingPlain(name),pricingField('Amount (₹)',pricingConfig.sponsorshipAmounts[id],'amount')]);row.dataset.id=id;
 });
 Object.entries(pricingStoreLabels).forEach(([id,name])=>{
  const row=pricingRow(el('pricingStore'),[pricingPlain(name),pricingField('Price (₹)',pricingConfig.storePrices[id],'amount')]);row.dataset.id=id;
 });
 pricingConfig.specialSevaChalisa.forEach(x=>pricingRow(el('pricingChalisa'),
  [pricingField('Copies',x.copies,'copies'),pricingField('Amount (₹)',x.amount,'amount')]));
 for(let i=0;i<3;i++)pricingRow(el('pricingPartner'),[pricingPlain('Monthly option '+(i+1)),
  pricingField('Amount (₹)',pricingConfig.sevaPartnerAmounts[i],'amount')]);
}
function pricingCollect(){
 const rows=id=>[...el(id).querySelectorAll('.pricing-row')];
 const required=(value,label)=>{const n=pricingInt(value);if(n===null)throw Error('Enter a valid positive whole-number amount for '+label);return n};
 const contributionOptions=rows('pricingSqft').map(r=>({
  sqft:required(r.querySelector('.sqft').value,'square feet'),
  amount:required(r.querySelector('.amount').value,'contribution')
 }));
 if(!contributionOptions.length)throw Error('Add at least one square-foot contribution option');
 const sqftValues=contributionOptions.map(r=>r.sqft);
 if(new Set(sqftValues).size!==sqftValues.length)throw Error('Square-foot options must be unique');
 const sevaDonationAmounts=rows('pricingSeva').map((r,i)=>required(r.querySelector('.amount').value,'Seva button '+(i+1)));
 const sevaPartnerAmounts=rows('pricingPartner').map((r,i)=>required(r.querySelector('.amount').value,'monthly option '+(i+1)));
 const sponsorshipAmounts=Object.fromEntries(rows('pricingSponsorship').map(r=>[r.dataset.id,pricingInt(r.querySelector('.amount').value)]));
 const storePrices=Object.fromEntries(rows('pricingStore').map(r=>[r.dataset.id,required(r.querySelector('.amount').value,'store price')]));
 const specialSevaChalisa=rows('pricingChalisa').map(r=>({
  copies:required(r.querySelector('.copies').value,'Hanuman Chalisa copies'),
  amount:pricingInt(r.querySelector('.amount').value)
 }));
 return {contributionOptions,sevaDonationAmounts,sponsorshipAmounts,storePrices,specialSevaChalisa,sevaPartnerAmounts};
}
async function pricingLoad(){
 pricingMessage('Loading website prices…');
 try{
  const res=await fetch('/api/pricing-config',{cache:'no-store'});
  if(!res.ok)throw Error('Pricing API unavailable (HTTP '+res.status+').');
  const cfg=await res.json();
  pricingLoaded=true;renderPricingSettings(cfg);
  pricingMessage('Live website pricing loaded successfully.','success');
 }catch(e){pricingLoaded=false;pricingMessage(e.message+' Showing editable defaults until the server is available.','error')}
}
async function pricingSave(){
 if(location.protocol==='file:')return pricingMessage('Run the website through its HTTP server before saving.','error');
 let config;
 try{config=pricingCollect()}catch(e){return pricingMessage(e.message,'error')}
 el('pricingSave').disabled=true;el('pricingLoad').disabled=true;
 pricingMessage('Saving website prices…');
 try{
  const res=await authFetch('/api/admin/pricing-config',{
   method:'PUT',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(config)
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(result.error||'Save failed (HTTP '+res.status+').');
  pricingLoaded=true;renderPricingSettings(result);
  pricingMessage('Saved to the website pricing API. Refresh the public website to see the updated prices.','success');
 }catch(e){pricingMessage(e.message,'error')}
 finally{el('pricingSave').disabled=false;el('pricingLoad').disabled=false}
}
el('pricingLoad').addEventListener('click',pricingLoad);
el('pricingSave').addEventListener('click',pricingSave);
el('pricingAddSqft').addEventListener('click',()=>{
 pricingRow(el('pricingSqft'),[pricingField('Square feet','','sqft'),pricingField('Amount (₹)','','amount')],true);
});
renderPricingSettings();
pricingLoad();
checkSession();

go('dashboard');
