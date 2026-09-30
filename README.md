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
Lists and stores are stored locally on each device. Use **Export Backup** occasionally. The backup can be imported on another device.

## Store routing
Store-specific aisle maps are not claimed unless verified. Built-in locations use known store locations plus approximate department-flow templates.
