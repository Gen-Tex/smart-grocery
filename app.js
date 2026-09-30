const DB_NAME="smart-grocery-pwa",DB_VERSION=1;
const STORES="stores",LISTS="lists",SETTINGS="settings";

const DEPARTMENTS={
  produce:"Produce",meat:"Meat",bakery:"Bakery",snacks:"Snacks / Candy",
  cereal:"Cereal",pantry:"Pantry / Baking / Pasta / Spices",drinks:"Drinks",
  paper:"Paper Goods",cleaning:"Cleaning",personal:"Personal Care",
  refrigerated:"Refrigerated",dairy:"Dairy",frozen:"Frozen",other:"Other"
};

const ROUTES={
  walmart_supercenter:["produce","meat","bakery","snacks","cereal","pantry","drinks","paper","cleaning","personal","refrigerated","dairy","frozen","other"],
  walmart_neighborhood:["produce","bakery","dairy","refrigerated","meat","snacks","cereal","pantry","drinks","paper","cleaning","personal","frozen","other"],
  brookshires:["produce","meat","bakery","snacks","cereal","pantry","drinks","cleaning","paper","personal","refrigerated","dairy","frozen","other"],
  fresh:["produce","bakery","meat","snacks","cereal","pantry","drinks","refrigerated","dairy","frozen","paper","cleaning","personal","other"],
  manual:["produce","meat","bakery","snacks","cereal","pantry","drinks","paper","cleaning","personal","refrigerated","dairy","frozen","other"]
};

const starterStores=[
  {id:"my-store",name:"My Store",address:"",template:"manual",note:"Add or choose your preferred store."}
];

const starterItems=[];

const state={db:null,currentList:null,currentStore:null,undo:null,undoTimer:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n||0));
const uid=p=>`${p}-${crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}`;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORES))db.createObjectStore(STORES,{keyPath:"id"});
      if(!db.objectStoreNames.contains(LISTS))db.createObjectStore(LISTS,{keyPath:"id"});
      if(!db.objectStoreNames.contains(SETTINGS))db.createObjectStore(SETTINGS,{keyPath:"key"});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
