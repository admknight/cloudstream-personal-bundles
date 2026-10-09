from playwright.sync_api import sync_playwright
import urllib.request,json,re
ROOT='http://127.0.0.1:8787/'
fixture=json.load(urllib.request.urlopen(ROOT+'api/catalog'))
source=urllib.request.urlopen(ROOT).read().decode('utf-8')
# Browser egress is blocked in this environment, so inject a mocked catalog
# into a local rendered page; API endpoint tests use the real mock HTTP adapter.
inject='<script>window.fetch=async()=>new Response(JSON.stringify('+json.dumps(fixture,separators=(',',':'))+'),{status:200,headers:{"Content-Type":"application/json"}});</script>'
source=source.replace('<script>\n(() => {',inject+'<script>\n(() => {',1)
# Test-only location override, the actual deployed source uses location.origin/host.
source=source.replace("location.origin+'/b/'","'https://mock.workers.dev'+'/b/'")
source=source.replace("location.host+'/b/'","'mock.workers.dev'+'/b/'")

def await_load(page):
    page.wait_for_function("document.querySelector('#summary')?.textContent?.includes('matching')", timeout=15000)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    desktop=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]; desktop.on('pageerror',lambda error:errors.append(str(error)))
    desktop.set_content(source,wait_until='domcontentloaded')
    await_load(desktop)
    summary=desktop.locator('#summary').inner_text()
    assert '53 available' in summary,summary
    assert desktop.locator('article.card').count()==24
    assert not desktop.get_by_text('NSFW Test Plugin').is_visible()
    desktop.locator('#search').fill('Open Movie')
    assert '1 matching' in desktop.locator('#summary').inner_text()
    desktop.locator('article.card').get_by_role('button',name='Select Open Movie').click()
    assert desktop.locator('#selection').inner_text()=='1'
    assert desktop.locator('#build').is_enabled()
    desktop.locator('#build').click()
    assert desktop.locator('#bundle').is_visible()
    fields=desktop.locator('#modes input')
    assert fields.count()==2,fields.count()
    full=fields.first.input_value()
    assert full.startswith('https://mock.workers.dev/b/') and full.endswith('/all/repo.json'),full
    local=full.replace('https://mock.workers.dev',ROOT[:-1])
    manifest=json.load(urllib.request.urlopen(local))
    listing=json.load(urllib.request.urlopen(manifest['pluginLists'][0].replace('http://127.0.0.1:8787','http://127.0.0.1:8787')))
    assert len(listing)==1 and listing[0]['internalName']=='OpenMovie',listing
    assert not desktop.evaluate('window.evil===true')
    desktop.locator('#search').fill('img src')
    assert desktop.locator('article.card').count()==1
    assert desktop.locator('article.card img').count()==0
    assert not desktop.evaluate('window.evil===true')
    desktop.locator('#search').fill('')
    desktop.locator('#adult').check()
    desktop.locator('#search').fill('NSFW Test Plugin')
    desktop.locator('article.card').get_by_role('button',name='Select NSFW Test Plugin').click()
    desktop.locator('#build').click()
    assert desktop.locator('#modes input').count()==3
    nsfw=desktop.locator('#modes input').last.input_value()
    man=json.load(urllib.request.urlopen(nsfw.replace('https://mock.workers.dev',ROOT[:-1])))
    listing=json.load(urllib.request.urlopen(man['pluginLists'][0]))
    assert len(listing)==1 and listing[0]['internalName']=='NSFWPlugin',listing
    desktop.locator('#search').fill('')
    desktop.locator('#adult').uncheck()
    desktop.screenshot(path='/mnt/data/cloudstream-personal-bundles/desktop-preview.png',full_page=True)

    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mobileErrors=[]; mobile.on('pageerror',lambda e:mobileErrors.append(str(e)))
    mobile.set_content(source,wait_until='domcontentloaded')
    await_load(mobile)
    assert mobile.locator('article.card').count()==12
    assert mobile.locator('#next').is_enabled()
    mobile.locator('#next').click()
    assert 'Page 2' in mobile.locator('#page').inner_text()
    overflow=mobile.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    assert not overflow
    mobile.screenshot(path='/mnt/data/cloudstream-personal-bundles/mobile-preview.png',full_page=True)
    assert errors==[] and mobileErrors==[],(errors,mobileErrors)
    mobile.evaluate("window.fetch=async()=>new Response('{}',{status:503})")
    mobile.locator('#reload').click()
    mobile.wait_for_function("document.querySelector('#message')?.textContent?.includes('Catalog unavailable')",timeout=5000)
    print('PASS desktop 53 available; 24/page; adult hidden by default')
    print('PASS choose, generate, valid CloudStream repo.json and selected-only plugins.json')
    print('PASS SFW/NSFW separation, safe metadata rendering')
    print('PASS mobile 390px; 12/page; pagination; no horizontal overflow')
    print('PASS failure state; 0 browser JS errors')
    print('Example URL: '+full)
    browser.close()
