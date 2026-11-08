-- Run only against the disposable PostgreSQL service used by CI.
-- This verifies the migration's permissions, expiry/session checks and one-time semantics.
DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'curator_challenges' AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'curator_challenges must have RLS enabled'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'curator_registration_claims' AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'curator_registration_claims must have RLS enabled'; END IF;
  IF has_table_privilege('anon', 'public.curator_challenges', 'SELECT')
     OR has_table_privilege('authenticated', 'public.curator_challenges', 'SELECT')
     OR has_table_privilege('anon', 'public.curator_registration_claims', 'SELECT')
     OR has_table_privilege('authenticated', 'public.curator_registration_claims', 'SELECT') THEN
    RAISE EXCEPTION 'anon/authenticated must not read curator token tables';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.consume_curator_challenge(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.consume_curator_challenge(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.consume_curator_challenge(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'challenge consume function grants are incorrect';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.consume_curator_registration_claim(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.consume_curator_registration_claim(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.consume_curator_registration_claim(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim consume function grants are incorrect';
  END IF;
END
$assert$;

INSERT INTO public.curator_challenges (challenge_hash, session_hash, created_at, expires_at)
VALUES
  (repeat('1',64), repeat('a',64), now(), now() + interval '5 minutes'),
  (repeat('2',64), repeat('a',64), now() - interval '2 minutes', now() - interval '1 minute'),
  (repeat('3',64), repeat('a',64), now(), now() + interval '5 minutes');

DO $assert$
BEGIN
  IF public.consume_curator_challenge(repeat('1',64), repeat('b',64)) THEN
    RAISE EXCEPTION 'challenge must reject a mismatched session';
  END IF;
  IF NOT public.consume_curator_challenge(repeat('1',64), repeat('a',64)) THEN
    RAISE EXCEPTION 'valid challenge should be consumed';
  END IF;
  IF public.consume_curator_challenge(repeat('1',64), repeat('a',64)) THEN
    RAISE EXCEPTION 'challenge replay must fail';
  END IF;
  IF public.consume_curator_challenge(repeat('2',64), repeat('a',64)) THEN
    RAISE EXCEPTION 'expired challenge must fail';
  END IF;
END
$assert$;

INSERT INTO public.curator_registration_claims (claim_hash, session_hash, created_at, expires_at)
VALUES
  (repeat('4',64), repeat('c',64), now(), now() + interval '5 minutes'),
  (repeat('5',64), repeat('c',64), now() - interval '2 minutes', now() - interval '1 minute');

DO $assert$
BEGIN
  IF public.consume_curator_registration_claim(repeat('4',64), repeat('d',64)) THEN
    RAISE EXCEPTION 'claim must reject a mismatched session';
  END IF;
  IF NOT public.consume_curator_registration_claim(repeat('4',64), repeat('c',64)) THEN
    RAISE EXCEPTION 'valid claim should be consumed';
  END IF;
  IF public.consume_curator_registration_claim(repeat('4',64), repeat('c',64)) THEN
    RAISE EXCEPTION 'claim replay must fail';
  END IF;
  IF public.consume_curator_registration_claim(repeat('5',64), repeat('c',64)) THEN
    RAISE EXCEPTION 'expired claim must fail';
  END IF;
END
$assert$;

INSERT INTO public.curator_challenges (challenge_hash, session_hash, expires_at)
VALUES (repeat('6',64), repeat('e',64), now() + interval '5 minutes');

-- Two concurrent sessions must not both consume the same challenge or registration claim.
INSERT INTO public.curator_registration_claims (claim_hash, session_hash, expires_at)
VALUES (repeat('7',64), repeat('f',64), now() + interval '5 minutes');
