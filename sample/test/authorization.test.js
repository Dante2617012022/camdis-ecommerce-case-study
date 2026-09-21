import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthorization } from '../src/authorization.js';
import { identityForContext, assertSessionContext, requireCsrf } from '../src/sessionPolicy.js';

const identity = roles => ({ sub: 'sample-user', roles });
const session = (context,roles) => ({type:'session',context,identity:identity(roles),csrfToken:'sample-csrf'});
function harness(resolved=null) {
 const calls=[];
 const guards=createAuthorization({resolveAuthentication:async(req,options)=>{calls.push(options);return resolved;}});
 const reply={status:null,body:null,code(n){this.status=n;return this;},send(body){this.body=body;return this;}};
 return {guards,calls,reply,request:{headers:{}}};
}
test('sin sesión interna devuelve 401 y solicita contexto admin sin Bearer',async()=>{
 const h=harness(); await h.guards.authenticateAdmin(h.request,h.reply);
 assert.equal(h.reply.status,401); assert.equal(h.reply.body.error,'AUTHENTICATION_REQUIRED');
 assert.deepEqual(h.calls,[{context:'admin',allowBearer:false}]);
});
test('un cliente autenticado no hereda acceso al área interna',async()=>{
 const h=harness(); h.request.auth=session('customer',['CUSTOMER']);
 await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply);
 assert.equal(h.reply.status,401); assert.deepEqual(h.calls,[{context:'admin',allowBearer:false}]);
});
test('un rol de cliente en contexto interno devuelve 403',async()=>{
 const h=harness(session('admin',['CUSTOMER']));
 await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply);
 assert.equal(h.reply.status,403); assert.equal(h.reply.body.error,'FORBIDDEN');
});
test('rol interno permitido continúa y conserva identidad del resolvedor',async()=>{
 const auth=session('admin',['RECEPTION']); const h=harness(auth);
 assert.equal(await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply),undefined);
 assert.equal(h.reply.status,null); assert.equal(h.request.auth,auth);
});
test('roles desconocidos o con distinta capitalización no otorgan privilegios',async()=>{
 for(const role of ['UNKNOWN','reception']){
  const h=harness(session('admin',[role])); await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply);
  assert.equal(h.reply.status,403);
 }
});
test('un guard sin roles permitidos deniega el acceso',async()=>{
 const h=harness(session('admin',['ADMIN'])); await h.guards.requireAdminRoles()(h.request,h.reply);
 assert.equal(h.reply.status,403);
});
test('una mutación sin autenticación se rechaza antes de comprobar CSRF',async()=>{
 const h=harness(); await h.guards.protectAdminMutation(h.request,h.reply); assert.equal(h.reply.status,401);
});
test('una mutación con sesión rechaza CSRF ausente o incorrecto',async()=>{
 for(const candidate of [undefined,'sample-wrong']){
  const h=harness(session('admin',['RECEPTION'])); h.request.headers['x-csrf-token']=candidate;
  await assert.rejects(h.guards.protectAdminMutation(h.request,h.reply),e=>e.code==='CSRF_INVALID' && e.statusCode===403);
 }
});
test('CSRF correcto y rol permitido habilitan la cadena de controles',async()=>{
 const h=harness(session('admin',['RECEPTION'])); h.request.headers['x-csrf-token']='sample-csrf';
 await h.guards.protectAdminMutation(h.request,h.reply);
 await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply);
 assert.equal(h.reply.status,null);
});
test('CSRF válido no compensa un rol insuficiente',async()=>{
 const h=harness(session('admin',['CUSTOMER'])); h.request.headers['x-csrf-token']='sample-csrf';
 await h.guards.protectAdminMutation(h.request,h.reply);
 await h.guards.requireAdminRoles('RECEPTION')(h.request,h.reply);
 assert.equal(h.reply.status,403);
});
test('la política cliente elimina roles internos sin mutar la identidad original',()=>{
 const original=identity(['ADMIN','RECEPTION']); const result=identityForContext(original,'customer');
 assert.deepEqual(result.roles,['CUSTOMER']); assert.deepEqual(original.roles,['ADMIN','RECEPTION']);
 assert.equal(result.sub,original.sub);
});
test('un contexto desconocido falla explícitamente',()=>{
 for(const value of ['unknown','',null,undefined]) assert.throws(()=>assertSessionContext(value),e=>e.code==='SESSION_CONTEXT_INVALID');
});
test('contexto interno conserva identidad que ya verificó el resolvedor',()=>{
 const original=identity(['RECEPTION']); assert.equal(identityForContext(original,'admin'),original);
});
test('autenticación de cliente permite Bearer al resolvedor',async()=>{
 const h=harness({type:'bearer',context:'bearer',identity:identity(['CUSTOMER'])});
 await h.guards.authenticate(h.request,h.reply);
 assert.deepEqual(h.calls,[{context:'customer',allowBearer:true}]); assert.equal(h.reply.status,null);
});
test('Bearer no exige CSRF: la firma y audiencia se verifican fuera de esta muestra',()=>{
 assert.doesNotThrow(()=>requireCsrf({auth:{type:'bearer'},headers:{}}));
});
