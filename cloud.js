let cloudClient=null,cloudUser=null,cloudPollTimer=null,cloudUploadTimer=null,cloudBusy=false,cloudDirty=false,lastCloudFingerprint="";

function cloudConfigured(){
  const c=window.SMART_GROCERY_CLOUD||{};
  return Boolean(c.url&&c.anonKey&&window.supabase?.createClient);
}
function cloudStatus(text,tone=""){
  const el=document.querySelector("#cloudStatus");
  if(el){el.textContent=text;el.dataset.tone=tone}
  const badge=document.querySelector("#cloudMenuStatus");
  if(badge)badge.textContent=cloudUser?"On":(cloudConfigured()?"Off":"Setup");
}
async function cloudSnapshot(){
  const settings=(await dbGetAll(SETTINGS)).filter(x=>!String(x.key).startsWith("cloud"));
  const lists=await dbGetAll(LISTS);
  const stores=await dbGetAll(STORES);
  return {version:2,stores,lists,settings};
}
function fingerprint(payload){
  return JSON.stringify(payload);
}
function queueCloudUpload(store,val){
  if(!cloudUser||cloudBusy)return;
  if(store===SETTINGS&&val?.key==="cloudLinkedUser")return;
  cloudDirty=true;
  clearTimeout(cloudUploadTimer);
  cloudUploadTimer=setTimeout(()=>uploadCloudSnapshot(),600);
}
async function replaceStore(storeName,rows){
  const existing=await dbGetAll(storeName);
  for(const row of existing)await dbDelete(storeName,row.id??row.key);
  for(const row of rows||[])await dbPut(storeName,row);
}
async function applyCloudSnapshot(payload){
  if(!payload?.lists?.length)return;
  cloudBusy=true;
  try{
    await replaceStore(STORES,payload.stores||[]);
    await replaceStore(LISTS,payload.lists||[]);
    await replaceStore(SETTINGS,payload.settings||[]);
    await dbPut(SETTINGS,{key:"cloudLinkedUser",value:cloudUser.id});
    const current=await dbGet(SETTINGS,"currentListId");
    if(!current||!(await dbGet(LISTS,current.value))){
      const first=(await dbGetAll(LISTS))[0];
      if(first)await dbPut(SETTINGS,{key:"currentListId",value:first.id});
    }
    await loadCurrent();
    lastCloudFingerprint=fingerprint(await cloudSnapshot());
  }finally{cloudBusy=false}
}
async function readCloudRow(){
  const {data,error}=await cloudClient.from("grocery_sync").select("payload,updated_at").eq("user_id",cloudUser.id).maybeSingle();
  if(error)throw error;
  return data;
}
async function uploadCloudSnapshot(force=false){
  if(!cloudUser||cloudBusy)return;
  clearTimeout(cloudUploadTimer);
  const payload=await cloudSnapshot(),fp=fingerprint(payload);
  if(!force&&!cloudDirty&&fp===lastCloudFingerprint)return;
  cloudBusy=true;cloudStatus("Syncing…");
  try{
    const {error}=await cloudClient.from("grocery_sync").upsert({
      user_id:cloudUser.id,
      payload,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});
    if(error)throw error;
    lastCloudFingerprint=fp;
    cloudDirty=false;
    cloudStatus("Synced","ok");
  }catch(e){
    cloudDirty=true;
    console.error("Cloud upload failed",e);
    cloudStatus("Sync error","error");
  }finally{cloudBusy=false}
}
async function pullCloudIfChanged(){
  if(!cloudUser||cloudBusy||cloudDirty)return;
  try{
    const row=await readCloudRow();
    if(!row?.payload)return;
    const remoteFp=fingerprint(row.payload);
    const localFp=fingerprint(await cloudSnapshot());
    if(remoteFp!==localFp){
      cloudStatus("Updating…");
      await applyCloudSnapshot(row.payload);
      cloudStatus("Synced","ok");
    }else{
      lastCloudFingerprint=localFp;
      cloudStatus("Synced","ok");
    }
  }catch(e){
    console.error("Cloud pull failed",e);
    cloudStatus("Sync error","error");
  }
}
async function linkCloudUser(user){
  cloudUser=user;
  document.querySelector("#cloudEmail").value=user.email||"";
  document.querySelector("#cloudSignInBtn").classList.add("hidden");
  document.querySelector("#cloudSignOutBtn").classList.remove("hidden");
  const linked=await dbGet(SETTINGS,"cloudLinkedUser");
  let row=null;
  try{row=await readCloudRow()}catch(e){console.error(e)}
  if(!row){
    await dbPut(SETTINGS,{key:"cloudLinkedUser",value:user.id});
    await uploadCloudSnapshot(true);
  }else if(linked?.value!==user.id){
    const useCloud=confirm("Cloud data already exists for this account. Use the cloud copy on this device?\n\nOK = download cloud data\nCancel = upload this device instead");
    await dbPut(SETTINGS,{key:"cloudLinkedUser",value:user.id});
    if(useCloud)await applyCloudSnapshot(row.payload);
    else await uploadCloudSnapshot(true);
  }else{
    await pullCloudIfChanged();
  }
  clearInterval(cloudPollTimer);
  cloudPollTimer=setInterval(async()=>{
    if(document.visibilityState==="visible"){
      if(cloudDirty)await uploadCloudSnapshot();
      else await pullCloudIfChanged();
    }
  },5000);
  cloudStatus("Synced","ok");
}
async function cloudSignIn(){
  if(!cloudConfigured()){cloudStatus("Cloud setup required","error");return}
  const email=document.querySelector("#cloudEmail").value.trim();
  if(!email){cloudStatus("Enter your email","error");return}
  cloudStatus("Sending sign-in link…");
  const redirectTo=location.origin+location.pathname;
  const {error}=await cloudClient.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
  if(error){console.error(error);cloudStatus(error.message||"Sign-in failed","error");return}
  cloudStatus("Check your email for the sign-in link.","ok");
}
async function cloudSignOut(remote=true){
  if(remote&&cloudClient)await cloudClient.auth.signOut();
  cloudUser=null;cloudDirty=false;clearTimeout(cloudUploadTimer);clearInterval(cloudPollTimer);
  document.querySelector("#cloudSignInBtn").classList.remove("hidden");
  document.querySelector("#cloudSignOutBtn").classList.add("hidden");
  cloudStatus("Not signed in");
}
function openCloudSheet(){
  closeSheet("menuPanel");openSheet("cloudSheet");
}
async function cloudInit(){
  while(!state?.db||!state?.currentList)await new Promise(r=>setTimeout(r,100));
  document.querySelector("#cloudSyncBtn").onclick=openCloudSheet;
  document.querySelector("#cloudSignInBtn").onclick=cloudSignIn;
  document.querySelector("#cloudSignOutBtn").onclick=cloudSignOut;
  document.querySelector("#cloudNowBtn").onclick=async()=>{
    if(cloudDirty)await uploadCloudSnapshot();
    else await pullCloudIfChanged();
  };
  if(!cloudConfigured()){
    cloudStatus("Cloud sync is not configured yet.");
    return;
  }
  const c=window.SMART_GROCERY_CLOUD;
  cloudClient=window.supabase.createClient(c.url,c.anonKey);
  const {data:{session}}=await cloudClient.auth.getSession();
  if(session?.user)await linkCloudUser(session.user);
  else cloudStatus("Not signed in");
  cloudClient.auth.onAuthStateChange(async(_event,session)=>{
    if(session?.user&&session.user.id!==cloudUser?.id)await linkCloudUser(session.user);
    if(!session?.user&&cloudUser)await cloudSignOut(false);
  });
  window.addEventListener("focus",()=>pullCloudIfChanged());
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pullCloudIfChanged()});
}
document.addEventListener("DOMContentLoaded",cloudInit);
