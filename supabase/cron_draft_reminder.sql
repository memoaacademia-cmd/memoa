-- Planification du rappel des brouillons : toutes les 30 minutes (la fonction prévient les étudiants dont un brouillon disparaît dans 5 h ou moins).
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_daily_fact.sql).
--   <<ADRESSE_DU_PROJET>> : par exemple https://abcdefgh.supabase.co
--   <<CODE_SECRET_CRON>>  : le même texte que le secret CRON_SECRET
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (ici « clever-endpoint »), pas son nom affiché.
-- Ne publie jamais ce fichier une fois rempli.
select cron.unschedule(jobid) from cron.job where jobname = 'memoa-draft-reminder-push';
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-draft-reminder-push',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/clever-endpoint',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-draft-reminder-push');
