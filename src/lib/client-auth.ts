'use client';
/** Firebase Auth-compatible presentation facade for GU V5's existing UI.
 * Server sessions use secure HttpOnly cookies. No credential in localStorage.
 */
export type User={uid:string;email:string|null;getIdToken:(refresh?:boolean)=>Promise<string>};
type Callback=(user:User|null)=>void;
class Auth {
 currentUser:User|null=null;
 listeners=new Set<Callback>();
 booted=false;start:Promise<void>|null=null;
 set(data:{uid:string;email:string}|null){this.currentUser=data?{uid:data.uid,email:data.email,getIdToken:async()=> 'cookie-session'}:null;for(const cb of this.listeners)cb(this.currentUser);}
 async load(){
  if(this.booted)return;
  if(!this.start)this.start=(async()=>{
   try{const res=await fetch('/api/local-auth',{cache:'no-store'});const data=await res.json();this.set(res.ok?data.user:null);}catch{this.set(null);}finally{this.booted=true;}
  })();
  await this.start;
 }
}
const instance=new Auth();
export function clientAuth(){return instance;}
export function onAuthStateChanged(auth:Auth,cb:Callback,_onError?:(e:Error)=>void){auth.listeners.add(cb);if(auth.booted)queueMicrotask(()=>cb(auth.currentUser));else void auth.load();return ()=>{auth.listeners.delete(cb);};}
export async function signInWithEmailAndPassword(auth:Auth,email:string,password:string){
 const res=await fetch('/api/local-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password}),credentials:'same-origin'});
 const response=await res.json();if(!res.ok)throw Error(response.error||'Không đăng nhập được');auth.set(response.user);return {user:auth.currentUser};
}
export async function signOut(auth:Auth){try{await fetch('/api/local-auth',{method:'DELETE',credentials:'same-origin'});}finally{auth.set(null);}}
