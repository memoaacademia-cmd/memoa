-- Planification du rappel des cartes de révision : toutes les heures (la fonction décide elle-même qui prévenir, et jamais la nuit).
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_draft_reminder.sql).
--   <<ADRESSE_DU_PROJET>> : par exemple https://abcdefgh.supabase.co
--   <<CODE_SECRET_CRON>>  : le même texte que le secret CRON_SECRET
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (par défaut « cards-reminder-push », mais le tableau
-- de bord peut en donner une autre : regarde l'onglet Details de la fonction), pas son nom affiché.
-- Ne publie jamais ce fichier une fois rempli.
select cron.unschedule(jobid) from cron.job where jobname = 'memoa-cards-reminder-push';
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-cards-reminder-push',
  '0 * * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/cards-reminder-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-cards-reminder-push');
