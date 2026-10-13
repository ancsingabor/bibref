import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.BIBREF_WEB_URL || 'http://127.0.0.1:8090/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
if(process.env.VERCEL_OIDC_TOKEN && url.startsWith('https://')) {
 const origin=new URL(url).origin;
 await context.route(origin+'/**',r=>r.continue({headers:{...r.request().headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}}));
}
const page=await context.newPage();
try {
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Connected');
 for(const command of ['latintext1 '+('abc'.repeat(20000)), 'latintext2 '+('abc'.repeat(1000))]) {
  await page.evaluate(async c=>{await window.bibrefTerminal.exec(c);},command);
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Connected');
 }
 const response=page.waitForResponse(r=>r.url().endsWith('/commands') && r.request().method()==='POST');
 const executing=page.evaluate(async()=>{await window.bibrefTerminal.exec('nearest12');});
 const request=await response;const requestId=request.request().postDataJSON().requestId;
 await page.locator('#cancel').click();
 await executing;
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Connected',{timeout:15000});
 const restored=await page.evaluate(async requestId=>{
  const id=sessionStorage.getItem('bibref-session');
  return {session:await (await fetch(`/api/sessions/${id}`)).json(),result:await (await fetch(`/api/sessions/${id}/commands/${requestId}`)).json()};
 },requestId);
 assert.equal(restored.result.record.code,'cancelled');
 assert.equal(restored.session.state.text[0].length,60000);assert.equal(restored.session.state.text[1].length,3000);
 assert.equal(restored.session.active,null);
 await page.evaluate(async()=>{const id=sessionStorage.getItem('bibref-session');await fetch(`/api/sessions/${id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'});});
 console.log(JSON.stringify({url,status:'native nearest12 cancelled through UI; clipboards retained',durationMs:restored.result.record.durationMs}));
} finally {await browser.close();}
