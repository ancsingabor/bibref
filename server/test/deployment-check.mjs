// Lightweight post-deploy smoke check; no corpus is downloaded by the client.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.BIBREF_WEB_URL;
assert.ok(base, 'Set BIBREF_WEB_URL');
let cookie;
async function request(route, method='GET', body) {
 const response=await fetch(new URL(route,base),{method,headers:{Origin:new URL(base).origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(process.env.VERCEL_OIDC_TOKEN?{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
 assert.ok(response.ok, `${route}: HTTP ${response.status}`);return response;
}
const meta=await (await request('/api/meta')).json();
assert.deepEqual(meta.modules.map(m=>m.name).sort(),['Aleppo','HunRUF','KJV','LXX','SBLGNT','StatResGNT']);
const session=await (await request('/api/sessions','POST',{})).json();
const started=performance.now();
const body={requestId:randomUUID(),revision:0,command:'lookup HunRUF Matthew 1:1'};
const text=await (await request(`/api/sessions/${session.id}/commands`,'POST',body)).text();
const frames=text.trim().split('\n\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)));
assert.equal(frames.at(-1).type,'completed');
assert.ok(frames.some(e=>e.text?.includes('Jézus')));
const elapsedMs=Math.round(performance.now()-started);
const restored=await (await request(`/api/sessions/${session.id}`)).json();assert.equal(restored.revision,1);
await request(`/api/sessions/${session.id}`,'DELETE',{});
console.log(JSON.stringify({url:base,engineVersion:meta.engineVersion,modules:meta.modules.map(m=>m.name),lookupMs:elapsedMs,status:'passed'}));
