-- Planification des rappels d'expiration d'abonnement : toutes les heures (la fonction n'envoie qu'entre 8 h et 20 h, heure de Kinshasa).
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_daily_fact.sql).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-expiry-push',
  '0 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/subscription-expiry-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-expiry-push');
