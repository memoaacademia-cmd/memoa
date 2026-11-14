-- Rattrapage des paiements Chariow : toutes les 10 minutes, relit chez Chariow les paiements restés « en attente » (3 derniers jours).
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_expiry_push.sql).
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (« payments-reconcile » si tu l'as créée sous ce nom).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-payments-reconcile',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/payments-reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-payments-reconcile');
