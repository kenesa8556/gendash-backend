// scripts/dev.js: reusable dev helper (login + call the API). Needs Node 18+ and dotenv.
// Usage:
//   node scripts/dev.js token
//   node scripts/dev.js ask "your question"        (default question if omitted)
//   node scripts/dev.js ask "question" --raw        (full JSON)
//   node scripts/dev.js ask "question" --noauth     (expect 401)
//   node scripts/dev.js ask "question" --org=<uuid> (expect 403 for a wrong org)
//   node scripts/dev.js query <queryId>
require('dotenv').config();

const BASE = process.env.API_URL || 'http://localhost:3001';
const DEFAULT_Q =
  'Show monthly sales for each branch over the last 6 months, and my best-selling category';

function need(k) {
  if (!process.env[k]) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
  return process.env[k];
}
async function fetchRetry(url, init, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (e.name === 'AbortError' || i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function token() {
  const r = await fetchRetry(`${need('SUPABASE_URL')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: need('SUPABASE_ANON_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: need('TEST_EMAIL'), password: need('TEST_PASSWORD') }),
  });
  const j = await r.json();
    if (!j.access_token) {
    throw new Error('Login failed: ' + (j.error_description || j.msg || JSON.stringify(j)));
  }
  return j.access_token;
}

async function api(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!opts.noauth) headers.Authorization = `Bearer ${await token()}`;
  headers['x-org-id'] = opts.org || need('TEST_ORG_ID');
  const r = await fetchRetry(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

(async () => {
  const [cmd, ...args] = process.argv.slice(2);
  const raw = args.includes('--raw');
  const noauth = args.includes('--noauth');
  const orgArg = args.find((a) => a.startsWith('--org='));
  const opts = { noauth, org: orgArg ? orgArg.slice(6) : undefined };
  const rest = args.filter((a) => !a.startsWith('--'));

  if (cmd === 'token') {
    console.log(await token());
    return;
  }

  if (cmd === 'ask') {
    const question = rest.join(' ') || DEFAULT_Q;
    const { status, json } = await api('POST', '/dev/ask', { question }, opts);
    if (raw || (status !== 200 && status !== 201)) {
      console.log(status, JSON.stringify(json, null, 2));
      return;
    }
    console.log('status', status, '| attempts', json.attempts, '| timings', json.timings);
    console.log('title:', json.spec.title);
    for (const p of json.spec.panels) {
      const rows = json.data[p.queryId];
      console.log(
        `- [${p.kind}/${p.state}] ${p.label} (${rows.length} rows, partial=${p.partialLastPeriod})`,
      );
      console.log(`  queryId=${p.queryId}`);
    }
    return;
  }

  if (cmd === 'query') {
    const id = rest[0];
    if (!id) {
      console.error('Usage: node scripts/dev.js query <queryId>');
      process.exit(1);
    }
    const { status, json } = await api('GET', `/dev/queries/${id}`, undefined, opts);
    console.log(status, JSON.stringify(json, null, 2));
    return;
  }



    if (cmd === 'stream') {
    const question = rest.join(' ') || DEFAULT_Q;
    const t = await token();
    const t0 = Date.now();
    const ac = new AbortController();
    const ab = args.find((a) => a.startsWith('--abort-after='));
    if (ab) setTimeout(() => ac.abort(), Number(ab.slice(14)));
    const r = await fetchRetry(BASE + '/generate', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${t}`,
        'x-org-id': opts.org || need('TEST_ORG_ID'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    console.log('status', r.status);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = /event: (.*)/.exec(block)?.[1];
        const data = /data: (.*)/.exec(block)?.[1] ?? '';
        console.log(`+${Date.now() - t0}ms ${ev}`, data.length > 150 ? data.slice(0, 150) + '…' : data);
      }
    }
    return;
  }


  console.log('Commands: token | ask "<question>" [--raw|--noauth|--org=<uuid>] | query <queryId>');
})().catch((e) => {
  console.error(e.name === 'AbortError' ? 'aborted by client' : e.message);
  process.exitCode = 1;
});