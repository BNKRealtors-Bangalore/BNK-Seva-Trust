"use strict";
// All writes use a disposable local SQLite database; no production accounts or mail.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {chromium}=require("@playwright/test");
const filename=path.join(os.tmpdir(),"bnk-browser-"+crypto.randomUUID()+".sqlite");
Object.assign(process.env,{DATABASE_PATH:filename,TURSO_DATABASE_URL:"",TURSO_AUTH_TOKEN:"",VERCEL:"",ADMIN_EMAIL:"browser@example.org",ADMIN_PASSWORD:"browser-test-password",CERTIFICATE_EMAIL_ENABLED:"false"});
const app=require("../server.cjs");
(async()=>{
 let browser;
 try{
  await app.initialize();const content=await app.getSiteContent();content.records.store=[{id:"box",name:"Browser Test Box",price:101,stock:2,status:"Active",image:"images/favicon_logo.png"}];await app.saveSiteContent(content);
  await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));const base="http://127.0.0.1:"+app.server.address().port;
  browser=await chromium.launch({executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",headless:true});
  const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[],missing=[];
  page.on("pageerror",error=>errors.push(error.stack||error.message));page.on("response",response=>{if(response.url().startsWith(base)&&response.status()===404)missing.push(new URL(response.url()).pathname)});
  await page.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)\.com\//,route=>route.abort());
  await page.goto(base+"/#store");
  await page.locator('#store button[data-add="box"]').first().click();
  await page.locator('#floatingCartButton').click();
  assert.ok(await page.locator('#drawer').evaluate(node=>node.getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom-1));
  await page.locator('#checkoutButton').click();
  await page.locator('#purchaseForm [name="name"]').fill("Browser Buyer");await page.locator('#purchaseForm [name="phone"]').fill("9876543210");await page.locator('#purchaseForm [name="email"]').fill("buyer@example.org");await page.locator('#purchaseForm [name="address"]').fill("Test Address");
  await page.locator('#purchaseForm button[type="submit"]').click();await page.locator('#purchasePayment').waitFor({state:"visible"});
  await page.reload();await page.locator('.purchase-resume').click();await page.locator('#purchasePayment').waitFor({state:"visible"});
  assert.ok(await page.locator('.purchase-qr').evaluate(image=>image.complete&&image.naturalWidth>0));
  await page.locator('#purchaseReference').fill("UPI-BROWSER-100");await page.locator('#purchasePaid').click();await page.getByText(/payment is pending verification by the Trust/).waitFor();
  await page.goto(base+"/admin.html");await page.locator('#loginEmail').fill("browser@example.org");await page.locator('#loginPassword').fill("browser-test-password");await page.locator('#loginForm button[type="submit"]').click();await page.locator('#authScreen').waitFor({state:"hidden"});
  await page.locator('[data-section="purchases"]').click();await page.getByText("Browser Buyer",{exact:true}).waitFor();
  await page.locator('[data-section="store"]').click();await page.locator('[data-edit="box"]').click();await page.locator('#recordForm [name="name"]').fill("Updated Browser Box");await page.locator('#recordForm button[type="submit"]').click();await page.locator('#recordDialog').waitFor({state:"hidden"});await page.getByText("Updated Browser Box",{exact:true}).waitFor();
  await page.locator('[data-section="operations"]').click();await page.getByText("Backup setup required.",{exact:false}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.goto(base+"/#store");await page.locator('#store button[data-add="box"]').first().click();await page.locator('#floatingCartButton').click();await page.waitForFunction(()=>{const r=document.getElementById('drawer').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.width>0});
  fs.mkdirSync(path.resolve(__dirname,"../artifacts"),{recursive:true});await page.screenshot({path:path.resolve(__dirname,"../artifacts/cart-mobile.png")});
  assert.deepEqual(errors,[],"Browser runtime errors");assert.deepEqual([...new Set(missing)],[],"Missing local assets");
  console.log("Browser smoke passed: desktop checkout, QR, refresh recovery, pending purchase in admin, record save, operations status, and mobile cart. No runtime errors or missing local assets.");
 }finally{
  await browser?.close();if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));app.closeDatabase();for(const suffix of ["","-wal","-shm"])fs.rmSync(filename+suffix,{force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
