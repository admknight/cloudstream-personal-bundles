# Deploy the Personal Bundle Builder

The Personal Repository Builder is **already live** at https://adam-cloudstream-bundles.badass-insane.workers.dev/ and has been tested with real Android CloudStream installations. These steps document the deployment and how to configure another instance. Only the owner of a Cloudflare account can authorize their deployment.

## 1. Source and continuous integration (completed)

The separate source repository is published at [admknight/cloudstream-personal-bundles](https://github.com/admknight/cloudstream-personal-bundles) on `main`. The archived project was checksum-verified and imported successfully. The read-only GitHub Actions workflow at `.github/workflows/test.yml` runs the Node tests on pushes and pull requests.

**No further ZIP upload or GitHub repository creation is required.** The MegaRepo repository and its existing installation links remain unchanged.

## 2. Deploy with Cloudflare

The official Cloudflare Workers dashboard supports importing an existing Git repository:

1. Sign in to https://dash.cloudflare.com/ and open **Workers & Pages**.
2. Choose **Create application** and select the `admknight/cloudstream-personal-bundles` Git repository (or your own fork).
3. Choose the `main` production branch and project root `/`. The Worker name must match `adam-cloudstream-bundles` in `wrangler.toml` (change both together if the name is unavailable). Leave the optional build command empty, and use the deploy command `npx wrangler deploy`.
4. Allow Cloudflare to deploy the Worker. No KV/D1 binding or environment secret is required.
5. Confirm the HTTPS Worker URL. The existing service is `https://adam-cloudstream-bundles.badass-insane.workers.dev/`; a second deployment may use another workers.dev subdomain.

**Alternative CLI:** with Node.js 20+ installed, run `npm install`, `npm test`, `npx wrangler login`, then `npm run deploy`. Only you can authenticate your Cloudflare account; do not share API tokens or passwords in chat.

Official Cloudflare dashboard guide: https://developers.cloudflare.com/workers/get-started/dashboard/

## 3. Validate before inviting users

- Load your new Worker homepage and confirm it shows the MegaRepo plugin catalog.
- Open `/api/catalog` on that same Worker domain and confirm it returns a JSON list.
- Select two regular plugins in the dashboard and generate the Full personal bundle.
- Open the generated `repo.json` URL in a browser: verify `manifestVersion` is 1 and its `pluginLists` points to the same Worker host.
- Open the linked `plugins.json`: verify it lists **only the two chosen extensions** with their original `.cs3` URLs and version numbers.
- Add the generated **HTTPS repo.json** URL in CloudStream → Settings → Extensions → Add Repository. Confirm the two names appear and can be installed on your actual Android device.
- Test the SFW/NSFW options using explicitly selected entries, and verify that removed/upstream-down entries do not get reintroduced.
- Check Android and desktop layouts. Do not claim any plugin streams are working unless you independently test playback.

If these tests fail, leave the main MegaRepo unchanged and troubleshoot the Worker independently.

## 4. Link to MegaRepo after app verification

The live MegaRepo dashboard and Extension Explorer already link to the Personal Repository Builder. They are three distinct user paths: full catalog installation, discovery-only browsing, or generating a selected-only repository. Do **not** change the main MegaRepo `repo.json` or its shortcode `admknight`.

## 5. Rollback

If the new Worker encounters issues, remove its link from the website (if one was added) and pause/disable that separate Worker deployment. The main MegaRepo installation links, plugin catalog, automation, and published packages require no rollback.

## Notes

The current service is **stateless**: selections encoded in a link are fixed, while their plugin package metadata follows new upstream versions. To change a selection, generate a new link and replace the CloudStream repository. If you require VigaRepo2's ability to edit a personal repository without changing its URL, a separately protected persistence service is necessary. That is a future feature, not silently emulated here.
