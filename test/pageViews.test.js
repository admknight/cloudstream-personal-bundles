import test from 'node:test';
import assert from 'node:assert/strict';
import {isSiteViewPath,siteViewResponse} from '../src/pageViews.js';
const validSvg='<svg xmlns="http://www.w3.org/2000/svg"><title>Page views: 37</title></svg>';

test('each route retains the exact original external counter ID',async()=>{
 const ids=new Map([
  ['portfolio','admknight.github.io.svg'],
  ['megarepo','admknight.github.io/CloudstreamExtensions.svg'],
  ['explorer','admknight.github.io/CloudstreamExtensions/explore.html.svg'],
  ['builder','adam-cloudstream-bundles.badass-insane.workers.dev.svg']
 ]);
 for(const [name,id] of ids){
  const path='/assets/site-views/'+name+'.svg';
  assert.equal(isSiteViewPath(path),true);
  const response=await siteViewResponse(path,'GET',async url=>{
    assert.ok(url.startsWith('https://hits.sh/'+id+'?style=flat-square&label=Page+views'));
    return new Response(validSvg,{headers:{'content-type':'image/svg+xml; charset=utf-8'}});
  });
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Page-Views-Status'),'ok');
  assert.match(response.headers.get('Content-Type'),/image\/svg\+xml/);
  assert.match(await response.text(),/>37<\/text>/);
 }
});

test('backend failure leaves a visible honest badge',async()=>{
 const response=await siteViewResponse('/assets/site-views/portfolio.svg','GET',async()=>{throw Error('down');});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('X-Page-Views-Status'),'unavailable');
 const result=await response.text();
 assert.match(result,/PAGE VIEWS/);
 assert.match(result,/unavailable/);
});

test('malicious or non-SVG response never reaches the browser',async()=>{
 const response=await siteViewResponse('/assets/site-views/explorer.svg','GET',async()=>new Response('<svg><script>alert(1)</script></svg>',{headers:{'Content-Type':'image/svg+xml'}}));
 assert.equal(response.headers.get('X-Page-Views-Status'),'unavailable');
 assert.doesNotMatch(await response.text(),/<script/);
});

test('HEAD cannot count an extra visit and unknown routes are disallowed',async()=>{
 const response=await siteViewResponse('/assets/site-views/portfolio.svg','HEAD',async()=>{throw Error('HEAD must not fetch');});
 assert.equal(response.status,200);
 assert.equal(await response.text(),'');
 assert.equal(response.headers.get('X-Page-Views-Status'),'head-only');
 assert.equal(isSiteViewPath('/assets/site-views/nope.svg'),false);
});
