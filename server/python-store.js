import { randomUUID } from 'node:crypto';
import { Store, ApiError, initialState } from './store.js';

// Private sessions reuse atomic admission, cancellation, deduplication and budget
// accounting, but live outside the public terminal-session namespace.
export class PythonStore extends Store {
  constructor(parent) {
    super(parent.run, { ...parent.config, prefix: `${parent.prefix}:python`, global: parent.global,
      sessionTTL: 720, maxHistory: 256 });
    this.parent = parent;
  }
  link(id) { return `${this.parent.key(id)}:python-active`; }
  async createRun(parentId, owner, revision, version) {
    const id = randomUUID(), now = Date.now(), deadline = now + 720000, c = this.config;
    const result = this.check(await this.eval(`
      local raw=redis.call('GET', KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      local parent=cjson.decode(raw)
      if parent.owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      if parent.closed then return cjson.encode({error='closed'}) end
      if parent.version ~= ARGV[2] then return cjson.encode({error='incompatible_version'}) end
      if parent.revision ~= tonumber(ARGV[3]) then return cjson.encode({error='stale_revision'}) end
      if parent.pending or redis.call('EXISTS',KEYS[5])==1 then return cjson.encode({error='busy'}) end
      if redis.call('EXISTS',KEYS[2])==1 then return cjson.encode({error='busy'}) end
      redis.call('ZREMRANGEBYSCORE',KEYS[4],'-inf',ARGV[4])
      if (redis.call('ZCARD',KEYS[4])+1)*tonumber(ARGV[7])>tonumber(ARGV[8]) then return cjson.encode({error='storage_full'}) end
      local s={id=ARGV[5],owner=ARGV[1],version=ARGV[2],revision=0,state=parent.state,
        history={},closed=false,createdAt=tonumber(ARGV[4]),lastActiveAt=tonumber(ARGV[4]),
        python={parentId=parent.id,deadline=tonumber(ARGV[6]),bytes=0}}
      redis.call('SET',KEYS[3],cjson.encode(s),'PX',750000)
      redis.call('SET',KEYS[2],ARGV[5],'PX',750000)
      redis.call('ZADD',KEYS[4],tonumber(ARGV[4])+750000,KEYS[3])
      return cjson.encode({id=ARGV[5],deadline=tonumber(ARGV[6])})`,
    [this.parent.key(parentId), this.link(parentId), this.key(id), `${this.global}:sessions`, this.parent.lock(parentId)],
    [owner, version, revision, now, id, deadline, c.slotBytes, c.storageBytes]));
    return result;
  }
  async getRun(id, parentId, owner) {
    const result = await super.get(id, owner, false);
    if (result.session.python?.parentId !== parentId) throw new ApiError('not_found', 404);
    return result;
  }
  async endRun(id, parentId, owner) {
    await this.getRun(id, parentId, owner);
    return this.check(await this.eval(`
      local raw=redis.call('GET',KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      local s=cjson.decode(raw); if s.owner ~= ARGV[1] then return cjson.encode({error='not_found'}) end
      if redis.call('EXISTS',KEYS[2])==1 then
        s.python.ended=true; s.closed=true
        redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL')
        redis.call('SET',KEYS[3],'1','PX',750000)
      else
        redis.call('DEL',KEYS[1],KEYS[3]); redis.call('ZREM',KEYS[5],KEYS[1])
        if redis.call('GET',KEYS[4])==ARGV[2] then redis.call('DEL',KEYS[4]) end
      end
      return cjson.encode({ok=true})`,
    [this.key(id),this.lock(id),this.cancelKey(id),this.link(parentId),`${this.global}:sessions`],[owner,id]));
  }
  async sealRun(id, parentId, owner) {
    // Keep a short outcome receipt for recovery, but discard script state.
    return this.check(await this.eval(`
      local raw=redis.call('GET',KEYS[1]); if not raw then return cjson.encode({error='not_found'}) end
      local s=cjson.decode(raw); if s.owner~=ARGV[1] then return cjson.encode({error='not_found'}) end
      s.closed=true; s.state=cjson.decode(ARGV[3]); s.history={s.history[#s.history]}
      redis.call('SET',KEYS[1],cjson.encode(s),'EX',60)
      redis.call('ZADD',KEYS[3],tonumber(ARGV[4])+60000,KEYS[1])
      if redis.call('GET',KEYS[2])==ARGV[2] then redis.call('DEL',KEYS[2]) end
      return cjson.encode({ok=true})`, [this.key(id),this.link(parentId),`${this.global}:sessions`],
    [owner,id,JSON.stringify(initialState()),Date.now()]));
  }
}
