import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {clearCatalogCacheForTest,normalizeCatalog,CATALOG_URL} from '../src/catalog.js';
import {encodeSelection,pluginKey} from '../src/selection.js';

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;clearCatalogCacheForTest();});

const plugins=[
 {name:'Open Movie',internalName:'OpenMovie',url:'https://example.org/OpenMovie.cs3',status:1,version:4,apiVersion:1,authors:['A'],tvTypes:['Movie'],language:'hi',fileHash:'sha256-aabb'},
 {name:'18+ Adult Test',internalName:'AdultPlugin',url:'https://example.org/AdultPlugin.cs3',status:1,version:9,apiVersion:1,authors:['B'],tvTypes:['NSFW'],language:'en'},
 {name:'Down Test',internalName:'DownPlugin',url:'https://example.org/DownPlugin.cs3',status:0,version:1,apiVersion:1,authors:['C'],tvTypes:['TvSeries'],language:'ar'},
 {name:'Beta Series',internalName:'BetaSeries',url:'https://example.org/BetaSeries.cs3',status:3,version:7,apiVersion:1,authors:['D'],tvTypes:['TvSeries'],language:'de'}
];
function mockCatalog(data=plugins){globalThis.fetch=async (url)=>{assert.equal(url,CATALOG_URL);return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}})};}
const url=(t,mode,part)=>`https://demo.example.workers.dev/b/${t}/${mode}/${part}.json`;
const token=encodeSelection([pluginKey('OpenMovie'),pluginKey('AdultPlugin'),pluginKey('BetaSeries')]);
async function respond(path,opts){return worker.fetch(new Request(path,opts));}

test('catalog shows usable plugin metadata only and hides down entries',async()=>{
 mockCatalog();const r=await respond('https://demo.example.workers.dev/api/catalog');
 assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.count,3);assert.equal(data.plugins.length,3);
 assert.deepEqual(data.plugins.map(x=>x.id).sort(),[pluginKey('OpenMovie'),pluginKey('AdultPlugin'),pluginKey('BetaSeries')].sort());
 assert.equal(data.plugins.some(x=>x.internalName==='DownPlugin'),false);
 assert.equal(data.plugins.some(x=>x.url),false);
 assert.equal(data.plugins.find(x=>x.internalName==='AdultPlugin').adult,true);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');
});

test('generates installable repo.json and keeps upstream package entries unchanged',async()=>{
 mockCatalog();const r=await respond(url(token,'all','repo'));
 assert.equal(r.status,200);
 const manifest=await r.json();
 assert.equal(manifest.manifestVersion,1);
 assert.deepEqual(manifest.pluginLists,[url(token,'all','plugins')]);
 assert.match(manifest.name,/Adam Knight/);
 const pluginsResponse=await respond(manifest.pluginLists[0]);
 assert.equal(pluginsResponse.status,200);
 const listed=await pluginsResponse.json();
 assert.deepEqual(listed.slice().sort((a,b)=>a.internalName.localeCompare(b.internalName)),plugins.filter(p=>p.status!==0).sort((a,b)=>a.internalName.localeCompare(b.internalName)));
 assert.equal(listed[0].fileHash,'sha256-aabb');
 assert.match(r.headers.get('X-Robots-Tag'),/noindex/);
 assert.match(pluginsResponse.headers.get('X-Robots-Tag'),/noindex/);
});

test('bundles continue to serve surviving selections when an upstream plugin disappears',async()=>{
 mockCatalog();
 const mixed=encodeSelection([pluginKey('OpenMovie'),pluginKey('NoLongerHere')]);
 const manifestResponse=await respond(url(mixed,'all','repo'));
 assert.equal(manifestResponse.status,200);
 assert.equal(manifestResponse.headers.get('X-Bundle-Missing'),'1');
 const manifest=await manifestResponse.json();
 assert.match(manifest.description,/no longer available/);
 const listing=await (await respond(manifest.pluginLists[0])).json();
 assert.deepEqual(listing.map(p=>p.internalName),['OpenMovie']);
});

