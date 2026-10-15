import { Redis } from '@upstash/redis';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const defaults = Object.freeze({
  sessionTTL: 604800, maxHistory: 100, transcriptBytes: 2 * 1024 * 1024,
  slotBytes: 2304 * 1024, storageBytes: 200 * 1024 * 1024,
  commandBytes: 65536, outputBytes: 2 * 1024 * 1024,
  commandMs: 720000, dailyMs: 3600000, concurrency: 2,
  commandRate: 30, sessionRate: 5, requestRate: 120,
});
export const initialState = () => ({ text: ['', ''], textset: [false, false], colors: true, diagram: 'svg', maxresults: 100 });

export async function connectStore(env = process.env, config = {}) {
  let run;
  // The TCP path is for local Docker/testing; production uses the provisioned REST integration.
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    const redis = new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN,
      automaticDeserialization: false, retry: { retries: 1 }, signal: () => AbortSignal.timeout(5000) });
    run = (script, keys, args) => redis.eval(script, keys, args.map(String));
  } else if (env.REDIS_URL && !env.VERCEL) {
    const redis = createClient({ url: env.REDIS_URL });
    redis.on('error', () => {});
    await redis.connect();
    run = (script, keys, args) => redis.eval(script, { keys, arguments: args.map(String) });
    run.close = () => redis.quit();
  } else throw new Error('Redis integration credentials are required');
  return new Store(run, config);
}

const recoverPending = `
  if s.pending and not redis.call('GET', KEYS[2]) then
    local p = s.pending
    s.revision=s.revision+1
    table.insert(s.history, {requestId=p.requestId, command=p.command, status='failed', code='interrupted',
      message='The server stopped before completing this command. Previous state was retained.',
      startedAt=p.startedAt, finishedAt=tonumber(ARGV[RECOVERY_NOW]), durationMs=p.reservedMs, revision=s.revision, events={}})
    while #s.history > 100 or #cjson.encode(s.history) > 2097152 do table.remove(s.history, 1) end
    s.pending=nil; redis.call('SET', KEYS[1], cjson.encode(s), 'KEEPTTL')
  end
`;

