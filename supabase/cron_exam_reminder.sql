-- Planification des rappels d'examen : deux passages par jour, à 7 h 30 et 11 h 30 heure de Kinshasa (6 h 30 et 10 h 30 UTC).
-- Le second passage rattrape les étudiants qui n'ont pas pu être joints au premier. Un rappel n'est jamais envoyé deux fois.
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> (les mêmes que pour cron_draft_reminder.sql).
--   <<ADRESSE_DU_PROJET>> : par exemple https://abcdefgh.supabase.co
--   <<CODE_SECRET_CRON>>  : le même texte que le secret CRON_SECRET
-- ATTENTION : dans l'URL, le nom est l'ADRESSE réelle de la fonction dans le tableau de bord (à vérifier : « exam-reminder-push » ou le nom que Supabase lui donne), pas son nom affiché.
-- Ne publie jamais ce fichier une fois rempli.
select cron.unschedule(jobid) from cron.job where jobname = 'memoa-exam-reminder-push';
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-exam-reminder-push',
  '30 6,10 * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/exam-reminder-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-exam-reminder-push');
