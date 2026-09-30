# Smart Grocery PWA

Static, installable grocery-list app. No server or subscription required.

## Included
- Persistent device storage with IndexedDB
- Multiple saved grocery lists
- Unlimited add/edit/delete items
- Undo for individual delete and Clear List
- Check All / Uncheck All
- Checked subtotal and expected list total
- Store-based department sorting
- Add custom stores using a store-layout template
- Offline use after first load
- Optional cross-device cloud sync with Supabase email sign-in
- JSON backup export/import
- iPhone Home Screen installation

The starter list is the latest 31-item list and defaults to Walmart Supercenter #278 on E. Bert Kouns Industrial Loop in Shreveport.

## Publish with GitHub Pages
1. Create a GitHub repository such as `smart-grocery`.
2. Put every file/folder from this package at the repository root.
3. GitHub → Settings → Pages.
4. Under Build and deployment choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Open the Pages URL in Safari on iPhone.
7. Safari Share button → **Add to Home Screen**.

## Data storage
Lists and stores are stored locally in IndexedDB. When cloud sync is configured, the app also stores one per-user cloud snapshot in Supabase so the same lists can follow you between devices. **Export Backup** remains available as a manual safety copy.

## Cloud sync setup
1. Create a Supabase project.
2. Run `supabase.sql` in the Supabase SQL editor.
3. In Supabase Authentication, enable Email sign-in.
4. Add `https://gen-tex.github.io/smart-grocery/` as an allowed redirect URL.
5. Copy the project URL and **publishable/anon key** into `cloud-config.js`.
6. Deploy, open **Cloud Sync**, and request an email sign-in link.
7. On the first device, local data uploads when the cloud is empty. On another device, if cloud data already exists, the app asks whether to download the cloud copy or replace it with that device's local copy.

The publishable/anon key is designed to be used client-side. Access control is enforced by the Row Level Security policies in `supabase.sql`. Never put a Supabase service-role key in this repository.

## Store routing
Store-specific aisle maps are not claimed unless verified. Built-in locations use known store locations plus approximate department-flow templates.
