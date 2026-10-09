// Server-side proxy for the four existing hits.sh counters.
// IDs are fixed; visitors cannot supply an upstream URL.
const COUNTERS = new Map([
  ['/assets/site-views/portfolio.svg', 'admknight.github.io.svg'],
  ['/assets/site-views/megarepo.svg', 'admknight.github.io/CloudstreamExtensions.svg'],
  ['/assets/site-views/explorer.svg', 'admknight.github.io/CloudstreamExtensions/explore.html.svg'],
  ['/assets/site-views/builder.svg', 'adam-cloudstream-bundles.badass-insane.workers.dev.svg']
]);
const STYLE = '?style=flat-square&label=Page+views&color=43a7ff&labelColor=18263a';
const HEADERS = {
  'Content-Type':'image/svg+xml; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':'no-store',
  'X-Robots-Tag':'noindex, nofollow'
};
export function isSiteViewPath(path) {return COUNTERS.has(path);}

function visibleSvg(count) {
  const label = count === null ? 'unavailable' : count;
  const title = 'Page views: ' + label;
  const ink = count === null ? '#ffcc84' : '#79caff';
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="164" height="25" viewBox="0 0 164 25" role="img" aria-label="' + title + '">',
    '<title>' + title + '</title>',
    '<rect x="0.5" y="0.5" width="163" height="24" rx="5.5" fill="#102339" stroke="#38516b"/>',
    '<text x="11" y="16.5" font-size="10" font-weight="700" font-family="Arial,Helvetica,sans-serif" letter-spacing=".6" fill="#a9bfd6">PAGE VIEWS</text>',
    '<text x="153" y="16.5" font-size="11" text-anchor="end" font-weight="700" font-family="Arial,Helvetica,sans-serif" fill="' + ink + '">' + label + '</text>',
    '</svg>'
  ].join('');
}
function extractCount(body) {
  const title = body.match(/<title>\s*Page views:\s*([^<]+)\s*<\/title>/i);
  if (!title) return null;
  const count = title[1].trim();
  return /^[0-9][0-9,]*(?:\.[0-9]+)?[kKmM]?$/.test(count) ? count : null;
}

export async function siteViewResponse(path, method, fetcher = fetch) {
  const id = COUNTERS.get(path);
  if (!id) return new Response('Not found',{status:404});
  // HEAD must not increment any visit counter.
  if (method === 'HEAD') return new Response(null,{headers:{...HEADERS,'X-Page-Views-Status':'head-only'}});
  let count = null;
  try {
    const upstream = await fetcher('https://hits.sh/' + id + STYLE, {
      headers:{'Accept':'image/svg+xml'},signal:AbortSignal.timeout(7000)
    });
    if (upstream.ok && (upstream.headers.get('content-type') || '').includes('image/svg+xml')) {
      count = extractCount(await upstream.text());
    }
  } catch {
    // The locally rendered badge must remain visible when upstream is blocked.
  }
  return new Response(visibleSvg(count),{
    headers:{...HEADERS,'X-Page-Views-Status':count === null ? 'unavailable' : 'ok'}
  });
}
