# Deploy the Personal Bundle Builder

The code is ready to deploy as an independent Cloudflare Worker. Only the owner of the hosting account can authorize the first deployment.

## 1. Create a separate GitHub repository

Create an empty repository named `admknight/cloudstream-personal-bundles` (private or public, your choice), and upload the contents of this project folder to its root. **Do not** upload these files into the working MegaRepo repository or replace any of MegaRepo's current files. You can ask ChatGPT to publish the files after the new repo exists and is accessible through the GitHub connector.

Keep `.github/workflows/test.yml` to run tests on future pushes. That workflow has no deployment or write permission.

## 2. Deploy with Cloudflare

The official Cloudflare Workers dashboard supports importing an existing Git repository:

1. Sign in to https://dash.cloudflare.com/ and open **Workers & Pages**.
2. Choose **Create application** and select the Git repository you created in step 1.
3. Keep the project root at `/`, with `wrangler.toml` and `src/worker.js` in their included paths. Set the Worker name to `adam-cloudstream-bundles`, or adjust `wrangler.toml` before deployment if the name is unavailable.
4. Allow Cloudflare to deploy the Worker. No KV/D1 binding or environment secret is required.
5. Note the actual HTTPS Worker URL, normally `https://adam-cloudstream-bundles.YOUR-SUBDOMAIN.workers.dev/`.

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

Once the personal install link works in the real CloudStream app, add a simple optional link from the existing MegaRepo Extension Explorer/dashboard: **Build my personal bundle** → your Cloudflare Worker URL. Do **not** change the main MegaRepo `repo.json` or its short code.

## 5. Rollback

If the new Worker encounters issues, remove its link from the website (if one was added) and pause/disable that separate Worker deployment. The main MegaRepo installation links, plugin catalog, automation, and published packages require no rollback.

## Notes

The current service is **stateless**: selections encoded in a link are fixed, while their plugin package metadata follows new upstream versions. To change a selection, generate a new link and replace the CloudStream repository. If you require VigaRepo2's ability to edit a personal repository without changing its URL, a separately protected persistence service is necessary. That is a future feature, not silently emulated here.
