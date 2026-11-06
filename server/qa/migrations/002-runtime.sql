BEGIN;
SET LOCAL search_path = qa, pg_catalog;
ALTER TABLE qa.receipt ADD COLUMN allowance jsonb;

-- Internal functions execute under the migration owner. Only the public
-- transaction entry points below are granted to the runtime role.
CREATE FUNCTION lock_control() RETURNS control
LANGUAGE plpgsql SET search_path = pg_catalog, qa AS $$
DECLARE c qa.control;
BEGIN
  SELECT * INTO STRICT c FROM qa.control WHERE id=1 FOR UPDATE;
  RETURN c;
END $$;

CREATE FUNCTION available(c control, context jsonb, stamp timestamptz) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, qa AS $$
  SELECT coalesce(c.enabled AND c.halt_reason IS NULL AND c.schema_version=1
    AND c.epoch=context->>'epoch' AND c.canonical_origin=context->>'origin'
    AND c.corpus_version=context->>'corpus' AND c.price_version=context->>'price'
    AND stamp<(context->>'expires')::timestamptz,false)
$$;

CREATE FUNCTION owned(r jsonb, corpus text, stamp timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, qa AS $$
DECLARE o qa.operation; saved qa.receipt;
BEGIN
  SELECT * INTO o FROM qa.operation WHERE id=(r->>'id')::uuid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.browser IS NULL OR o.browser IS DISTINCT FROM r->>'browser' OR o.corpus_version IS DISTINCT FROM corpus THEN
    RETURN '{"code":"not_found"}';
  END IF;
  IF r ? 'binding' AND o.binding IS NOT NULL AND o.binding IS DISTINCT FROM r->>'binding' THEN
    RETURN '{"code":"request_conflict"}';
  END IF;
  IF o.expires_at<=stamp THEN RETURN '{"code":"request_expired"}'; END IF;
  IF o.status IN ('reserved','generating','verifying','uncertain') THEN
    RETURN jsonb_build_object('requestId',o.id,'status',CASE WHEN o.status='uncertain' THEN 'uncertain' ELSE 'running' END,'retryAfter',2);
  END IF;
  SELECT * INTO saved FROM qa.receipt WHERE operation_id=o.id AND expires_at>stamp;
  IF NOT FOUND THEN RETURN '{"code":"not_found"}'; END IF;
  RETURN jsonb_build_object('ciphertext',encode(saved.ciphertext,'hex'),'keyVersion',saved.key_version,'allowance',saved.allowance);
END $$;

CREATE FUNCTION runtime_control() RETURNS SETOF control
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, qa AS $$
  SELECT * FROM qa.control WHERE id=1
$$;

CREATE FUNCTION runtime_receipt(r jsonb, corpus text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa AS $$
BEGIN
  PERFORM qa.lock_control();
  RETURN qa.owned(r,corpus,clock_timestamp());
END $$;

CREATE FUNCTION runtime_admit(r jsonb, context jsonb, stages jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa SET TimeZone = 'UTC' AS $$
DECLARE
  c qa.control := qa.lock_control();
  stamp timestamptz := clock_timestamp();
  d date := stamp::date;
  m date := date_trunc('month',stamp)::date;
  id_value uuid := (r->>'id')::uuid;
  browser_value text := r->>'browser';
  f uuid := gen_random_uuid();
  deadline timestamptz := stamp+interval '60 seconds';
  l qa.month_ledger;
  a qa.browser_day;
  replay jsonb;
  reservation bigint := 0;
  stage text;
  bounds jsonb;
  stage_cost bigint;
BEGIN
  replay := qa.owned(r,context->>'corpus',stamp);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  IF NOT qa.available(c,context,stamp) THEN RETURN '{"code":"unavailable"}'; END IF;
  IF r->>'browser' IS NULL OR r->>'binding' IS NULL THEN RETURN '{"code":"not_found"}'; END IF;
  IF (r->>'expires')::timestamptz<=stamp THEN RETURN '{"code":"request_expired"}'; END IF;
  IF EXISTS(SELECT FROM qa.operation WHERE status IN ('reserved','generating','verifying','uncertain')
      AND day + interval '48 hours' <= stamp + interval '60 seconds') THEN
    UPDATE qa.control SET halt_reason='identity_expiry' WHERE id=1;
    RETURN '{"code":"unavailable"}';
  END IF;
  FOR stage,bounds IN SELECT key,value FROM jsonb_each(stages) LOOP
    stage_cost := (bounds->>'maximumCost')::bigint;
    IF stage_cost IS NULL OR stage_cost<0 OR stage_cost>10000000000 THEN RETURN '{"code":"unavailable"}'; END IF;
    reservation := reservation + stage_cost;
  END LOOP;
  IF reservation>10000000000 THEN RETURN '{"code":"unavailable"}'; END IF;
  SELECT * INTO l FROM qa.month_ledger WHERE month=m;
  IF NOT FOUND THEN
    IF c.last_month IS NULL OR c.last_month>=m THEN
      UPDATE qa.control SET halt_reason='missing_month' WHERE id=1;
      RETURN '{"code":"unavailable"}';
    END IF;
    INSERT INTO qa.month_ledger(month,epoch) VALUES(m,c.epoch) RETURNING * INTO l;
  END IF;
  IF l.epoch<>c.epoch OR c.last_month>m THEN RETURN '{"code":"unavailable"}'; END IF;
  UPDATE qa.control SET last_month=m WHERE id=1 AND last_month IS DISTINCT FROM m;
  IF reservation>l.ceiling-l.settled-l.reserved THEN RETURN '{"code":"budget"}'; END IF;
  IF c.active_count>=2 OR c.receipt_slots>=1000 THEN RETURN '{"code":"capacity"}'; END IF;
  IF EXISTS(SELECT FROM qa.operation WHERE browser=browser_value AND status IN ('reserved','generating','verifying','uncertain')) THEN
    RETURN '{"code":"request_conflict"}';
  END IF;
  INSERT INTO qa.browser_day(browser,day) VALUES(browser_value,d) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT a FROM qa.browser_day WHERE browser=browser_value AND day=d;
  IF a.completed+a.reserved>=3 THEN RETURN jsonb_build_object('code','daily_limit','retryAt',(d+1)::timestamptz); END IF;
  INSERT INTO qa.operation(id,browser,binding,language,corpus_version,epoch,month,day,status,fence,created_at,deadline_at,expires_at,maximum)
    VALUES(id_value,browser_value,r->>'binding',r->>'language',c.corpus_version,c.epoch,m,d,'reserved',f,stamp,deadline,stamp+interval '24 hours',reservation);
  INSERT INTO qa.dispatch(operation_id,stage,token,state,model,price_version,input_bound,output_bound,maximum)
    SELECT id_value,key,gen_random_uuid(),'prepared',context->>'model',c.price_version,
      (value->>'input')::integer,(value->>'output')::integer,(value->>'maximumCost')::bigint FROM jsonb_each(stages);
  UPDATE qa.month_ledger SET reserved=reserved+reservation WHERE month=m;
  UPDATE qa.browser_day SET reserved=reserved+1 WHERE browser=browser_value AND day=d;
  UPDATE qa.control SET active_count=active_count+1,receipt_slots=receipt_slots+1 WHERE id=1;
  RETURN jsonb_build_object('id',id_value,'fence',f,'deadline',deadline);
END $$;

CREATE FUNCTION runtime_dispatch(op uuid, fence_value uuid, stage_value text, context jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa AS $$
DECLARE c qa.control := qa.lock_control(); o qa.operation; sent uuid; stamp timestamptz := clock_timestamp();
BEGIN
  IF NOT qa.available(c,context,stamp) OR stage_value NOT IN ('generation','verification') THEN RETURN NULL; END IF;
  SELECT * INTO o FROM qa.operation WHERE id=op AND fence=fence_value AND epoch=c.epoch AND deadline_at>stamp;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF stage_value='generation' AND o.status<>'reserved' THEN RETURN NULL; END IF;
  IF stage_value='verification' AND (o.status<>'generating' OR NOT EXISTS(
    SELECT FROM qa.dispatch WHERE operation_id=op AND stage='generation' AND state='confirmed')) THEN RETURN NULL; END IF;
  UPDATE qa.dispatch SET state='sent' WHERE operation_id=op AND stage=stage_value AND state='prepared' RETURNING token INTO sent;
  IF sent IS NOT NULL THEN
    UPDATE qa.operation SET status=CASE WHEN stage_value='generation' THEN 'generating' ELSE 'verifying' END WHERE id=op;
  END IF;
  RETURN sent;
END $$;

CREATE FUNCTION runtime_observe(op uuid, fence_value uuid, stage_value text, token_value uuid, cost bigint, epoch_value text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa AS $$
DECLARE c qa.control := qa.lock_control(); o qa.operation; d qa.dispatch;
BEGIN
  IF c.epoch IS DISTINCT FROM epoch_value THEN RETURN false; END IF;
  SELECT * INTO o FROM qa.operation WHERE id=op AND fence=fence_value AND epoch=c.epoch AND status IN ('generating','verifying','uncertain');
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO d FROM qa.dispatch WHERE operation_id=op AND stage=stage_value AND token=token_value AND state IN ('sent','uncertain');
  IF NOT FOUND THEN RETURN false; END IF;
  IF cost IS NULL OR cost<0 OR cost>d.maximum THEN
    IF cost IS NOT NULL THEN UPDATE qa.control SET halt_reason='provider_usage_bound' WHERE id=1; END IF;
    UPDATE qa.dispatch SET state='uncertain' WHERE token=token_value;
    UPDATE qa.operation SET status='uncertain' WHERE id=op;
    RETURN false;
  END IF;
  UPDATE qa.dispatch SET state='confirmed',confirmed=cost WHERE token=token_value;
  RETURN o.status<>'uncertain' AND o.deadline_at>clock_timestamp();
END $$;

CREATE FUNCTION runtime_finish(op uuid, fence_value uuid, epoch_value text, outcome text, encrypted bytea, key_version_value integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa SET TimeZone = 'UTC' AS $$
DECLARE
  c qa.control := qa.lock_control(); o qa.operation; a qa.browser_day;
  stamp timestamptz := clock_timestamp(); total bigint; confirmed_count integer;
BEGIN
  IF c.epoch IS DISTINCT FROM epoch_value OR outcome NOT IN ('answered','abstained','failed') THEN RETURN NULL; END IF;
  SELECT * INTO o FROM qa.operation WHERE id=op AND fence=fence_value AND epoch=c.epoch
    AND deadline_at>stamp AND status IN ('reserved','generating','verifying');
  IF NOT FOUND OR EXISTS(SELECT FROM qa.dispatch WHERE operation_id=op AND state IN ('sent','uncertain')) THEN RETURN NULL; END IF;
  SELECT coalesce(sum(confirmed),0),count(*) FILTER (WHERE state='confirmed') INTO total,confirmed_count
    FROM qa.dispatch WHERE operation_id=op;
  IF outcome='answered' AND confirmed_count<>2 THEN RETURN NULL; END IF;
  UPDATE qa.browser_day SET reserved=reserved-1,completed=completed+CASE WHEN outcome='failed' THEN 0 ELSE 1 END
    WHERE browser=o.browser AND day=o.day RETURNING * INTO STRICT a;
  INSERT INTO qa.receipt(operation_id,ciphertext,key_version,expires_at,allowance)
    VALUES(op,encrypted,key_version_value,stamp+interval '24 hours',
      jsonb_build_object('remaining',3-a.completed-a.reserved,'resetAt',(o.day+1)::timestamptz));
  UPDATE qa.operation SET status=outcome,settled=total,expires_at=stamp+interval '24 hours' WHERE id=op;
  UPDATE qa.month_ledger SET reserved=reserved-o.maximum,settled=settled+total WHERE month=o.month;
  UPDATE qa.control SET active_count=active_count-1 WHERE id=1;
  RETURN jsonb_build_object('remaining',3-a.completed-a.reserved,'resetAt',(o.day+1)::timestamptz);
END $$;

CREATE FUNCTION runtime_network(current_digest text, previous_digest text, utc_day bigint, general boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa AS $$
DECLARE stamp timestamptz;
BEGIN
  PERFORM qa.lock_control();
  stamp := clock_timestamp();
  IF floor(extract(epoch FROM stamp)/86400)::bigint<>utc_day THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM qa.network_window WHERE digest IN (current_digest,previous_digest)
    AND seen_at>stamp-interval '60 seconds') >= (CASE WHEN general THEN 120 ELSE 10 END) THEN RETURN false; END IF;
  INSERT INTO qa.network_window VALUES(current_digest,stamp);
  RETURN true;
END $$;

CREATE FUNCTION runtime_cleanup() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, qa SET TimeZone = 'UTC' AS $$
DECLARE stamp timestamptz; expired integer;
BEGIN
  PERFORM qa.lock_control();
  stamp := clock_timestamp();
  UPDATE qa.control SET halt_reason='identity_expiry' WHERE id=1 AND EXISTS(
    SELECT FROM qa.operation WHERE browser IS NOT NULL AND day+interval '48 hours'<=stamp
      AND status IN ('reserved','generating','verifying','uncertain'));
  DELETE FROM qa.receipt WHERE expires_at<=stamp;
  GET DIAGNOSTICS expired = ROW_COUNT;
  UPDATE qa.control SET receipt_slots=receipt_slots-expired WHERE id=1;
  UPDATE qa.operation SET binding=NULL WHERE expires_at<=stamp AND binding IS NOT NULL;
  UPDATE qa.operation SET browser=NULL WHERE browser IS NOT NULL AND day+interval '48 hours'<=stamp;
  DELETE FROM qa.browser_day WHERE day+interval '48 hours'<=stamp;
  DELETE FROM qa.network_window WHERE seen_at<=stamp-interval '24 hours';
END $$;

-- Owner-only recovery: sent/uncertain work requires external completion
-- evidence before the owner may record confirmed usage and reconcile.
CREATE FUNCTION reconcile(op uuid) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog, qa AS $$
DECLARE o qa.operation; total bigint; stamp timestamptz;
BEGIN
  PERFORM qa.lock_control();
  stamp := clock_timestamp();
  SELECT * INTO o FROM qa.operation WHERE id=op AND deadline_at<=stamp
    AND status IN ('reserved','generating','verifying','uncertain');
  IF NOT FOUND OR EXISTS(SELECT FROM qa.dispatch WHERE operation_id=op AND state IN ('sent','uncertain')) THEN
    RETURN false;
  END IF;
  SELECT coalesce(sum(confirmed),0) INTO total FROM qa.dispatch WHERE operation_id=op;
  UPDATE qa.browser_day SET reserved=reserved-1 WHERE browser=o.browser AND day=o.day;
  UPDATE qa.month_ledger SET reserved=reserved-o.maximum,settled=settled+total WHERE month=o.month;
  UPDATE qa.operation SET status='failed',settled=total,binding=NULL,expires_at=stamp WHERE id=op;
  UPDATE qa.control SET active_count=active_count-1,receipt_slots=receipt_slots-1 WHERE id=1;
  RETURN true;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA qa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa.runtime_control(), qa.runtime_receipt(jsonb,text),
  qa.runtime_admit(jsonb,jsonb,jsonb), qa.runtime_dispatch(uuid,uuid,text,jsonb),
  qa.runtime_observe(uuid,uuid,text,uuid,bigint,text), qa.runtime_finish(uuid,uuid,text,text,bytea,integer),
  qa.runtime_network(text,text,bigint,boolean), qa.runtime_cleanup() TO bibref_qa_runtime;
COMMIT;