export class Store {
  constructor(run, config = {}) {
    this.run = run;
    this.config = { ...defaults, ...config };
    this.prefix = config.prefix || `bibref:${process.env.BIBREF_NAMESPACE || process.env.VERCEL_ENV || 'development'}`;
    // Budgets and quotas are shared by preview and production, sessions are not.
    this.global = config.global || 'bibref:limits';
  }
  key(id) { return `${this.prefix}:session:${id}`; }
  lock(id) { return `${this.key(id)}:active`; }
  cancelKey(id) { return `${this.key(id)}:cancel`; }
  async eval(script, keys, args = []) {
    const value = await this.run(script, keys, args);
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
  check(result) {
    if (result.error) throw new ApiError(result.error, ({ not_found: 404, busy: 409, stale_revision: 409,
      incompatible_version: 409, closed: 410, storage_full: 503, daily_budget: 429,
      capacity: 429, rate_limit: 429, lease_lost: 409 })[result.error] || 400);
    return result;
  }
  async rate(ip, category) {
    const limits = { commands: [this.config.commandRate, 60], sessions: [this.config.sessionRate, 3600], requests: [this.config.requestRate, 60], pythonStarts: [5, 3600], pythonOperations: [120, 60] };
    const [limit, window] = limits[category];
    return this.check(await this.eval(`
      local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
      if n > tonumber(ARGV[1]) then return cjson.encode({error='rate_limit'}) end
      return cjson.encode({ok=true})`, [`${this.global}:rate:${category}:${ip}`], [limit, window]));
  }
  async create(owner, version) {
    const id = randomUUID(), now = Date.now();
    const session = { id, owner, version, revision: 0, state: initialState(), history: [], createdAt: now, lastActiveAt: now, closed: false };
    const c = this.config;
    this.check(await this.eval(`
      redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
      if (redis.call('ZCARD', KEYS[2]) + 1) * tonumber(ARGV[4]) > tonumber(ARGV[5]) then return cjson.encode({error='storage_full'}) end
      redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[2])
      redis.call('ZADD', KEYS[2], tonumber(ARGV[1]) + tonumber(ARGV[2])*1000, KEYS[1])
      return cjson.encode({ok=true})`, [this.key(id), `${this.global}:sessions`], [now, c.sessionTTL, JSON.stringify(session), c.slotBytes, c.storageBytes]));
    return session;
  }
  async get(id, owner, touch = true) {
    const c = this.config;
    const result = this.check(await this.eval(`
      local raw = redis.call('GET', KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      local s = cjson.decode(raw); if s.owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      ${recoverPending.replaceAll('RECOVERY_NOW', '3')}
      if ARGV[2] == '1' then
        redis.call('EXPIRE', KEYS[1], ARGV[4]); redis.call('ZADD', KEYS[3], tonumber(ARGV[3])+tonumber(ARGV[4])*1000, KEYS[1])
      end
      local active = redis.call('GET', KEYS[2]); if active then active = cjson.decode(active) end
      return cjson.encode({session=s, active=active})`, [this.key(id), this.lock(id), `${this.global}:sessions`], [owner, touch ? 1 : 0, Date.now(), c.sessionTTL]));
    // Redis cjson encodes an empty Lua array as an object.
    if (!Array.isArray(result.session.history)) result.session.history = [];
    return result;
  }
  async claim(id, owner, revision, requestId, command, version, maxDeadline = Infinity) {
    const now = Date.now(), c = this.config, token = randomUUID();
    const reservedMs = Math.max(1, Math.min(c.commandMs, maxDeadline - now));
    const day = new Date(now).toISOString().slice(0, 10), budgetKey = `${this.global}:day:${day}`;
    const job = { requestId, token, command, startedAt: now, deadline: now + reservedMs, budgetKey, reservedMs };
    const result = this.check(await this.eval(`
      local raw = redis.call('GET', KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      local s = cjson.decode(raw); if s.owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      ${recoverPending.replaceAll('RECOVERY_NOW', '6')}
      for _,h in ipairs(s.history) do if h.requestId == ARGV[3] then
        if h.command ~= ARGV[4] then return cjson.encode({error='request_id_reused'}) end
        return cjson.encode({status='recorded', record=h, revision=s.revision}) end end
      local running = redis.call('GET', KEYS[2]); if running then
        local a = cjson.decode(running)
        if a.requestId == ARGV[3] and a.command == ARGV[4] then return cjson.encode({status='running', active=a}) end
        return cjson.encode({error='busy'}) end
      if s.closed then return cjson.encode({error='closed'}) end
      if s.python then
        if tonumber(ARGV[6]) >= s.python.deadline then return cjson.encode({error='timeout'}) end
        if s.revision >= 256 then return cjson.encode({error='operation_limit'}) end
        if s.python.bytes >= 2097152 then return cjson.encode({error='output_limit'}) end
      end
      if s.version ~= ARGV[5] then return cjson.encode({error='incompatible_version'}) end
      if s.revision ~= tonumber(ARGV[2]) then return cjson.encode({error='stale_revision'}) end
      redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[6])
      if redis.call('ZCARD', KEYS[3]) >= tonumber(ARGV[7]) then return cjson.encode({error='capacity'}) end
      local used = tonumber(redis.call('GET', KEYS[4]) or 0)
      if used + tonumber(ARGV[8]) > tonumber(ARGV[9]) then return cjson.encode({error='daily_budget'}) end
      s.pending=cjson.decode(ARGV[10])
      if #cjson.encode(s) > tonumber(ARGV[12]) then return cjson.encode({error='storage_full'}) end
      redis.call('INCRBY', KEYS[4], ARGV[8]); redis.call('EXPIRE', KEYS[4], 172800)
      redis.call('ZADD', KEYS[3], tonumber(ARGV[6])+tonumber(ARGV[8])+30000, KEYS[2])
      redis.call('SET', KEYS[1], cjson.encode(s), 'KEEPTTL')
      redis.call('DEL', KEYS[5]); redis.call('SET', KEYS[2], ARGV[10], 'PX', tonumber(ARGV[8])+30000)
      local ttl=tonumber(ARGV[11]); if s.python then ttl=math.max(1,math.ceil((s.python.deadline-tonumber(ARGV[6]))/1000)+30) end
      redis.call('EXPIRE', KEYS[1], ttl); redis.call('ZADD', KEYS[6], tonumber(ARGV[6])+ttl*1000, KEYS[1])
      return cjson.encode({status='accepted', session=s})`,
      [this.key(id), this.lock(id), `${this.global}:running`, budgetKey, this.cancelKey(id), `${this.global}:sessions`],
      [owner, revision, requestId, command, version, now, c.concurrency, reservedMs, c.dailyMs, JSON.stringify(job), c.sessionTTL, c.slotBytes]));
    if (result.session && !Array.isArray(result.session.history)) result.session.history = [];
    return { ...result, job };
  }
  async poll(id, job) {
    return this.eval(`
      local a = redis.call('GET', KEYS[1]); if not a then return cjson.encode({cancel=true}) end
      if cjson.decode(a).token ~= ARGV[1] then return cjson.encode({cancel=true}) end
      return cjson.encode({cancel=redis.call('EXISTS', KEYS[2]) == 1})`, [this.lock(id), this.cancelKey(id)], [job.token]);
  }
  async cancel(id, owner, requestId) {
    return this.check(await this.eval(`
      local s = redis.call('GET', KEYS[1]); if not s or cjson.decode(s).owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      local a = redis.call('GET', KEYS[2]); if not a or cjson.decode(a).requestId ~= ARGV[2] then return cjson.encode({error='not_found'}) end
      redis.call('SET', KEYS[3], '1', 'PX', ARGV[3]); return cjson.encode({ok=true})`,
      [this.key(id), this.lock(id), this.cancelKey(id)], [owner, requestId, this.config.commandMs + 30000]));
  }
  async finish(id, session, job, record, state, closed = false) {
    const c = this.config;
    const ttl = session.python ? Math.max(1, Math.ceil((session.python.deadline - Date.now()) / 1000) + 30) : c.sessionTTL;
    const next = { ...session, lastActiveAt: Date.now(), state: state || session.state,
      revision: session.revision + 1, closed: state ? closed : session.closed };
    delete next.pending;
    record.revision = next.revision;
    if (Buffer.byteLength(JSON.stringify([record])) > c.transcriptBytes) {
      record.events = [{ type: 'output', kind: 'text', text: 'Output was delivered live but exceeds retained history capacity.\n' }];
      record.historyTruncated = true;
    }
    next.history = [...session.history, record].slice(-c.maxHistory);
    while (next.history.length && Buffer.byteLength(JSON.stringify(next.history)) > c.transcriptBytes) next.history.shift();
    if (Buffer.byteLength(JSON.stringify(next)) > c.slotBytes) throw new ApiError('storage_full', 503);
    return this.check(await this.eval(`
      local a = redis.call('GET', KEYS[2]); if not a or cjson.decode(a).token ~= ARGV[1] then return cjson.encode({error='lease_lost'}) end
      if ARGV[8] == '1' and redis.call('EXISTS', KEYS[5]) == 1 then return cjson.encode({error='cancelled'}) end
      local raw = redis.call('GET', KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      if cjson.decode(raw).revision ~= tonumber(ARGV[2]) then return cjson.encode({error='stale_revision'}) end
      redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4]); redis.call('ZADD', KEYS[6], tonumber(ARGV[7])+tonumber(ARGV[4])*1000, KEYS[1])
      redis.call('DEL', KEYS[2], KEYS[5]); redis.call('ZREM', KEYS[3], KEYS[2])
      redis.call('DECRBY', KEYS[4], ARGV[5]); redis.call('EXPIRE', KEYS[4], 172800)
      return cjson.encode({revision=tonumber(ARGV[6])})`,
      [this.key(id), this.lock(id), `${this.global}:running`, job.budgetKey, this.cancelKey(id), `${this.global}:sessions`],
      [job.token, session.revision, JSON.stringify(next), ttl,
        Math.max(0, job.reservedMs - Math.min(job.reservedMs, record.durationMs)), next.revision, Date.now(), state ? 1 : 0]));
  }
  async remove(id, owner) {
    this.check(await this.eval(`
      local s = redis.call('GET', KEYS[1]); if not s or cjson.decode(s).owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      if redis.call('EXISTS', KEYS[2]) == 1 then return cjson.encode({error='busy'}) end
      redis.call('DEL', KEYS[1], KEYS[3]); redis.call('ZREM', KEYS[4], KEYS[1]); return cjson.encode({ok=true})`,
      [this.key(id), this.lock(id), this.cancelKey(id), `${this.global}:sessions`], [owner]));
  }
}
