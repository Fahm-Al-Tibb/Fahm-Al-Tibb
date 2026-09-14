const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const PORT=process.env.PORT||3000, HOST='0.0.0.0';
const ROOT=__dirname, PUB=path.join(ROOT,'public'), DB=path.join(ROOT,'data','users.json'), DATA=path.join(ROOT,'data');
const COOKIE='fahm_session'; const sessions=new Map();
function readDB(){try{return JSON.parse(fs.readFileSync(DB,'utf8'))}catch{return {users:[]}}}
function writeDB(x){fs.mkdirSync(path.dirname(DB),{recursive:true});fs.writeFileSync(DB,JSON.stringify(x,null,2))}
function hash(p,s=crypto.randomBytes(16).toString('hex')){return {salt:s,hash:crypto.scryptSync(p,s,64).toString('hex')}}
function verify(p,u){return crypto.timingSafeEqual(Buffer.from(hash(p,u.salt).hash,'hex'),Buffer.from(u.hash,'hex'))}
function token(){return crypto.randomBytes(32).toString('hex')}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{let i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function user(req){let t=parseCookies(req)[COOKIE]; return t?sessions.get(t):null}
function send(res,code,obj){let b=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(b)}
function body(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(d?JSON.parse(d):{})}catch(e){reject(e)}})})}
function safeName(s){return String(s||'').trim().slice(0,60)}
function requireAuth(req,res,admin=false){let u=user(req);if(!u)return send(res,401,{error:'AUTH_REQUIRED'});if(u.status!=='approved')return send(res,403,{error:'PENDING_APPROVAL',status:u.status});if(admin&&!u.admin)return send(res,403,{error:'ADMIN_ONLY'});return u}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json'};
function serve(req,res){let p=new URL(req.url,'http://x').pathname;if(p==='/')p='/index.html';let f=path.normalize(path.join(PUB,p));if(!f.startsWith(PUB))return send(res,404,{error:'NOT_FOUND'});fs.readFile(f,(e,b)=>{if(e)return send(res,404,{error:'NOT_FOUND'});res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(b)})}
function ensureAdmin(){let db=readDB();if(db.users.some(u=>u.admin))return;let email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),pw=process.env.ADMIN_PASSWORD||'';if(!email||pw.length<12){console.error('ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) are required');return}let h=hash(pw);db.users.push({id:crypto.randomUUID(),name:'Administrator',email,salt:h.salt,hash:h.hash,status:'approved',admin:true,createdAt:new Date().toISOString()});writeDB(db)}ensureAdmin();
function loadData(){let b='';for(let i=1;i<=4;i++)b+=fs.readFileSync(path.join(DATA,`data.part${i}`),'utf8');return JSON.parse(zlib.brotliDecompressSync(Buffer.from(b,'base64')).toString('utf8'))}
async function api(req,res){let url=new URL(req.url,'http://x'),p=url.pathname;try{
if(req.method==='POST'&&p==='/api/register'){let x=await body(req),email=String(x.email||'').trim().toLowerCase(),pw=String(x.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||pw.length<8||safeName(x.name).length<2)return send(res,400,{error:'Use a valid email, name, and password of at least 8 characters.'});let db=readDB();if(db.users.some(u=>u.email===email))return send(res,409,{error:'ACCOUNT_EXISTS'});let h=hash(pw);db.users.push({id:crypto.randomUUID(),name:safeName(x.name),email,salt:h.salt,hash:h.hash,status:'pending',admin:false,createdAt:new Date().toISOString()});writeDB(db);return send(res,201,{status:'pending'})}
if(req.method==='POST'&&p==='/api/login'){let x=await body(req),db=readDB(),u=db.users.find(a=>a.email===String(x.email||'').trim().toLowerCase());if(!u||!verify(String(x.password||''),u))return send(res,401,{error:'INVALID_LOGIN'});let t=token();sessions.set(t,{id:u.id,name:u.name,email:u.email,status:u.status,admin:!!u.admin});res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`${COOKIE}=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`});return res.end(JSON.stringify({status:u.status,user:{name:u.name,email:u.email,admin:!!u.admin}}))}
if(req.method==='POST'&&p==='/api/logout'){let t=parseCookies(req)[COOKIE];if(t)sessions.delete(t);res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`});return res.end('{}')}
if(req.method==='GET'&&p==='/api/me'){let u=user(req);return send(res,200,{authenticated:!!u,user:u||null})}
let u=requireAuth(req,res);if(!u)return;
if(req.method==='GET'&&p==='/api/data')return send(res,200,loadData());
if(req.method==='GET'&&p==='/api/state'){let db=readDB(),a=db.users.find(z=>z.id===u.id);return send(res,200,{state:a?.state||{items:{},revisions:{},mistakes:[]}})}
if(req.method==='PUT'&&p==='/api/state'){let x=await body(req),db=readDB(),i=db.users.findIndex(z=>z.id===u.id);db.users[i].state=x.state||{items:{},revisions:{},mistakes:[]};writeDB(db);return send(res,200,{ok:true})}
if(req.method==='GET'&&p==='/api/admin/users'){if(!u.admin)return send(res,403,{error:'ADMIN_ONLY'});let db=readDB();return send(res,200,{users:db.users.map(({id,name,email,status,admin,createdAt})=>({id,name,email,status,admin,createdAt}))})}
if(req.method==='POST'&&/^\/api\/admin\/users\/(approve|reject|revoke)$/.test(p)){if(!u.admin)return send(res,403,{error:'ADMIN_ONLY'});let x=await body(req),db=readDB(),a=db.users.find(z=>z.id===x.id);if(!a)return send(res,404,{error:'USER_NOT_FOUND'});a.status=p.endsWith('approve')?'approved':'rejected';writeDB(db);return send(res,200,{ok:true})}
send(res,404,{error:'NOT_FOUND'})}catch(e){console.error(e);send(res,500,{error:'SERVER_ERROR'})}}
http.createServer((req,res)=>req.url.startsWith('/api/')?api(req,res):serve(req,res)).listen(PORT,HOST,()=>console.log(`Fahm Al-Tibb running on http://localhost:${PORT}`));