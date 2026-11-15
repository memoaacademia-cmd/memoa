-- Statistiques Memoa. À coller dans Supabase > SQL Editor (le rôle de l'éditeur lit tout, malgré la RLS).
-- Ce fichier n'est PAS une migration : ce sont des requêtes de lecture, à lancer une par une (sélectionne un bloc puis « Run »).
-- Les jours sont des jours de Kinshasa (UTC+1). « J0 » = jour de l'inscription, « J1 » = le lendemain, etc.
-- Les événements viennent de la table app_events (migration 0020) ; les erreurs de app_errors ; l'IA de ai_usage (déjà alimentée par ai-gateway).

-- ============================================================================ 1. Inscriptions par jour
select (created_at at time zone 'Africa/Kinshasa')::date as jour,
       count(*) as inscrits,
       count(*) filter (where memo_animal is not null) as ont_adopte_leur_memo
from public.profiles
group by 1 order by 1 desc limit 30;

-- ============================================================================ 2. Utilisateurs actifs par jour (ouverture de l'app, 1 événement par jour et par étudiant)
select (created_at at time zone 'Africa/Kinshasa')::date as jour,
       count(distinct user_id) as actifs
from public.app_events
where name = 'app_open'
group by 1 order by 1 desc limit 30;

-- ============================================================================ 3. Retour aux jours 1, 3 et 5 (par jour d'inscription)
-- Lecture : sur 10 inscrits du 12 nov, combien ont rouvert l'app le 13 (J1), le 15 (J3), le 17 (J5).
-- Attention : un jour pas encore arrivé compte 0 ; ne regarde que les cohortes assez anciennes.
with cohorte as (
  select id, (created_at at time zone 'Africa/Kinshasa')::date as j0
  from public.profiles
  where created_at >= now() - interval '30 days'
), ouvertures as (
  select distinct user_id, (created_at at time zone 'Africa/Kinshasa')::date as jour
  from public.app_events where name = 'app_open'
)
select c.j0 as jour_inscription,
       count(*) as inscrits,
       count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 1)) as revenus_j1,
       count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 3)) as revenus_j3,
       count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 5)) as revenus_j5,
       round(100.0 * count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 1)) / count(*)) as pct_j1,
       round(100.0 * count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 3)) / count(*)) as pct_j3,
       round(100.0 * count(*) filter (where exists (select 1 from ouvertures o where o.user_id = c.id and o.jour = c.j0 + 5)) / count(*)) as pct_j5
from cohorte c
group by c.j0 order by c.j0 desc;

-- ============================================================================ 4. Quelles fonctions servent ? (7 derniers jours, événements d'usage)
select name as evenement,
       count(*) as fois,
       count(distinct user_id) as etudiants
from public.app_events
where created_at >= now() - interval '7 days' and name <> 'app_open'
group by name order by fois desc;

-- ============================================================================ 5. Usage de l'IA (7 derniers jours) : par tâche et par modèle (table ai_usage, alimentée par ai-gateway)
select task as tache,
       coalesce(nullif(model, ''), '(modèle inconnu)') as modele,
       count(*) as demandes,
       count(distinct user_id) as etudiants,
       coalesce(sum(points), 0) as points,
       round(avg(nullif(tokens_out, 0))) as jetons_sortie_moyens
from public.ai_usage
where created_at >= now() - interval '7 days'
group by 1, 2 order by demandes desc;

-- ============================================================================ 6. Parcours : inscription → Memo → premier cours → première question IA → paiement
-- Compte des ÉTUDIANTS DISTINCTS qui ont franchi chaque étape (toutes dates). Le pourcentage est calculé par rapport aux inscrits.
with inscrits as (select id from public.profiles where university <> ''),
etapes as (
  select 1 as n, '1. Inscrit (profil rempli)' as etape, (select count(*) from inscrits) as etudiants
  union all select 2, '2. A adopté son Memo', (select count(*) from public.profiles where memo_animal is not null)
  union all select 3, '3. A créé un cours', (select count(distinct user_id) from public.courses)
  union all select 4, '4. A posé une question à l''assistant', (select count(distinct user_id) from public.ai_usage where task = 'chat')
  union all select 5, '5. A lancé la création de paiement', (select count(distinct user_id) from public.app_events where name = 'payment_started')
  union all select 6, '6. A payé (Premium activé)', (select count(distinct user_id) from public.payments where status = 'paid')
)
select n, etape, etudiants,
       round(100.0 * etudiants / nullif((select count(*) from inscrits), 0)) as pct_des_inscrits
from etapes order by n;

-- ============================================================================ 7. Étapes d'inscription (où les gens s'arrêtent)
select props->>'step' as etape,
       coalesce(props->>'skipped', 'false') as passee,
       count(distinct user_id) as etudiants
from public.app_events
where name = 'onboarding_step'
group by 1, 2 order by 1, 2;

-- ============================================================================ 8. Carte Premium : vue → paiement lancé → paiement réussi (étudiants distincts)
select (select count(distinct user_id) from public.app_events where name = 'premium_view') as ont_vu_premium,
       (select count(distinct user_id) from public.app_events where name = 'payment_started') as ont_lance_le_paiement,
       (select count(distinct user_id) from public.app_events where name = 'payment_success') as paiements_reussis;

-- ============================================================================ 9. Visites guidées
select props->>'id' as visite,
       count(*) filter (where name = 'tour_started') as commencees,
       count(*) filter (where name = 'tour_done') as terminees,
       count(*) filter (where name = 'tour_skipped') as passees
from public.app_events
where name in ('tour_started', 'tour_done', 'tour_skipped')
group by 1 order by 1;

-- ============================================================================ 10. Dernières erreurs (ce qui plante sur les téléphones)
select a.created_at at time zone 'Africa/Kinshasa' as quand,
       left(a.message, 160) as message,
       a.route,
       left(a.user_agent, 90) as appareil,
       a.user_id
from public.app_errors a
order by a.created_at desc limit 50;

-- Erreurs les plus fréquentes (7 jours)
select left(message, 140) as message, count(*) as fois, count(distinct user_id) as etudiants, max(created_at) as derniere
from public.app_errors
where created_at >= now() - interval '7 days'
group by 1 order by fois desc limit 30;

-- ============================================================================ 11. Parcours d'un étudiant précis (remplace l'adresse e-mail)
-- select e.created_at at time zone 'Africa/Kinshasa' as quand, e.name, e.props
-- from public.app_events e join auth.users u on u.id = e.user_id
-- where u.email = 'adresse@exemple.com' order by e.created_at;
