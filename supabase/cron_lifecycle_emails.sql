-- Planification des e-mails automatiques d'inscription (rappel + bienvenue) : toutes les 10 minutes.
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_partner_alerts.sql).
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (ex. « lifecycle-emails »), pas son nom affiché.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-lifecycle-emails',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/lifecycle-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-lifecycle-emails');
