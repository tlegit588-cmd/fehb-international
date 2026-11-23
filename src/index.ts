export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  BOOTSTRAP_SECRET: string;
}
const SESSION_SECONDS = 43200;
const ITERATIONS = 310000;
const enc = new TextEncoder();
const origins = (env: Env) => new Set((env.ALLOWED_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean));
const headers = (req: Request, env: Env) => {
  const h = new Headers({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'","Vary":"Origin"});
  const origin = req.headers.get("Origin");
  if (origin && origins(env).has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials","true");
    h.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    h.set("Access-Control-Allow-Headers","Content-Type, X-Bootstrap-Secret");
  }
  return h;
};
const reply = (req: Request, env: Env, data: unknown, status=200, extra?: HeadersInit) => {
  const h=headers(req,env); new Headers(extra).forEach((v,k)=>h.set(k,v));
  return Response.json(data,{status,headers:h});
};
const fail=(req:Request,env:Env,error:string,status:number)=>reply(req,env,{success:false,error},status);
const b64=(a:Uint8Array)=>{let s="";for(const x of a)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");};
const unb64=(s:string)=>{const t=s.replace(/-/g,"+").replace(/_/g,"/");const b=atob(t+"=".repeat((4-t.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0));};
const digest=async(s:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))));
const derive=async(p:string,salt:Uint8Array)=>{const key=await crypto.subtle.importKey("raw",enc.encode(p),"PBKDF2",false,["deriveBits"]);return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},key,256));};
const makeHash=async(p:string)=>{const salt=crypto.getRandomValues(new Uint8Array(16));return "pbkdf2-sha256$"+ITERATIONS+"$"+b64(salt)+"$"+b64(await derive(p,salt));};
const checkHash=async(p:string,h:string)=>{const a=h.split("$");if(a.length!==4||a[0]!=="pbkdf2-sha256"||Number(a[1])!==ITERATIONS)return false;try{const x=await derive(p,unb64(a[2])),y=unb64(a[3]);if(x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}catch{return false;}};
const equalSecret=async(a:string,b:string)=>{const x=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(a))),y=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(b)));let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;};
const cookie=(req:Request)=>{for(const part of (req.headers.get("Cookie")||"").split(";")){const [k,...v]=part.trim().split("=");if(k==="fehb_session")return v.join("=")||null;}return null;};
const setCookie=(token:string)=>"fehb_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+SESSION_SECONDS;
const clearCookie=()=>"fehb_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
const originOK=(req:Request,env:Env)=>{const o=req.headers.get("Origin");return !!o&&origins(env).has(o);};
const body=async(req:Request)=>{if(Number(req.headers.get("Content-Length")||"0")>10000)return null;try{const x:unknown=await req.json();return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;}catch{return null;}};
const audit=async(env:Env,id:string,action:string)=>env.DB.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id) VALUES (?, ?, ?, 'auth', ?)").bind(crypto.randomUUID(),id,action,id).run();
const sessionUser=async(req:Request,env:Env)=>{
  const t=cookie(req);if(!t)return null;const hash=await digest(t);
  const u=await env.DB.prepare("SELECT u.id,u.full_name,u.email,r.access_role AS role,u.status FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id JOIN staff_roles r ON r.user_id=u.id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.status='active'").bind(hash).first<Record<string,unknown>>();
  if(u)await env.DB.prepare("UPDATE staff_sessions SET last_seen_at=datetime('now') WHERE token_hash=?").bind(hash).run();
  return u;
};
export default { async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req,env)});
  if(req.headers.get("Origin")&&!originOK(req,env))return fail(req,env,"Origin not allowed",403);
  if(req.method==="GET"&&url.pathname==="/api/health"){
    try{await env.DB.prepare("SELECT 1").first();return reply(req,env,{service:"FEHB International Platform API",status:"online",version:"0.3.0",database:"connected"});}
    catch{return reply(req,env,{service:"FEHB International Platform API",status:"degraded",version:"0.3.0",database:"unavailable"},503);}
  }
  if(url.pathname==="/api/auth/bootstrap"&&req.method==="POST"){
    if(!originOK(req,env))return fail(req,env,"Origin not allowed",403);
    const supplied=req.headers.get("X-Bootstrap-Secret")||"";
    if(!env.BOOTSTRAP_SECRET||!await equalSecret(supplied,env.BOOTSTRAP_SECRET))return fail(req,env,"Initial setup is not authorized",403);
    const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM staff_users").first<{count:number}>();
    if((count?.count||0)>0)return fail(req,env,"Initial setup has already been completed",409);
    const data=await body(req),name=typeof data?.name==="string"?data.name.trim():"",email=typeof data?.email==="string"?data.email.trim().toLowerCase():"",password=typeof data?.password==="string"?data.password:"";
    if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>128)return fail(req,env,"Enter a valid name, email and password of at least 12 characters",400);
    const id=crypto.randomUUID(),hash=await makeHash(password);
    try{await env.DB.batch([
      env.DB.prepare("INSERT INTO staff_users (id,full_name,email,role,status) VALUES (?, ?, ?, 'super_admin','active')").bind(id,name,email),
      env.DB.prepare("INSERT INTO staff_roles (user_id,access_role) VALUES (?, 'super_admin')").bind(id),
      env.DB.prepare("INSERT INTO staff_credentials (user_id,password_hash) VALUES (?, ?)").bind(id,hash),
      env.DB.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id) VALUES (?, ?, 'initial_admin_created','auth',?)").bind(crypto.randomUUID(),id,id)
    ]);}catch{return fail(req,env,"Could not create the first administrator. Confirm that the database migration has been applied.",500);}
    return reply(req,env,{success:true,message:"Initial administrator created. Sign in to continue."},201);
  }
  if(url.pathname==="/api/auth/login"&&req.method==="POST"){
    if(!originOK(req,env))return fail(req,env,"Origin not allowed",403);
    const data=await body(req),email=typeof data?.email==="string"?data.email.trim().toLowerCase():"",password=typeof data?.password==="string"?data.password:"";
    if(!email||!password||email.length>254||password.length>128)return fail(req,env,"Invalid email or password",400);
    const ip=req.headers.get("CF-Connecting-IP")||"unknown",key=await digest(email+"|"+ip),now=Math.floor(Date.now()/1000);
    const rate=await env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM auth_rate_limits WHERE rate_key=?").bind(key).first<{attempts:number;window_started_at:number;blocked_until:number|null}>();
    if(rate?.blocked_until&&rate.blocked_until>now)return fail(req,env,"Too many attempts. Wait 15 minutes before trying again.",429);
    if(rate&&now-rate.window_started_at<900&&rate.attempts>=5){await env.DB.prepare("UPDATE auth_rate_limits SET blocked_until=? WHERE rate_key=?").bind(now+900,key).run();return fail(req,env,"Too many attempts. Wait 15 minutes before trying again.",429);}
    const user=await env.DB.prepare("SELECT u.id,u.full_name,u.email,u.status,c.password_hash,r.access_role AS role FROM staff_users u JOIN staff_credentials c ON c.user_id=u.id JOIN staff_roles r ON r.user_id=u.id WHERE u.email=? LIMIT 1").bind(email).first<Record<string,unknown>>();
    const ok=!!user&&user.status==="active"&&await checkHash(password,String(user.password_hash||""));
    if(!ok){
      if(!rate||now-rate.window_started_at>=900)await env.DB.prepare("INSERT INTO auth_rate_limits (rate_key,attempts,window_started_at,blocked_until) VALUES (?,1,?,NULL) ON CONFLICT(rate_key) DO UPDATE SET attempts=1,window_started_at=excluded.window_started_at,blocked_until=NULL").bind(key,now).run();
      else await env.DB.prepare("UPDATE auth_rate_limits SET attempts=attempts+1 WHERE rate_key=?").bind(key).run();
      return fail(req,env,"Invalid email or password",401);
    }
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE rate_key=?").bind(key).run();
    const token=b64(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await digest(token);
    await env.DB.prepare("INSERT INTO staff_sessions (token_hash,user_id,expires_at) VALUES (?, ?, datetime('now','+12 hours'))").bind(tokenHash,user.id).run();
    await audit(env,String(user.id),"login");
    return reply(req,env,{success:true,user:{full_name:user.full_name,email:user.email,role:user.role,status:user.status}},200,{"Set-Cookie":setCookie(token)});
  }
  if(url.pathname==="/api/auth/me"&&req.method==="GET"){
    const user=await sessionUser(req,env);if(!user)return fail(req,env,"Not signed in",401);
    return reply(req,env,{success:true,user:{full_name:user.full_name,email:user.email,role:user.role,status:user.status}});
  }
  if(url.pathname==="/api/auth/logout"&&req.method==="POST"){
    if(!originOK(req,env))return fail(req,env,"Origin not allowed",403);
    const token=cookie(req);if(token){const hash=await digest(token),s=await env.DB.prepare("SELECT user_id FROM staff_sessions WHERE token_hash=?").bind(hash).first<{user_id:string}>();await env.DB.prepare("DELETE FROM staff_sessions WHERE token_hash=?").bind(hash).run();if(s)await audit(env,s.user_id,"logout");}
    return reply(req,env,{success:true},200,{"Set-Cookie":clearCookie()});
  }
  if(url.pathname.startsWith("/api/"))return fail(req,env,"This API endpoint is not implemented yet.",501);
  return reply(req,env,{error:"Not found"},404);
} } satisfies ExportedHandler<Env>;