function tx(store,mode="readonly"){return state.db.transaction(store,mode).objectStore(store)}
function dbGet(store,key){return new Promise((res,rej)=>{const r=tx(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function dbGetAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function dbPut(store,val){return new Promise((res,rej)=>{const r=tx(store,"readwrite").put(val);r.onsuccess=()=>{res(val);if(typeof queueCloudUpload==="function")queueCloudUpload(store,val)};r.onerror=()=>rej(r.error)})}
function dbDelete(store,key){return new Promise((res,rej)=>{const r=tx(store,"readwrite").delete(key);r.onsuccess=()=>{res();if(typeof queueCloudUpload==="function")queueCloudUpload(store,{key})};r.onerror=()=>rej(r.error)})}

async function seed(){
  if(!(await dbGetAll(STORES)).length)for(const s of starterStores)await dbPut(STORES,s);
  let setting=await dbGet(SETTINGS,"currentListId");
  if(!(await dbGetAll(LISTS)).length){
    const list={id:"current-list",name:"My Grocery List",storeId:"my-store",items:starterItems,createdAt:Date.now(),updatedAt:Date.now()};
    await dbPut(LISTS,list);
    await dbPut(SETTINGS,{key:"currentListId",value:list.id});
    await dbPut(SETTINGS,{key:"onboardingNeeded",value:true});
    setting={value:list.id};
  }
  if(!setting){
    const first=(await dbGetAll(LISTS))[0];
    await dbPut(SETTINGS,{key:"currentListId",value:first.id});
  }
}

async function loadCurrent(){
  const setting=await dbGet(SETTINGS,"currentListId");
  state.currentList=await dbGet(LISTS,setting.value);
  state.currentStore=await dbGet(STORES,state.currentList.storeId)||(await dbGetAll(STORES))[0];
  render();
}
async function saveList(){state.currentList.updatedAt=Date.now();await dbPut(LISTS,state.currentList)}

function routeIndex(dept){
  const route=ROUTES[state.currentStore?.template]||ROUTES.manual;
  const i=route.indexOf(dept);return i<0?999:i;
}
function sortedItems(){
  return [...state.currentList.items].sort((a,b)=>routeIndex(a.department)-routeIndex(b.department)||a.createdAt-b.createdAt);
}
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function render(){
  $("#listTitle").textContent=state.currentList.name;
  $("#storeName").textContent=state.currentStore?.name||"No store";
  $("#storeAddress").textContent=state.currentStore?.address||"";
  $("#storeNote").textContent=state.currentStore?.note||"Custom store";
  renderItems();renderTotals();
}
function renderItems(){
  const host=$("#items");host.innerHTML="";
  const items=sortedItems();
  if(!items.length){
    host.innerHTML='<div class="empty"><strong>Your list is empty.</strong><br><span>Tap “+ Add Item” to start.</span></div>';return;
  }
  let lastDept=null;
  for(const item of items){
    if(item.department!==lastDept){
      const h=document.createElement("div");h.className="dept-head";
      h.textContent=DEPARTMENTS[item.department]||"Other";host.appendChild(h);lastDept=item.department;
    }
    const row=document.createElement("div");row.className=`item${item.checked?" checked":""}`;row.dataset.id=item.id;
    row.innerHTML=`
      <input class="item-check" type="checkbox" ${item.checked?"checked":""} aria-label="Check ${escapeHtml(item.name)}">
      <div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-meta">${DEPARTMENTS[item.department]||"Other"}</div></div>
      <div class="item-price">${item.price?money(item.price):""}</div>
      <div class="item-actions">
        <button class="item-action edit-action" aria-label="Edit ${escapeHtml(item.name)}">✎</button>
        <button class="item-action delete-action" aria-label="Delete ${escapeHtml(item.name)}">×</button>
      </div>`;
    row.querySelector(".item-check").addEventListener("change",e=>toggleItem(item.id,e.target.checked));
    row.querySelector(".edit-action").addEventListener("click",()=>openItemSheet(item));
    row.querySelector(".delete-action").addEventListener("click",()=>deleteItem(item.id));
    host.appendChild(row);
  }
}
function renderTotals(){
  const items=state.currentList.items,checked=items.filter(x=>x.checked);
  $("#checkedTotal").textContent=money(checked.reduce((s,x)=>s+(Number(x.price)||0),0));
  $("#checkedCount").textContent=`${checked.length} checked`;
  $("#expectedTotal").textContent=money(items.reduce((s,x)=>s+(Number(x.price)||0),0));
}

async function toggleItem(id,checked){
  const item=state.currentList.items.find(x=>x.id===id);if(!item)return;
  item.checked=checked;await saveList();render();
}
async function checkAll(v){state.currentList.items.forEach(x=>x.checked=v);await saveList();render()}

function openSheet(id){
  $("#backdrop").classList.remove("hidden");
  $("#"+id).classList.remove("hidden");
}
function closeSheet(id){
  $("#"+id).classList.add("hidden");
  if(!$$(".sheet:not(.hidden)").length)$("#backdrop").classList.add("hidden");
}
function closeAllSheets(){
  $$(".sheet").forEach(s=>s.classList.add("hidden"));
  $("#backdrop").classList.add("hidden");
}

async function completeOnboarding(sync){
  await dbPut(SETTINGS,{key:"onboardingNeeded",value:false});
  $("#welcomeScreen").classList.add("hidden");
  if(sync&&typeof openCloudSheet==="function")openCloudSheet();
}
async function showOnboardingIfNeeded(){
  const setting=await dbGet(SETTINGS,"onboardingNeeded");
  if(setting?.value===true)$("#welcomeScreen").classList.remove("hidden");
}
async function shareApp(){
  const url=location.origin+location.pathname;
  const data={title:"Smart Grocery",text:"Try Smart Grocery — an installable grocery list with optional cross-device sync.",url};
  try{
    if(navigator.share){await navigator.share(data);return}
    await navigator.clipboard.writeText(url);
    alert("Smart Grocery link copied.");
  }catch(e){
    if(e?.name!=="AbortError")prompt("Copy this Smart Grocery link:",url);
  }
}

function fillDeptSelect(){
  $("#itemDept").innerHTML=Object.entries(DEPARTMENTS).map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
}
function openItemSheet(item=null){
  $("#itemSheetTitle").textContent=item?"Edit Item":"Add Item";
  $("#itemId").value=item?.id||"";
  $("#itemName").value=item?.name||"";
  $("#itemDept").value=item?.department||"other";
  $("#itemPrice").value=item?.price??"";
  openSheet("itemSheet");
  setTimeout(()=>$("#itemName").focus(),120);
}

async function deleteItem(id){
  const idx=state.currentList.items.findIndex(x=>x.id===id);if(idx<0)return;
  const [item]=state.currentList.items.splice(idx,1);
  setUndo({type:"delete-item",item,index:idx},`${item.name} deleted.`);
  await saveList();render();
}
function setUndo(payload,text){
  state.undo=payload;clearTimeout(state.undoTimer);
  $("#undoText").textContent=text;$("#undoBar").classList.remove("hidden");
  state.undoTimer=setTimeout(()=>{state.undo=null;$("#undoBar").classList.add("hidden")},12000);
}
async function undo(){
  if(!state.undo)return;
  const u=state.undo;state.undo=null;clearTimeout(state.undoTimer);$("#undoBar").classList.add("hidden");
  if(u.type==="delete-item")state.currentList.items.splice(u.index,0,u.item);
  if(u.type==="clear-list")state.currentList.items=u.items;
  await saveList();render();
}

async function selectStore(id){
  const store=await dbGet(STORES,id);if(!store)return;
  state.currentStore=store;state.currentList.storeId=id;await saveList();closeAllSheets();render();
}
async function renderStores(){
  const stores=await dbGetAll(STORES);
  $("#storeList").innerHTML=stores.map(s=>`
    <div class="picker-row">
      <button class="text-btn store-pick" data-id="${s.id}" style="text-align:left;flex:1">
        <strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.address||"")}</small>
      </button>
      ${s.id.startsWith("custom-store-")?`<button class="mini-btn danger store-delete" data-id="${s.id}">Delete</button>`:""}
    </div>`).join("");
  $$(".store-pick").forEach(b=>b.onclick=()=>selectStore(b.dataset.id));
  $$(".store-delete").forEach(b=>b.onclick=()=>deleteStore(b.dataset.id));
}
async function deleteStore(id){
  const inUse=(await dbGetAll(LISTS)).some(l=>l.storeId===id);
  if(inUse){alert("This store is used by a saved list. Change that list to another store first.");return}
  if(confirm("Delete this custom store?")){await dbDelete(STORES,id);await renderStores()}
}

async function renderLists(){
  const lists=await dbGetAll(LISTS);
  $("#savedLists").innerHTML=lists.sort((a,b)=>b.updatedAt-a.updatedAt).map(l=>`
    <div class="picker-row">
      <button class="text-btn list-pick" data-id="${l.id}" style="text-align:left;flex:1">
        <strong>${escapeHtml(l.name)}</strong><small>${l.items.length} items</small>
      </button>
      ${lists.length>1?`<button class="mini-btn danger list-delete" data-id="${l.id}">Delete</button>`:""}
    </div>`).join("");
  $$(".list-pick").forEach(b=>b.onclick=()=>switchList(b.dataset.id));
  $$(".list-delete").forEach(b=>b.onclick=()=>deleteList(b.dataset.id));
}
async function switchList(id){
  await dbPut(SETTINGS,{key:"currentListId",value:id});closeAllSheets();await loadCurrent();
}
async function deleteList(id){
  if(id===state.currentList.id){alert("Switch to another list before deleting this one.");return}
  if(confirm("Delete this saved list?")){await dbDelete(LISTS,id);await renderLists()}
}
async function createList(name,copy){
  const list={
    id:uid("list"),name:name.trim(),storeId:state.currentList.storeId,
    items:copy?state.currentList.items.map(x=>({...x,id:uid("item"),checked:false,createdAt:Date.now()+Math.random()})):[],
    createdAt:Date.now(),updatedAt:Date.now()
  };
  await dbPut(LISTS,list);await dbPut(SETTINGS,{key:"currentListId",value:list.id});
  state.currentList=list;state.currentStore=await dbGet(STORES,list.storeId);closeAllSheets();render();
}

async function clearList(){
  if(!state.currentList.items.length)return;
  const dlg=$("#confirmDialog");
  $("#confirmMessage").textContent="All items will be removed, but you can undo immediately afterward.";
  dlg.showModal();
  const result=await new Promise(res=>dlg.addEventListener("close",()=>res(dlg.returnValue),{once:true}));
  if(result!=="confirm")return;
  const old=state.currentList.items.map(x=>({...x}));
  state.currentList.items=[];setUndo({type:"clear-list",items:old},"List cleared.");await saveList();render();
}

async function exportBackup(){
  const payload={version:1,exportedAt:new Date().toISOString(),stores:await dbGetAll(STORES),lists:await dbGetAll(LISTS),settings:await dbGetAll(SETTINGS)};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`smart-grocery-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
}
async function importBackup(file){
  try{
    const payload=JSON.parse(await file.text());
    if(!payload?.stores||!payload?.lists)throw new Error("Invalid backup");
    for(const s of payload.stores)await dbPut(STORES,s);
    for(const l of payload.lists)await dbPut(LISTS,l);
    for(const st of payload.settings||[])await dbPut(SETTINGS,st);
    alert("Backup imported.");closeAllSheets();await loadCurrent();
  }catch(e){alert("Could not import that backup file.")}
}

function wire(){
  fillDeptSelect();
  $("#menuBtn").onclick=()=>openSheet("menuPanel");
  $("#shareAppBtn").onclick=shareApp;
  $("#welcomeLocalBtn").onclick=()=>completeOnboarding(false);
  $("#welcomeSyncBtn").onclick=()=>completeOnboarding(true);
  $("#changeStoreBtn").onclick=async()=>{await renderStores();openSheet("storeSheet")};
  $("#storesBtn").onclick=async()=>{closeSheet("menuPanel");await renderStores();openSheet("storeSheet")};
  $("#listsBtn").onclick=async()=>{closeSheet("menuPanel");await renderLists();openSheet("listsSheet")};
  $("#addStoreBtn").onclick=()=>{closeSheet("storeSheet");openSheet("addStoreSheet")};
  $("#addItemBtn").onclick=()=>openItemSheet();
  $("#checkAllBtn").onclick=()=>checkAll(true);
  $("#uncheckAllBtn").onclick=()=>checkAll(false);
  $("#undoBtn").onclick=undo;
  $("#clearListBtn").onclick=clearList;
  $("#newListBtn").onclick=()=>openSheet("newListSheet");
  $("#exportBtn").onclick=exportBackup;
  $("#importInput").onchange=e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value=""};
  $("#backdrop").onclick=closeAllSheets;
  $$("[data-close]").forEach(b=>b.onclick=()=>closeSheet(b.dataset.close));

  $("#itemForm").onsubmit=async e=>{
    e.preventDefault();
    const id=$("#itemId").value;
    const data={name:$("#itemName").value.trim(),department:$("#itemDept").value,price:Number($("#itemPrice").value)||0};
    if(id)Object.assign(state.currentList.items.find(x=>x.id===id),data);
    else state.currentList.items.push({id:uid("item"),...data,checked:false,createdAt:Date.now()});
    await saveList();closeSheet("itemSheet");render();
  };

  $("#storeForm").onsubmit=async e=>{
    e.preventDefault();
    const s={id:uid("custom-store"),name:$("#newStoreName").value.trim(),address:$("#newStoreAddress").value.trim(),template:$("#newStoreTemplate").value,note:"Custom store • route based on selected template"};
    await dbPut(STORES,s);e.target.reset();closeSheet("addStoreSheet");await renderStores();openSheet("storeSheet");
  };

  $("#newListForm").onsubmit=async e=>{
    e.preventDefault();
    await createList($("#newListName").value,$("#copyCurrentList").checked);
    e.target.reset();$("#newListName").value="Grocery List";
  };
}

async function init(){
  try{
    state.db=await openDB();await seed();wire();await loadCurrent();await showOnboardingIfNeeded();
    if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }catch(e){
    console.error(e);
    document.body.innerHTML='<div style="padding:30px;font-family:system-ui"><h2>Smart Grocery could not start.</h2><p>Open it from a normal HTTPS website such as GitHub Pages.</p></div>';
  }
}
document.addEventListener("DOMContentLoaded",init);
