export type OfflineCapture = {
  id:string;
  createdAt:string;
  projectSlug:string;
  siteId:string;
  physicalObjectId:string;
  recordType:string;
  visibility:string;
  title:string;
  description:string;
  measurementValue:string;
  measurementUnit:string;
  capturedAt:string;
  latitude?:number|null;
  longitude?:number|null;
  accuracyMeters?:number|null;
  file?:Blob|null;
  fileName?:string|null;
  fileType?:string|null;
  state:"queued"|"syncing"|"conflict";
  error?:string|null;
};

const DB_NAME="archeology-notes-field-v1";
const STORE="captures";

function openDb(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});};
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}

async function transaction<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason?:unknown)=>void)=>void){
  const db=await openDb();
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode); const store=tx.objectStore(STORE);
    work(store,resolve,reject); tx.oncomplete=()=>db.close(); tx.onerror=()=>{db.close();reject(tx.error);};
  });
}

export async function listOfflineCaptures(){
  return transaction<OfflineCapture[]>("readonly",(store,resolve,reject)=>{const req=store.getAll();req.onsuccess=()=>resolve((req.result as OfflineCapture[]).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)));req.onerror=()=>reject(req.error);});
}
export async function putOfflineCapture(capture:OfflineCapture){
  return transaction<void>("readwrite",(store,resolve,reject)=>{const req=store.put(capture);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
}
export async function deleteOfflineCapture(id:string){
  return transaction<void>("readwrite",(store,resolve,reject)=>{const req=store.delete(id);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});
}
export async function updateOfflineCapture(id:string,patch:Partial<OfflineCapture>){
  const captures=await listOfflineCaptures(); const existing=captures.find((item)=>item.id===id); if(!existing)return;
  await putOfflineCapture({...existing,...patch,id:existing.id});
}

export function captureToFormData(item:OfflineCapture){
  const data=new FormData();
  data.append("clientCaptureId",item.id); data.append("projectSlug",item.projectSlug); data.append("siteId",item.siteId); data.append("physicalObjectId",item.physicalObjectId);
  data.append("recordType",item.recordType); data.append("visibility",item.visibility); data.append("title",item.title); data.append("description",item.description);
  data.append("measurementValue",item.measurementValue); data.append("measurementUnit",item.measurementUnit); data.append("capturedAt",item.capturedAt);
  if(item.latitude!==null&&item.latitude!==undefined)data.append("latitude",String(item.latitude));
  if(item.longitude!==null&&item.longitude!==undefined)data.append("longitude",String(item.longitude));
  if(item.accuracyMeters!==null&&item.accuracyMeters!==undefined)data.append("accuracyMeters",String(item.accuracyMeters));
  if(item.file)data.append("file",new File([item.file],item.fileName||"offline-capture",{type:item.fileType||item.file.type||"application/octet-stream"}));
  return data;
}

export async function syncOfflineCaptures(onChange?:(items:OfflineCapture[])=>void){
  const initial=await listOfflineCaptures();
  for(const item of initial){
    if(!navigator.onLine)break;
    await updateOfflineCapture(item.id,{state:"syncing",error:null}); onChange?.(await listOfflineCaptures());
    try{
      const response=await fetch("/api/field/capture",{method:"POST",body:captureToFormData(item)});
      const payload=await response.json() as {error?:string};
      if(response.ok){await deleteOfflineCapture(item.id);}else{
        await updateOfflineCapture(item.id,{state:"conflict",error:payload.error||`Sync failed (${response.status})`});
        if(response.status===401||response.status===403)break;
      }
    }catch(error){
      await updateOfflineCapture(item.id,{state:"queued",error:error instanceof Error?error.message:"Network unavailable"}); break;
    }
    onChange?.(await listOfflineCaptures());
  }
  const result=await listOfflineCaptures();onChange?.(result);return result;
}
