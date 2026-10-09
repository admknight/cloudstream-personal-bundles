import {decodeSelection} from './selection.js';
import {getCatalog} from './catalog.js';
import {page} from './ui.js';

const PUBLIC_PAGE_HEADERS = {'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store'};
const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=120','X-Robots-Tag':'noindex, nofollow'};
function json(payload, status = 200, headers = JSON_HEADERS) {
  return new Response(JSON.stringify(payload),{status,headers});
}
function error(status, message) {return json({error:message},status,{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});}
function entries(catalog, keys, mode) {
  const selected = keys.map(k=>catalog.byKey.get(k)).filter(Boolean);
  if (!selected.length) return [];
  return selected.filter(p=>mode==='all'||(mode==='sfw'?!p.adult:p.adult)).map(p=>p.source);
}
function makeManifest(origin, token, mode, missing) {
  const names={all:'Personal Selection',sfw:'SFW-labeled Selection',nsfw:'NSFW-labeled Selection'};
  return {name:'Adam Knight - '+names[mode],description:'Personal selection from the published Adam Knight MegaRepo catalog. Extensions are not automatically installed.'+(missing?' '+missing+' previously selected extension(s) are no longer available; rebuild your selection to refresh this link.':''),manifestVersion:1,pluginLists:[`${origin}/b/${token}/${mode}/plugins.json`]};
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return error(405,'Method not allowed');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = new Response(page, {headers:{...PUBLIC_PAGE_HEADERS,'Content-Type':'text/html; charset=utf-8',
        'Content-Security-Policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
      return request.method==='HEAD'?new Response(null,{headers:html.headers}):html;
    }
    const catalogRoute = url.pathname === '/api/catalog';
    const match = /^\/b\/([A-Za-z0-9_-]{12,1100})\/(all|sfw|nsfw)\/(repo|plugins)\.json$/.exec(url.pathname);
    if (!catalogRoute && !match) return error(404,'Not found');
    if (url.search) return error(400,'Unexpected query');
    let keys;
    if (match) {
      try {keys = decodeSelection(match[1]);}
      catch {return error(400,'Invalid bundle link');}
    }
    try {
      const catalog = await getCatalog();
      if (catalogRoute) {
        const visible = catalog.items.map(p => ({
          id:p.key,name:p.source.name,description:typeof p.source.description==='string'?p.source.description:'',
          internalName:p.source.internalName,language:typeof p.source.language==='string'?p.source.language:'',
          tvTypes:Array.isArray(p.source.tvTypes)?p.source.tvTypes:[],version:p.source.version,adult:p.adult,
          status:p.source.status
        }));
        return json({source:'Adam Knight MegaRepo',count:visible.length,updatedAt:catalog.updatedAt,plugins:visible},200,{...JSON_HEADERS,'Cache-Control':'public, max-age=120'});
      }
      const [token,mode,file] = match.slice(1);
      const found = keys.filter(key=>catalog.byKey.has(key));
      if (!found.length) return error(410,'None of the selected extensions remain available in MegaRepo. Create a new bundle.');
      const missing = keys.length - found.length;
      const chosen = entries(catalog,found,mode);
      if (!chosen.length) return error(422,'No extensions match this selection and content filter');
      const headers = {...JSON_HEADERS,'X-Bundle-Missing':String(missing)};
      return json(file==='repo'?makeManifest(url.origin,token,mode,missing):chosen,200,headers);
    } catch {
      return error(503,'MegaRepo catalog unavailable. Try again later.');
    }
  }
};
