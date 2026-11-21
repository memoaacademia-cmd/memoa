-- ADMINISTRATION DU PROGRAMME PARTENAIRE : requêtes à copier-coller dans Supabase > SQL Editor.
-- Exécute UNE requête à la fois (sélectionne-la, puis « Run »). Remplace seulement ce qui est entre << >>.

-- 1) Partenaires qui attendent ta validation (copie la colonne partner_id de la personne à approuver)
select * from public.admin_pending_partners;

-- 2) APPROUVER un partenaire (génère son code automatiquement ; le résultat affiche le code)
select public.approve_partner('<<PARTNER_ID>>');

-- 3) REFUSER un partenaire
select public.reject_partner('<<PARTNER_ID>>');

-- 4) Retraits à payer (envoie l'argent par Mobile Money au numéro indiqué, montant COMPLET, frais à ta charge)
select * from public.admin_payouts_to_pay;

-- 5) Après avoir envoyé l'argent : marquer le retrait PAYÉ (référence = numéro de transaction Mobile Money)
select public.mark_payout_paid('<<PAYOUT_ID>>', '<<REFERENCE_TRANSACTION>>');

-- 6) REFUSER un retrait (le motif est montré au partenaire ; ses gains redeviennent disponibles)
select public.reject_payout('<<PAYOUT_ID>>', '<<MOTIF>>');

-- 7) Suspendre un partenaire (son code ne parraine plus, plus de nouveaux gains)
select public.suspend_partner('<<PARTNER_ID>>');

-- 8) Remboursement d'un paiement : annuler le gain du filleul (seulement s'il n'est pas déjà demandé ou payé)
select public.void_earning_for_user('<<ID_DE_L_ETUDIANT>>');

-- 9) Vue d'ensemble : tous les partenaires avec leurs chiffres
select pa.full_name, pa.type, pa.status, pa.code,
       (select count(*) from public.referrals r where r.partner_id = pa.id) as inscrits,
       (select count(*) from public.partner_earnings e where e.partner_id = pa.id and e.status <> 'void') as payants,
       (select coalesce(sum(e.amount_usd), 0) from public.partner_earnings e where e.partner_id = pa.id and e.status in ('pending', 'available')) as a_venir_usd,
       (select coalesce(sum(e.amount_usd), 0) from public.partner_earnings e where e.partner_id = pa.id and e.status = 'paid') as paye_usd
  from public.partners pa
 order by pa.created_at desc;
