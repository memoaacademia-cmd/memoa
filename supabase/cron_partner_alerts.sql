-- Planification des alertes du Programme partenaire : toutes les 5 minutes.
-- (alerte « demande de partenaire / retrait à payer » sur TON téléphone ; push aux partenaires seulement si PARTNER_PUSH_ENABLED = true dans la fonction)
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_expiry_push.sql).
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (ex. « partner-alerts »), pas son nom affiché.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-partner-alerts',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/partner-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-partner-alerts');