test('SFW and NSFW links include only explicitly selected matching entries',async()=>{
 mockCatalog();
 const sfw=await (await respond(url(token,'sfw','plugins'))).json();
 assert.deepEqual(sfw.map(x=>x.internalName).sort(),['BetaSeries','OpenMovie']);
 const nsfw=await (await respond(url(token,'nsfw','plugins'))).json();
 assert.deepEqual(nsfw.map(x=>x.internalName),['AdultPlugin']);
});

test('empty mode, removed plugins and malformed tokens fail closed',async()=>{
 mockCatalog();const onlyMovie=encodeSelection([pluginKey('OpenMovie')]);
 assert.equal((await respond(url(onlyMovie,'nsfw','repo'))).status,422);
 const gone=encodeSelection([pluginKey('NoLongerHere')]);
 assert.equal((await respond(url(gone,'all','plugins'))).status,410);
 assert.equal((await respond(url('AAAAAAAAAAAA','all','repo'))).status,400);
 assert.equal((await respond('https://demo.example.workers.dev/unknown')).status,404);
 assert.equal((await respond('https://demo.example.workers.dev/api/catalog',{method:'POST'})).status,405);
 assert.equal((await respond('https://demo.example.workers.dev/api/catalog?source=https://evil.example')).status,400);
});

test('frontend is served with no third party scripts and restrictive browser headers',async()=>{
 const r=await respond('https://demo.example.workers.dev/');
 assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/<title>Choose Your CloudStream Plugins/);
 assert.match(html,/Create my repository link/);
 assert.match(html,/Three steps to use a personal CloudStream repository/);
 assert.match(html,/id="about"/);
 assert.match(html,/A MegaRepo companion, not a replacement/);
 assert.match(html,/href="#about">About<\/a>/);
 const links = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
 assert.ok(links.length >= 10, 'Expected navigation links on Builder page');
 for (const link of links) {
   const href = link.match(/href="([^"]+)"/)?.[1];
   if (!href) continue;
   if (href.startsWith('https://')) {
     assert.match(link,/target="_blank"/,'Separate sites should open in a new tab');
     assert.match(link,/rel="noopener noreferrer"/,'New-tab links should be opener-isolated');
   } else if (href.startsWith('#')) {
     assert.doesNotMatch(link,/target="_blank"/,'On-page links must stay in the current tab');
   }
 }
 assert.match(html,/open.href='cloudstreamrepo:\/\//,'CloudStream deep links should keep their app handoff');
 assert.match(html,/<link rel="icon" type="image\/png" href="https:\/\/raw\.githubusercontent\.com\/admknight\/CloudstreamExtensions\/refs\/heads\/master\/assets\/icon\.png">/);
 assert.match(html,/<link rel="apple-touch-icon"/);
 assert.match(html,/<a class="brand"[^>]+><img src="https:\/\/raw\.githubusercontent\.com\/admknight\/CloudstreamExtensions\/refs\/heads\/master\/assets\/icon\.png"/);
 assert.match(html,/<a href="https:\/\/admknight\.github\.io\/">Portfolio<\/a>/);
 assert.match(html,/Install only the extensions you choose|Your CloudStream plugins/);
 assert.equal(r.headers.get('X-Robots-Tag'),null);
 assert.match(html,/cloudstreamrepo:\/\//);
 assert.equal(html.includes('<script src='),false);
 assert.match(r.headers.get('Content-Security-Policy'),/connect-src 'self'/);
 assert.match(r.headers.get('Content-Security-Policy'),/img-src 'self' data: https:\/\/raw\.githubusercontent\.com/);
 assert.match(r.headers.get('Content-Security-Policy'),/default-src 'none'/);
 const head=await respond('https://demo.example.workers.dev/',{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('invalid upstream data or outages do not publish false bundles',async()=>{
 mockCatalog([{...plugins[0], url:'javascript:evil'}]);
 assert.equal((await respond('https://demo.example.workers.dev/api/catalog')).status,503);
 clearCatalogCacheForTest();
 globalThis.fetch=async()=>new Response('error',{status:503});
 assert.equal((await respond(url(token,'all','repo'))).status,503);
});

test('duplicate internal names and ambiguous keys fail closed',()=>{
 assert.throws(()=>normalizeCatalog([plugins[0], {...plugins[0],name:'Copy'}]),/Ambiguous/);
});
