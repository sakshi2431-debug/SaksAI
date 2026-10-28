import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../sakllm-worker/floral-rain-aae6/src/index.js';
import handler from '../pages/api/chat.js';
import { publicSearchHeaders, searchDocuments } from '../sakllm-worker/floral-rain-aae6/src/security.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const jwt = role => `e30.${Buffer.from(JSON.stringify({role})).toString('base64url')}.test-signature`;
const request = value => new Request('https://portfolio.example/api/chat', {method:'POST', body: typeof value === 'string' ? value : JSON.stringify(value)});
const env = {SUPABASE_SEARCH_ENABLED:'true', SUPABASE_URL:'https://example.supabase.co', SUPABASE_ANON_KEY:jwt('anon'), LLM_API_KEY:'test-only'};

test('public search rejects both old and new elevated credentials', () => {
  for (const key of [jwt('service_role'), 'sb_secret_test', 'invalid']) {
    assert.throws(() => publicSearchHeaders({...env, SUPABASE_ANON_KEY:key}));
  }
  assert.throws(() => publicSearchHeaders({SUPABASE_URL:env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY:jwt('service_role')}));
});
test('publishable keys do not become invalid bearer JWTs', () => {
  const headers = publicSearchHeaders({...env, SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
  assert.equal(headers.apikey,'sb_publishable_test');
  assert.equal(headers.Authorization,undefined);
});
test('legacy anon key retains bearer authentication', () => {
  assert.equal(publicSearchHeaders(env).Authorization,`Bearer ${env.SUPABASE_ANON_KEY}`);
});
test('bad JSON, wrong types, null and blank questions return 400 without calling providers', async () => {
  globalThis.fetch = () => { throw new Error('must not call provider'); };
  for (const value of ['{', 'null', {message:3}, {message:{}}, {message:''}, {message:'x'.repeat(4001)}]) {
    assert.equal((await worker.fetch(request(value),env)).status,400);
  }
});
test('actual request bytes are bounded even without Content-Length', async () => {
  assert.equal((await worker.fetch(request({message:'x'.repeat(21000)}),env)).status,413);
});
test('methods and unknown routes do not trigger upstream calls', async () => {
  assert.equal((await worker.fetch(new Request('https://portfolio.example/'),env)).status,405);
  assert.equal((await worker.fetch(new Request('https://portfolio.example/private'),env)).status,404);
});
test('provider errors and keys are never returned to visitors', async () => {
  globalThis.fetch = async () => Response.json({error:{message:'private provider detail'}},{status:401});
  const res = await worker.fetch(request({message:'erbuddy'}),env);
  assert.equal(res.status,500);
  assert.doesNotMatch(await res.text(),/private provider detail|test-only/);
});
test('empty model responses are handled as failures', async () => {
  globalThis.fetch = async () => Response.json({choices:[]});
  assert.equal((await worker.fetch(request({message:'erbuddy'}),env)).status,500);
});
test('corrected team attribution reaches the model context', async () => {
  globalThis.fetch = async (_url,options) => {
    const payload = JSON.parse(options.body);
    assert.match(payload.messages[1].content,/Design Lead on a team of three/);
    return Response.json({choices:[{message:{content:JSON.stringify({answer:'A team design project.',followups:['Read more',7]})}}]});
  };
  const res = await worker.fetch(request({message:'erbuddy'}),env);
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).followups,['Read more']);
});
test('database failures and malformed response shapes are rejected', async () => {
  globalThis.fetch = async () => Response.json({message:'private database detail'},{status:403});
  await assert.rejects(searchDocuments(env,'question'),/Search request failed/);
  globalThis.fetch = async () => Response.json({content:'wrong shape'});
  await assert.rejects(searchDocuments(env,'question'),/Invalid search response/);
});
test('Next API rejects invalid messages before database access', async () => {
  const response = {status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',body:{message:42}},response);
  assert.equal(response.statusCode,400);
});

test('database retrieval stays disabled until explicitly reviewed and enabled', async () => {
  await assert.rejects(searchDocuments({...env,SUPABASE_SEARCH_ENABLED:undefined},'question'),/disabled/);
});
test('about does not shadow a specific project question', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.match(JSON.parse(options.body).messages[1].content,/Fine-Tuned Award/);
    return Response.json({choices:[{message:{content:JSON.stringify({answer:'A team award.',followups:[]})}}]});
  };
  assert.equal((await worker.fetch(request({message:'Tell me about Amazon Music'}),env)).status,200);
});
