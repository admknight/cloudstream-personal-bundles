# Adam Knight | CloudStream Personal Bundles

**[Open the live Personal Repository Builder](https://adam-cloudstream-bundles.badass-insane.workers.dev/)**

An independent, read-only **personal repository builder** for the published [Adam Knight MegaRepo](https://github.com/admknight/CloudstreamExtensions) catalog.

Users choose extensions in a web dashboard, generate a unique CloudStream-compatible HTTPS `repo.json` link, add that repository inside CloudStream, and install only the listed extensions. The service neither modifies MegaRepo nor repackages or hosts plugin binaries.

## Choose the right option

**Full MegaRepo** provides the whole catalog; **Personal Repository Builder** creates a selected-only catalog URL; **Extension Explorer** provides local bookmarks for discovery. These are three different outcomes, not three ways to automatically install plugins.

| Your goal | Use this | What happens |
| --- | --- | --- |
| **All available extensions** | [Full MegaRepo](https://admknight.github.io/CloudstreamExtensions/#install-full) — shortcode `admknight` | Add the complete catalog in CloudStream and install individual plugins when needed. |
| **Only your own selected extensions** | **[Personal Repository Builder](https://adam-cloudstream-bundles.badass-insane.workers.dev/)** | Select up to 100 extensions, generate a personal `repo.json` URL, add it in CloudStream, then install chosen plugins. |
| **Explore before installing** | [Extension Explorer](https://admknight.github.io/CloudstreamExtensions/explore.html) | Search, filter and bookmark names locally; bookmarks do not install extensions or automatically import into the builder. |

**A repository is a list of available extensions, not an automatic installer.** You install individual plugins from CloudStream after adding your repository.

This service connects discovery, selected-only installation and guarded catalog maintenance without requiring user accounts or duplicating plugin packages.

## What it does

- Search, filter by language and declared content type, and select up to **100** extensions.
- Hide NSFW-labeled entries unless the visitor explicitly reveals them.
- Exclude extensions that MegaRepo marks as down (`status: 0`).
- Generate three installable repository views when those categories have selected entries: **all**, **SFW-labeled**, and **NSFW-labeled**.
- Create user-specific URLs without an account, password, database, or mutable backend state.
- Keep selected plugin *identities* linked to their latest available MegaRepo metadata; updated `.cs3` package URLs or versions are automatically reflected after cache refresh.
- Keep browsing selections in the visitor's browser localStorage for convenience.
- Continue serving remaining selected extensions if one is removed or marked down upstream; the response includes `X-Bundle-Missing` and a description warning.

**Important:** A personalized repository shows only your choices in CloudStream; *adding the repository does not itself install the plugins*. In CloudStream, the user must still install the desired extensions.

## Architecture and safety

```text
Official MegaRepo builds/plugins.json  [READ ONLY]
                 |
                 v
     Separate Cloudflare Worker
         |             |
    /api/catalog   /b/<token>/<mode>/repo.json
                        |
                        v
              /b/<token>/<mode>/plugins.json
                        |
                        v
              original .cs3 download URLs
```

No changes are needed to MegaRepo's `repo.json`, existing `builds/` branch, `sources.json`, custom providers, GitHub Actions, or GitHub Pages. Deploy this as a **separate Worker**, ideally sourced from a separate GitHub repository.

The Worker accepts **GET and HEAD only**. It fetches only MegaRepo's fixed official published catalog URL, not user-provided URLs. It does not copy or proxy binary packages or offer a custom upstream-injection option. It validates selection tokens, caps selection size, checks plugin identity collisions, and renders catalog metadata with DOM `textContent` rather than HTML injection. Generated links encode a selected set of plugin identities; they are *not secret* and can be shared publicly.

Extensions can run code in CloudStream. Users should install only plugins they trust. SFW/NSFW grouping follows upstream `tvTypes` metadata; it is **not** a content inspection or guarantee. Package availability does not confirm that streams work.

## Live deployment and self-hosting

**Public service:** https://adam-cloudstream-bundles.badass-insane.workers.dev/

See [DEPLOYMENT.md](DEPLOYMENT.md) to configure your own instance or verify an existing deployment. Cloudflare account authorization is required for a new deployment.

```bash
npm install
npm test
npm run dev     # local test Worker
npm run deploy  # deploy to your Cloudflare account
```

Node.js 20+ is required. The deploy uses `wrangler.toml` and creates an HTTPS `workers.dev` URL. No D1, KV, R2, database password, user registration, or account credential is required by this application.

## User flow

1. Open the [live Personal Repository Builder](https://adam-cloudstream-bundles.badass-insane.workers.dev/).
2. Search and select the extensions you want.
3. Click **Create my repository link**.
4. Choose **All my selected plugins** or an SFW/NSFW-filtered URL. **This is not the full MegaRepo.**
5. Copy the HTTPS URL or try **Open in CloudStream** on Android.
6. In CloudStream, open **Settings → Extensions → Add Repository**, paste the URL if needed, and then install the displayed plugins.

### Example manifest (for illustration only)

```json
{
  "name": "Adam Knight - Personal Selection",
  "description": "Personal selection from the published Adam Knight MegaRepo catalog. Extensions are not automatically installed.",
  "manifestVersion": 1,
  "pluginLists": [
    "https://YOUR-WORKER.workers.dev/b/YOUR-TOKEN/all/plugins.json"
  ]
}
```

The linked `plugins.json` contains original MegaRepo metadata for **only the selected plugins**. The example URL above is a placeholder, not an actual published repository.

## Stateless-link tradeoffs

- The URL contains selection keys, not a server-side personal account. There is **no editable server-side profile**.
- When visitors change their selection, they must generate a **new URL** and replace their old repository in CloudStream if they want the changes to apply. Existing URLs continue representing their original choices.
- The worker must remain publicly available for personal repository links to function.
- The current selection limit is 100. The standard MegaRepo installation URL remains available for users who want the entire catalog.
- Old links survive plugin version upgrades when `internalName` remains stable. Renamed or removed identities will no longer appear; the manifest indicates missing selections.
- For greater-than-100 selections, short mutable URLs, or account-based editing and synchronization like VigaRepo2, a separate persistent backend would be necessary. Those features are intentionally not part of this low-risk version.

## Tests

```bash
npm test
```

Automated tests cover token generation/validation, original plugin metadata preservation, compatibility-shaped manifests, SFW/NSFW filtering, disabled entries, missing upstream identities, bad catalogs, and error handling.

`test/browser-check.py` provides a **mocked** browser smoke test using `test/mock-server.mjs`, Python Playwright, and Chromium. The live Worker smoke test is under `test/live-smoke.mjs`. Users have also verified installing AniChan and Anichi on Android using the generated repository; this does not guarantee other plugins work.

## Production boundary

The standalone Worker is deployed and linked from MegaRepo's website after Android installation verification. A Worker outage must never affect MegaRepo's own repository installation, three-hour guarded aggregation or hourly read-only integrity audit. Production package feeds and the MegaRepo shortcode remain independent.

No streaming media or `.cs3` package binaries are hosted here. All plugin downloads remain at their original published upstream URLs.
