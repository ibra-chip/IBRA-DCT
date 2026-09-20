const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

const assertStatus = (response, expected, label) => {
  if (response.status !== expected) throw new Error(`${label}: expected ${expected}, received ${response.status}`);
};

const health = await fetch(`${baseUrl}/api/health`);
assertStatus(health, 200, 'health');
const healthBody = await health.json();
if (healthBody.status !== 'ok') throw new Error('health: status is not ok');
console.log(`health ok: ${baseUrl}`);

const email = process.env.SMOKE_LOGIN_EMAIL;
const password = process.env.SMOKE_LOGIN_PASSWORD;
if (!email || !password) {
  console.log('auth smoke skipped: set SMOKE_LOGIN_EMAIL and SMOKE_LOGIN_PASSWORD to run authenticated checks');
  process.exit(0);
}

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
assertStatus(login, 201, 'login');
const setCookie = login.headers.get('set-cookie');
if (!setCookie?.includes('ibra_session=')) throw new Error('login: missing ibra_session cookie');

const sessionCookie = setCookie.split(';')[0];
const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie: sessionCookie } });
assertStatus(me, 200, 'me');
const meBody = await me.json();
if (!meBody.user?.id || !meBody.user?.company) throw new Error('me: missing sanitized user context');

const projects = await fetch(`${baseUrl}/api/projects`, { headers: { cookie: sessionCookie } });
assertStatus(projects, 200, 'projects');
const projectBody = await projects.json();
if (!Array.isArray(projectBody)) throw new Error('projects: response is not an array');

const projectId = process.env.SMOKE_PROJECT_ID;
if (projectId) {
  const headers = { cookie: sessionCookie };
  const documents = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/documents`, { headers });
  assertStatus(documents, 200, 'documents');
  if (!Array.isArray(await documents.json())) throw new Error('documents: response is not an array');
  const checklists = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/checklists`, { headers });
  assertStatus(checklists, 200, 'checklists');
  if (!Array.isArray(await checklists.json())) throw new Error('checklists: response is not an array');
}

console.log(`auth and projects ok: ${meBody.user.email}${projectId ? `; project parity ok: ${projectId}` : ''}`);
