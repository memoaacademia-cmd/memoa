-- Corbeille de 30 jours pour les cours : un cours supprimé est masqué (deleted_at rempli),
-- restaurable pendant 30 jours, puis effacé pour de bon (notes comprises, par cascade).
alter table public.courses add column if not exists deleted_at timestamptz;
create index if not exists courses_deleted_idx on public.courses (user_id, deleted_at);
-- Les règles RLS existantes (lecture, modification, suppression de ses propres cours) suffisent : rien d'autre à ajouter.
