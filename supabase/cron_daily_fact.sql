-- Planification de la notification « Le savais-tu ? » : tous les jours à 8 h du matin (heure de Kinshasa, UTC+1) = 7 h UTC.
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les deux valeurs entre << >> :
--   <<ADRESSE_DU_PROJET>> : par exemple https://abcdefgh.supabase.co  (la même adresse que dans tes secrets GitHub)
--   <<CODE_SECRET_CRON>>  : le même texte que le secret CRON_SECRET enregistré dans Supabase
-- Ne publie jamais ce fichier une fois rempli.
-- SI TU AVAIS DÉJÀ PROGRAMMÉ L'ANCIENNE HEURE (17 h) : la ligne ci-dessous la supprime d'abord, puis la nouvelle est créée (8 h).
select cron.unschedule(jobid) from cron.job where jobname = 'memoa-daily-fact-push';
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'memoa-daily-fact-push',
  '0 7 * * *',
  $$
  select net.http_post(
    url := '<<ADRESSE_DU_PROJET>>/functions/v1/daily-fact-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<<CODE_SECRET_CRON>>'),
    body := '{}'::jsonb
  );
  $$
);
-- Pour arrêter : select cron.unschedule('memoa-daily-fact-push');
