// Banque « Le savais-tu ? » de Memo : 3 volumes fournis par Alexandre (v1, volume 3, volume 4), fusionnés et uniformisés.
// Tout vient de la banque relue (volumes 1 à 5, doublons retirés le 11 novembre 2026), jamais inventé par l'IA. Champs : i = identifiant, c = catégorie, k = type (savoir, enigme, humour),
// t = titre, s = sous-titre, x = texte, q = question à se poser, h = indice (énigmes), a = réponse (énigmes), n = « à retenir » / chute.
// Les cartes viennent des fichiers au statut draft_review : à relire avant diffusion large (voir la note dans le message de livraison).
export interface Fact {
  i: string
  c: string
  k: 'savoir' | 'enigme' | 'humour'
  t: string
  s?: string
  x: string
  q?: string
  h?: string
  a?: string
  n?: string
}

export const FACTS: Fact[] = [
{
"i": "hist_001",
"c": "Histoire",
"k": "savoir",
"t": "Le roi qui cherchait un homme honnête",
"s": "Diogène et Alexandre",
"x": "On raconte qu'Alexandre le Grand demanda un jour au philosophe Diogène ce qu'il pouvait faire pour lui. Diogène, qui se reposait au soleil, lui répondit : « Écarte-toi, tu me fais de l'ombre. »",
"q": "Que retiens-tu de cette histoire ?",
"n": "Une grande richesse ne signifie pas forcément une grande liberté."
},
{
"i": "hist_002",
"c": "Histoire",
"k": "savoir",
"t": "La bibliothèque qui voulait sauver le monde",
"s": "La bibliothèque d'Alexandrie",
"x": "Dans l'Antiquité, Alexandrie abritait une bibliothèque célèbre, associée à un vaste projet de rassemblement des savoirs. Des savants y étudiaient les mathématiques, l'astronomie, la médecine et la littérature. Son histoire est entourée de récits, notamment celui d'une destruction unique, alors que son déclin fut probablement progressif et complexe.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Le savoir est un trésor collectif : le préserver est une responsabilité de chaque génération."
},
{
"i": "hist_004",
"c": "Histoire",
"k": "savoir",
"t": "Le message qui a traversé les siècles",
"s": "La pierre de Rosette",
"x": "En 1799, des soldats français découvrirent en Égypte une stèle portant un même décret en trois écritures : hiéroglyphes, démotique et grec ancien. Comme le grec était compris par les chercheurs, la pierre a aidé à déchiffrer les hiéroglyphes, notamment grâce aux travaux de Jean-François Champollion.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Parfois, comprendre une chose demande simplement de trouver la bonne clé."
},
{
"i": "hist_005",
"c": "Histoire",
"k": "savoir",
"t": "La reine qui a défié Rome",
"s": "Cléopâtre, stratège et souveraine",
"x": "Cléopâtre VII fut la dernière souveraine active de la dynastie ptolémaïque d'Égypte. Elle gouverna dans une période de fortes rivalités politiques et noua des alliances avec Jules César puis Marc Antoine. Son histoire est souvent réduite à ses relations amoureuses, alors qu'elle fut aussi une dirigeante engagée dans la diplomatie et la survie de son royaume.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Regarder l'histoire de plus près permet souvent de dépasser les légendes populaires."
},
{
"i": "hist_006",
"c": "Histoire",
"k": "savoir",
"t": "Le voyageur qui a décrit le monde",
"s": "Ibn Battûta",
"x": "Au XIVe siècle, Ibn Battûta, voyageur né à Tanger, parcourut une immense partie du monde connu de son époque : Afrique du Nord, Moyen-Orient, Asie centrale, Inde et régions de l'océan Indien. Ses voyages furent ensuite racontés dans un récit connu sous le nom de Rihla.",
"q": "Que retiens-tu de cette histoire ?",
"n": "La curiosité transforme le monde en salle de classe."
},
{
"i": "phil_001",
"c": "Philosophie",
"k": "savoir",
"t": "La seule chose que Socrate savait",
"s": "Socrate et l'humilité intellectuelle",
"x": "Socrate est associé à une attitude devenue célèbre : reconnaître les limites de son savoir. Dans les dialogues de Platon, il interroge les certitudes des autres et révèle souvent que des idées présentées comme évidentes sont moins solides qu'elles n'en ont l'air.",
"q": "Que retiens-tu de cette histoire ?",
"n": "L'intelligence ne consiste pas à tout savoir, mais à savoir questionner et apprendre."
},
{
"i": "phil_002",
"c": "Philosophie",
"k": "savoir",
"t": "Le bonheur est-il dans le plaisir ?",
"s": "Épicure et le bonheur",
"x": "Épicure ne recommandait pas de satisfaire tous les désirs. Il distinguait les désirs naturels et nécessaires, les désirs naturels mais non nécessaires, et les désirs vains. Pour lui, une vie heureuse reposait notamment sur l'amitié, la tranquillité de l'esprit et la modération.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Tout ce qui fait envie ne rend pas forcément heureux."
},
{
"i": "phil_003",
"c": "Philosophie",
"k": "savoir",
"t": "La caverne et les ombres",
"s": "L'allégorie de Platon",
"x": "Dans le livre VII de La République, Platon imagine des prisonniers qui ne voient que des ombres projetées sur un mur. Pour eux, ces ombres constituent toute la réalité. Lorsqu'un prisonnier sort de la caverne, il découvre progressivement le monde extérieur.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Apprendre, c'est parfois accepter de remettre en question ce qui semblait évident."
},
{
"i": "phil_004",
"c": "Philosophie",
"k": "savoir",
"t": "Le bonheur comme pratique quotidienne",
"s": "Aristote et l'habitude",
"x": "Pour Aristote, les vertus ne se développent pas uniquement en connaissant le bien : elles se construisent par l'habitude et la pratique. On devient juste en accomplissant des actes justes, courageux en exerçant le courage.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Tu ne deviens pas discipliné en attendant d'en avoir envie, mais en pratiquant la discipline."
},
{
"i": "phil_005",
"c": "Philosophie",
"k": "savoir",
"t": "Le contrôle de soi selon les stoïciens",
"s": "Épictète et ce qui dépend de nous",
"x": "Épictète enseigne à distinguer ce qui dépend de nous — nos jugements, nos choix, nos actions — de ce qui ne dépend pas entièrement de nous, comme la réputation ou les événements extérieurs.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Ne gaspille pas toute ton énergie à contrôler ce qui ne t'appartient pas."
},
{
"i": "phil_006",
"c": "Philosophie",
"k": "savoir",
"t": "Pourquoi apprendre à penser par soi-même ?",
"s": "Kant et les Lumières",
"x": "Dans son texte Qu'est-ce que les Lumières ?, Kant décrit la sortie de l'être humain de sa minorité intellectuelle, c'est-à-dire la difficulté à se servir de son propre entendement sans être guidé par un autre.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Écoute les autres, mais garde le courage de réfléchir par toi-même."
},
{
"i": "myth_001",
"c": "Mythologie",
"k": "savoir",
"t": "Le garçon qui vola trop près du soleil",
"s": "Icare et Dédale",
"x": "Dans le mythe grec, Dédale fabrique des ailes avec des plumes et de la cire pour s'échapper avec son fils Icare. Il lui recommande de ne voler ni trop bas ni trop haut. Icare, emporté par l'enthousiasme, s'approche du soleil; la cire fond et il tombe dans la mer.",
"q": "Que retiens-tu de cette histoire ?",
"n": "L'ambition est précieuse; la prudence lui donne une direction."
},
{
"i": "myth_002",
"c": "Mythologie",
"k": "savoir",
"t": "Orphée : l'amour qui se retourne",
"s": "Orphée et Eurydice",
"x": "Dans la mythologie grecque, Orphée descend aux Enfers pour tenter de ramener Eurydice. Il obtient une chance de la reconduire au monde des vivants, à condition de ne pas se retourner avant d'être sorti. Au dernier instant, il regarde derrière lui et la perd à nouveau.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Parfois, la confiance demande de résister à l'impatience."
},
{
"i": "myth_003",
"c": "Mythologie",
"k": "savoir",
"t": "Le fil qui a sauvé Thésée",
"s": "Ariane et le Minotaure",
"x": "Selon le mythe, Ariane donne à Thésée un fil pour retrouver son chemin dans le labyrinthe où se trouve le Minotaure. En déroulant le fil, il peut retrouver la sortie après avoir affronté le monstre.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Dans un problème compliqué, une bonne méthode vaut parfois mieux que la force."
},
{
"i": "myth_004",
"c": "Mythologie",
"k": "savoir",
"t": "Psyché : l'amour mis à l'épreuve",
"s": "Éros et Psyché",
"x": "Dans le récit d'Apulée, Psyché épouse un être mystérieux qu'elle ne doit pas regarder. Poussée par le doute, elle découvre qu'il s'agit d'Éros. Après leur séparation, elle traverse plusieurs épreuves avant leurs retrouvailles.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Une relation solide ne se construit pas sur le contrôle, mais sur la confiance et le dialogue."
},
{
"i": "myth_005",
"c": "Mythologie",
"k": "savoir",
"t": "Athéna et le cadeau le plus utile",
"s": "Le concours d'Athéna et Poséidon",
"x": "Dans un mythe grec, Athéna et Poséidon rivalisent pour devenir la divinité protectrice d'Athènes. Poséidon offre une source ou un cheval selon les versions; Athéna offre l'olivier, symbole d'une ressource durable. Les habitants choisissent Athéna.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Le meilleur cadeau n'est pas toujours le plus spectaculaire; c'est parfois celui qui sert longtemps."
},
{
"i": "enig_001",
"c": "Énigmes",
"k": "enigme",
"t": "Plus tu en prends, plus tu en laisses",
"s": "L'énigme des pas",
"x": "Plus tu en prends, plus tu en laisses derrière toi. Que suis-je ?",
"q": "Quelle est ta réponse ?",
"h": "Réfléchis à ce que tu laisses au sol lorsque tu avances.",
"a": "Les pas."
},
{
"i": "enig_002",
"c": "Énigmes",
"k": "enigme",
"t": "Je parle sans bouche",
"s": "L'énigme de l'écho",
"x": "Je peux répéter tes paroles sans avoir de bouche ni de langue. Qui suis-je ?",
"q": "Quelle est ta réponse ?",
"h": "Pense à ce qui revient lorsque tu cries dans une vallée.",
"a": "L'écho."
},
{
"i": "enig_003",
"c": "Énigmes",
"k": "enigme",
"t": "On me casse avant de m'utiliser",
"s": "L'énigme de l'œuf",
"x": "On me casse avant de m'utiliser. Qui suis-je ?",
"q": "Quelle est ta réponse ?",
"h": "Tu peux me trouver dans une cuisine, au petit-déjeuner.",
"a": "Un œuf."
},
{
"i": "enig_005",
"c": "Énigmes",
"k": "enigme",
"t": "Deux pères et deux fils",
"s": "Le repas familial",
"x": "Deux pères et deux fils vont au restaurant. Ils commandent trois repas et chacun mange un repas. Comment est-ce possible ?",
"q": "Quelle est ta réponse ?",
"h": "Il n'y a pas forcément quatre personnes.",
"a": "Ils sont trois : un grand-père, son fils et son petit-fils."
},
{
"i": "enig_006",
"c": "Énigmes",
"k": "enigme",
"t": "Le mois qui a 28 jours",
"s": "Le piège du calendrier",
"x": "Combien de mois dans l'année ont au moins 28 jours ?",
"q": "Quelle est ta réponse ?",
"h": "Ne confonds pas « exactement 28 » et « au moins 28 ».",
"a": "Les douze mois."
},
{
"i": "hum_001",
"c": "Humour étudiant",
"k": "humour",
"t": "Le cours de 7 heures",
"s": "La vie sur le campus",
"x": "Le professeur : « J'espère que tout le monde est prêt pour un cours très interactif. » L'étudiant qui s'est réveillé à 6 h 55 : « Monsieur, même mon cerveau n'a pas encore accepté les conditions d'utilisation. »",
"q": "À qui cette carte te fait-elle penser ?",
"n": "La vie universitaire a parfois son propre fuseau horaire : celui du premier cours."
},
{
"i": "hum_002",
"c": "Humour étudiant",
"k": "humour",
"t": "Le groupe de promotion",
"s": "La réalité des travaux",
"x": "Dans le groupe WhatsApp : « Qui a le syllabus ? » Silence. « Qui a les notes ? » Silence. « Qui connaît la date de l'examen ? » 47 messages apparaissent en trois secondes.",
"q": "À qui cette carte te fait-elle penser ?",
"n": "Il suffit parfois d'un examen pour réveiller toute une promotion."
},
{
"i": "hum_003",
"c": "Humour étudiant",
"k": "humour",
"t": "La réponse stratégique",
"s": "L'art de participer",
"x": "Le professeur : « Quelqu'un peut-il donner un exemple ? » L'étudiant : « Oui, monsieur. » Le professeur : « Lequel ? » L'étudiant : « C'est justement ce que j'attendais de vous pour confirmer. »",
"q": "À qui cette carte te fait-elle penser ?",
"n": "Participer, c'est bien. Savoir de quoi on parle, c'est encore mieux."
},
{
"i": "hum_005",
"c": "Humour étudiant",
"k": "humour",
"t": "Le devoir en groupe",
"s": "Le travail d'équipe",
"x": "Dans un groupe de cinq : une personne rédige, une personne corrige, une personne envoie des stickers, une personne demande « on en est où ? » et la dernière apparaît le jour de la présentation.",
"q": "À qui cette carte te fait-elle penser ?",
"n": "Un travail de groupe révèle souvent les talents cachés… et les notifications désactivées."
},
{
"i": "hum_006",
"c": "Humour étudiant",
"k": "humour",
"t": "La mémoire sélective",
"s": "La veille de l'examen",
"x": "L'étudiant connaît parfaitement le nom de tous les joueurs de son équipe, les paroles de vingt chansons et les résultats de la saison. Mais le nom du chapitre étudié hier ? « Ça me dit quelque chose. »",
"q": "À qui cette carte te fait-elle penser ?",
"n": "La mémoire fonctionne mieux quand on lui donne des révisions régulières."
},
{
"i": "mot_001",
"c": "Motivation",
"k": "savoir",
"t": "La graine ne fait pas de bruit",
"s": "La progression invisible",
"x": "Une graine pousse longtemps sous la terre avant que la première feuille apparaisse. Pendant cette période, rien ne semble se passer à la surface. Pourtant, le travail continue.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Ne méprise pas les petits progrès que personne ne voit."
},
{
"i": "mot_002",
"c": "Motivation",
"k": "savoir",
"t": "La montagne se gagne par étapes",
"s": "Découper un grand objectif",
"x": "Face à une montagne, regarder seulement le sommet peut décourager. Les marcheurs avancent en choisissant un prochain repère : un arbre, un virage, un refuge. L'objectif reste le même, mais l'effort devient gérable.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Remplace « tout réussir aujourd'hui » par « avancer sur la prochaine étape »."
},
{
"i": "mot_003",
"c": "Motivation",
"k": "savoir",
"t": "L'échec n'est pas une identité",
"s": "Changer de regard",
"x": "Rater un examen décrit un résultat à un moment donné. Cela ne résume ni ton intelligence, ni ta valeur, ni ton avenir. Le résultat peut servir d'information : quelle méthode n'a pas fonctionné, quelle notion manque, quel soutien chercher ?",
"q": "Que retiens-tu de cette histoire ?",
"n": "Tu as échoué à quelque chose; tu n'es pas un échec."
},
{
"i": "mot_004",
"c": "Motivation",
"k": "savoir",
"t": "La discipline des dix minutes",
"s": "Commencer petit",
"x": "Quand une tâche paraît immense, promets-toi seulement dix minutes de concentration. Prépare ton matériel, éloigne les distractions et commence. Après dix minutes, tu peux décider de continuer ou de faire une pause.",
"q": "Que retiens-tu de cette histoire ?",
"n": "N'attends pas la motivation parfaite pour commencer."
},
{
"i": "mot_005",
"c": "Motivation",
"k": "savoir",
"t": "Compare tes progrès, pas ta vie",
"s": "Le rythme personnel",
"x": "Deux étudiants peuvent suivre le même cours avec des parcours, des responsabilités et des ressources très différents. Comparer leurs résultats sans connaître leur contexte donne une image incomplète.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Ton rythme n'a pas besoin de ressembler à celui des autres pour être valable."
},
{
"i": "mot_006",
"c": "Motivation",
"k": "savoir",
"t": "Le courage de demander de l'aide",
"s": "Apprendre ensemble",
"x": "Un étudiant bloque sur un exercice depuis une heure. Il finit par demander une explication à une camarade. En quelques minutes, il comprend le point qui lui échappait. Demander de l'aide n'a pas diminué son mérite : cela a accéléré son apprentissage.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Une question posée à temps peut t'épargner des heures de confusion."
},
{
"i": "love_001",
"c": "Amour et relations",
"k": "savoir",
"t": "La moitié qui nous manque ?",
"s": "Le mythe de l'androgyne chez Platon",
"x": "Dans Le Banquet de Platon, Aristophane raconte un mythe selon lequel les humains auraient été autrefois des êtres doubles, séparés ensuite par les dieux. Depuis, chacun chercherait sa moitié. C'est un récit mythique prononcé par un personnage du dialogue, pas une théorie scientifique de l'amour.",
"q": "Que retiens-tu de cette histoire ?",
"n": "L'amour peut enrichir ta vie sans devenir la condition de ta valeur."
},
{
"i": "love_003",
"c": "Amour et relations",
"k": "savoir",
"t": "L'amour n'est pas un examen surprise",
"s": "Communication dans le couple",
"x": "Une personne ne peut pas deviner systématiquement ce que l'autre ressent, attend ou redoute. Les sous-entendus et les tests silencieux créent souvent plus de confusion que de proximité.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Une relation n'est pas un concours de télépathie : parle, écoute et clarifie."
},
{
"i": "love_004",
"c": "Amour et relations",
"k": "savoir",
"t": "Le respect, même pendant un désaccord",
"s": "Désaccord et limites",
"x": "Deux personnes qui s'aiment peuvent ne pas être d'accord. Le désaccord ne justifie ni l'humiliation, ni les menaces, ni le contrôle. Il est possible de faire une pause, d'expliquer son point de vue et de chercher une solution sans attaquer la dignité de l'autre.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Aimer quelqu'un ne donne pas le droit de le contrôler."
},
{
"i": "love_005",
"c": "Amour et relations",
"k": "humour",
"t": "Le message vu à 22 h 03",
"s": "Humour amoureux",
"x": "Tu envoies : « Tu dors ? » La personne répond le lendemain : « Oui, pourquoi ? » Tu relis la conversation trois fois, tu consultes deux amis et tu rédiges une réponse comme si tu préparais une plaidoirie.",
"q": "À qui cette carte te fait-elle penser ?",
"n": "Parfois, le meilleur moyen d'éviter un scénario dans sa tête est simplement de poser une question claire."
},
{
"i": "love_006",
"c": "Amour et relations",
"k": "savoir",
"t": "Le vrai signe d'une relation solide",
"s": "Petits gestes et cohérence",
"x": "Les grandes déclarations peuvent être touchantes, mais la confiance se construit aussi dans les gestes ordinaires : tenir parole, respecter les limites, écouter, reconnaître ses torts et rester cohérent.",
"q": "Que retiens-tu de cette histoire ?",
"n": "Les mots touchent; les actes rassurent."
},
{
"i": "M3-001",
"c": "Histoire",
"k": "savoir",
"t": "La bibliothèque qui a survécu au désert",
"s": "Tombouctou, Mali",
"x": "À Tombouctou, des familles ont conservé pendant des générations des manuscrits portant sur le droit, les sciences, la religion, la poésie et le commerce. Ces collections rappellent que l'Afrique de l'Ouest médiévale était aussi un espace de production et de circulation du savoir.",
"q": "Qu'est-ce qui peut rendre un livre précieux au-delà de son prix ?",
"n": "Un manuscrit est parfois une mémoire qu'une famille entière protège."
},
{
"i": "M3-002",
"c": "Histoire",
"k": "savoir",
"t": "Mansa Moussa et le pèlerinage célèbre",
"s": "Empire du Mali",
"x": "Au XIVe siècle, Mansa Moussa, souverain de l'Empire du Mali, effectua un pèlerinage à La Mecque. Les récits de son passage au Caire évoquent une distribution très importante d'or, qui marqua durablement les observateurs de l'époque.",
"q": "Pourquoi ce voyage a-t-il autant frappé les chroniqueurs ?",
"n": "Le pouvoir se mesure aussi à la manière dont il marque l'imaginaire des autres."
},
{
"i": "M3-003",
"c": "Histoire",
"k": "savoir",
"t": "Le royaume de Kongo et ses échanges",
"s": "Afrique centrale",
"x": "Le royaume de Kongo était un État organisé avant l'arrivée des Portugais à la fin du XVe siècle. Il possédait une autorité politique structurée, des provinces et des réseaux commerciaux. Les contacts avec le Portugal ont ensuite profondément transformé son histoire.",
"q": "Pourquoi faut-il étudier les sociétés africaines avant la colonisation ?",
"n": "Parce qu'une histoire commence rarement au moment où un étranger l'écrit."
},
{
"i": "M3-004",
"c": "Histoire",
"k": "savoir",
"t": "La reine Nzinga, diplomate et stratège",
"s": "Ndongo et Matamba",
"x": "Nzinga Mbandi, souveraine du XVIIe siècle dans l'actuel Angola, est connue pour sa résistance à l'expansion portugaise. Elle utilisa la diplomatie, les alliances et la stratégie militaire pour défendre l'autonomie de ses États.",
"q": "Quelle qualité de Nzinga te semble la plus remarquable ?",
"n": "La stratégie ne consiste pas seulement à combattre : elle consiste aussi à choisir ses alliances."
},
{
"i": "M3-005",
"c": "Histoire",
"k": "savoir",
"t": "Le Grand Zimbabwe, cité de pierre",
"s": "Afrique australe",
"x": "Le site du Grand Zimbabwe témoigne d'une société africaine médiévale capable de construire de vastes ensembles en pierre sans mortier. La cité était liée à des réseaux commerciaux régionaux et à longue distance.",
"q": "Que nous apprend une ville ancienne sur la société qui l'a bâtie ?",
"n": "Les pierres racontent le travail, l'organisation et l'ambition d'un peuple."
},
{
"i": "M3-006",
"c": "Histoire",
"k": "savoir",
"t": "Aksoum, carrefour de la mer Rouge",
"s": "Éthiopie et Érythrée",
"x": "Le royaume d'Aksoum fut une puissance commerciale majeure de la région de la mer Rouge. Il frappa sa propre monnaie et adopta le christianisme comme religion royale au IVe siècle, sous le roi Ezana, selon les sources historiques.",
"q": "Pourquoi la monnaie est-elle un signe de puissance politique ?",
"n": "Une pièce peut être petite, mais elle porte le symbole d'un État."
},
{
"i": "M3-007",
"c": "Histoire",
"k": "savoir",
"t": "Les obélisques d'Aksoum",
"s": "Éthiopie",
"x": "Les stèles monumentales d'Aksoum, souvent appelées obélisques, marquaient des sépultures de haut rang. Leur taille et leur décoration montrent une maîtrise remarquable de la pierre et une organisation collective importante.",
"q": "Que faut-il pour déplacer et ériger un monument immense ?",
"n": "Les grands monuments sont aussi des preuves de coopération humaine."
},
{
"i": "M3-008",
"c": "Histoire",
"k": "savoir",
"t": "La Nubie, puissance au sud de l'Égypte",
"s": "Vallée du Nil",
"x": "Les royaumes de Nubie, notamment Koush, furent parfois rivaux et parfois partenaires de l'Égypte ancienne. Des souverains koushites régnèrent même sur l'Égypte durant la XXVe dynastie.",
"q": "Pourquoi l'histoire de l'Égypte doit-elle aussi raconter celle de la Nubie ?",
"n": "Les frontières modernes ne doivent pas enfermer notre lecture du passé."
},
{
"i": "M3-009",
"c": "Histoire",
"k": "savoir",
"t": "Les pharaons noirs",
"s": "XXVe dynastie",
"x": "La XXVe dynastie d'Égypte fut fondée par des souverains venus du royaume de Koush. Ils gouvernèrent l'Égypte et promurent des traditions religieuses et artistiques liées à la vallée du Nil.",
"q": "Qu'est-ce que cet épisode change dans une vision trop simple de l'Égypte ancienne ?",
"n": "L'histoire est faite de circulations et de pouvoirs qui se répondent."
},
{
"i": "M3-010",
"c": "Histoire",
"k": "savoir",
"t": "Hatshepsout, une femme pharaon",
"s": "Égypte ancienne",
"x": "Hatshepsout régna comme pharaon au XVe siècle avant notre ère. Elle développa des projets monumentaux et organisa des expéditions commerciales, notamment vers le pays de Pount, dont la localisation exacte reste discutée.",
"q": "Quel obstacle une femme dirigeante pouvait-elle rencontrer dans ce contexte ?",
"n": "Le leadership se construit parfois dans des institutions qui n'ont pas été pensées pour vous."
},
{
"i": "M3-013",
"c": "Histoire",
"k": "savoir",
"t": "Hannibal et les éléphants",
"s": "Guerres puniques",
"x": "Le général carthaginois Hannibal traversa les Alpes en 218 avant notre ère avec une armée comprenant des éléphants. Le passage fut extrêmement difficile et plusieurs animaux ne survécurent pas à l'expédition.",
"q": "Pourquoi choisir un itinéraire aussi risqué ?",
"n": "L'audace peut surprendre l'adversaire, mais elle exige une préparation immense."
},
{
"i": "M3-014",
"c": "Histoire",
"k": "savoir",
"t": "Carthage, puissance maritime",
"s": "Méditerranée antique",
"x": "Carthage, fondée selon la tradition par des colons phéniciens, devint une grande puissance commerciale et maritime de la Méditerranée occidentale. Ses rivalités avec Rome conduisirent aux guerres puniques.",
"q": "Comment le commerce peut-il devenir une source de puissance ?",
"n": "Contrôler les routes, c'est parfois peser sur le destin des empires."
},
{
"i": "M3-015",
"c": "Histoire",
"k": "savoir",
"t": "La démocratie athénienne : qui votait ?",
"s": "Grèce antique",
"x": "À Athènes, la démocratie directe permettait à certains citoyens masculins adultes de participer aux décisions. Les femmes, les esclaves et les étrangers résidents en étaient exclus : ce système était donc très différent de la démocratie moderne.",
"q": "La démocratie athénienne était-elle universelle ?",
"n": "Une institution peut être novatrice tout en laissant beaucoup de personnes de côté."
},
{
"i": "M3-016",
"c": "Histoire",
"k": "savoir",
"t": "Les Jeux olympiques antiques",
"s": "Grèce antique",
"x": "Les Jeux olympiques antiques étaient organisés à Olympie en l'honneur de Zeus. Ils faisaient partie d'un ensemble de concours religieux et sportifs qui attiraient des participants de différentes cités grecques.",
"q": "Pourquoi le sport peut-il réunir des cités rivales ?",
"n": "La compétition peut créer un espace commun, même entre adversaires."
},
{
"i": "M3-017",
"c": "Histoire",
"k": "savoir",
"t": "La loi d'Hammurabi",
"s": "Babylone",
"x": "Le Code d'Hammurabi, gravé sur une stèle au XVIIIe siècle avant notre ère, rassemble des décisions juridiques et des règles. Il illustre une tentative ancienne de rendre visibles les normes du pouvoir, même si les peines variaient selon le statut social.",
"q": "Pourquoi rendre les règles publiques ?",
"n": "Une règle connue peut être contestée, comprise et transmise."
},
{
"i": "M3-018",
"c": "Histoire",
"k": "savoir",
"t": "Les routes de la soie n'étaient pas une seule route",
"s": "Eurasie",
"x": "L'expression « routes de la soie » désigne un réseau de voies terrestres et maritimes reliant l'Asie, le Moyen-Orient, l'Afrique du Nord et l'Europe. Des marchandises, des techniques, des religions et des idées y circulaient.",
"q": "Qu'est-ce qui voyage plus facilement que les marchandises ?",
"n": "Les idées empruntent souvent les mêmes chemins que les objets."
},
{
"i": "M3-019",
"c": "Histoire",
"k": "savoir",
"t": "Bagdad, capitale du savoir",
"s": "Monde abbasside",
"x": "À l'époque abbasside, Bagdad devint un centre intellectuel majeur. Des savants y traduisirent, commentèrent et développèrent des travaux issus de plusieurs traditions linguistiques et scientifiques.",
"q": "Pourquoi traduire les œuvres d'autres cultures ?",
"n": "La connaissance avance quand elle dialogue avec ce qui la précède."
},
{
"i": "M3-020",
"c": "Histoire",
"k": "savoir",
"t": "Al-Khwarizmi et l'algèbre",
"s": "Mathématiques",
"x": "Le mathématicien Al-Khwarizmi, actif au IXe siècle, a contribué à la diffusion de méthodes de calcul et de l'algèbre. Le mot « algorithme » dérive de la forme latinisée de son nom.",
"q": "Quel concept mathématique te paraît aujourd'hui indispensable ?",
"n": "Une idée née dans un contexte ancien peut encore organiser notre monde numérique."
},
{
"i": "M3-021",
"c": "Histoire",
"k": "savoir",
"t": "L'université de Sankoré",
"s": "Tombouctou",
"x": "Sankoré est associé à l'histoire intellectuelle de Tombouctou. La ville accueillait des enseignants, des étudiants et des bibliothèques privées, dans un réseau d'apprentissage qui ne ressemblait pas exactement à l'université contemporaine.",
"q": "Qu'est-ce qui fait d'un lieu un centre d'apprentissage ?",
"n": "Une université est d'abord une communauté qui transmet et questionne le savoir."
},
{
"i": "M3-022",
"c": "Histoire",
"k": "savoir",
"t": "Les cités swahilies",
"s": "Côte est-africaine",
"x": "Les villes swahilies de la côte est-africaine, comme Kilwa et Mombasa, participaient aux échanges de l'océan Indien. Leur culture s'est développée à travers des interactions africaines, arabes, persanes et asiatiques.",
"q": "Pourquoi les ports sont-ils souvent des lieux de métissage culturel ?",
"n": "Une ville ouverte sur la mer est souvent ouverte sur plusieurs mondes."
},
{
"i": "M3-023",
"c": "Histoire",
"k": "savoir",
"t": "Kilwa et le commerce de l'or",
"s": "Tanzanie actuelle",
"x": "Kilwa Kisiwani fut un centre important du commerce de l'océan Indien médiéval. La ville participa notamment aux échanges d'or venant de l'intérieur de l'Afrique, ainsi que de céramiques et d'autres marchandises.",
"q": "Comment une ville côtière peut-elle dépendre de régions intérieures ?",
"n": "Les économies sont des réseaux, pas des îles isolées."
},
{
"i": "M3-024",
"c": "Histoire",
"k": "savoir",
"t": "La reine de Saba : entre histoire et tradition",
"s": "Corne de l'Afrique et Arabie",
"x": "La reine de Saba apparaît dans plusieurs traditions religieuses et littéraires. Son historicité et l'identification précise de son royaume font débat : il faut distinguer les récits traditionnels des preuves archéologiques.",
"q": "Pourquoi est-il important de distinguer tradition et preuve ?",
"n": "Un récit peut avoir une grande valeur culturelle sans être un document historique vérifié."
},
{
"i": "M3-025",
"c": "Histoire",
"k": "savoir",
"t": "Les bibliothèques de l'ancienne Ninive",
"s": "Mésopotamie",
"x": "Le roi assyrien Assurbanipal rassembla à Ninive une vaste collection de tablettes cunéiformes. Ces textes ont aidé les chercheurs à étudier la littérature, les sciences et l'administration de la Mésopotamie.",
"q": "Quel document aimerais-tu préserver pour les générations futures ?",
"n": "Archiver, c'est offrir une mémoire à ceux qui ne sont pas encore nés."
},
{
"i": "M3-026",
"c": "Histoire",
"k": "savoir",
"t": "La cité de Pétra",
"s": "Nabatéens",
"x": "Pétra, en Jordanie actuelle, fut un centre nabatéen prospère. Ses habitants maîtrisaient la gestion de l'eau dans un environnement aride et participaient au commerce des caravanes.",
"q": "Quelle innovation rend une ville possible dans le désert ?",
"n": "L'ingéniosité commence souvent par une contrainte très concrète."
},
{
"i": "M3-027",
"c": "Histoire",
"k": "savoir",
"t": "Les routes incas",
"s": "Andes",
"x": "L'empire inca construisit un vaste réseau routier dans les Andes. Des ponts, des relais et des messagers permettaient de relier des territoires difficiles d'accès, malgré l'absence de véhicules à roues pour le transport impérial courant.",
"q": "Quelle difficulté géographique serait la plus compliquée à surmonter ?",
"n": "Une infrastructure peut unir des territoires que la nature sépare."
},
{
"i": "M3-028",
"c": "Histoire",
"k": "savoir",
"t": "Les quipus, mémoire en cordelettes",
"s": "Empire inca",
"x": "Les Incas utilisaient des quipus, ensembles de cordelettes nouées et colorées, pour enregistrer des informations numériques et administratives. Les chercheurs étudient encore toute l'étendue de leurs usages.",
"q": "Peut-on conserver des données sans alphabet ?",
"n": "L'écriture n'est pas la seule manière qu'une société invente pour mémoriser."
},
{
"i": "M3-029",
"c": "Histoire",
"k": "savoir",
"t": "Tenochtitlan, une ville sur le lac",
"s": "Mexica",
"x": "La capitale mexica Tenochtitlan était construite sur des îlots du lac Texcoco. Elle possédait des chaussées, des canaux et des systèmes agricoles adaptés à son environnement lacustre.",
"q": "Quelles solutions urbaines pourraient inspirer les villes d'aujourd'hui ?",
"n": "Les villes anciennes étaient parfois des laboratoires d'ingénierie."
},
{
"i": "M3-030",
"c": "Histoire",
"k": "savoir",
"t": "Les Mayas et le zéro",
"s": "Mésoamérique",
"x": "Les mathématiciens mayas utilisaient un système vigésimal et un symbole pour le zéro dans leurs notations. Le zéro a joué un rôle important dans leurs calculs calendaires et astronomiques.",
"q": "Pourquoi le zéro est-il une invention si puissante ?",
"n": "Une place vide peut parfois porter une valeur essentielle."
},
{
"i": "M3-031",
"c": "Histoire",
"k": "savoir",
"t": "La cité de Cahokia",
"s": "Amérique du Nord",
"x": "Cahokia, près de l'actuelle Saint-Louis, fut l'un des grands centres urbains précolombiens d'Amérique du Nord. Ses monticules monumentaux témoignent d'une organisation sociale et cérémonielle complexe.",
"q": "Pourquoi les sociétés construisent-elles des monuments collectifs ?",
"n": "Un monument révèle autant les croyances que l'organisation du travail."
},
{
"i": "M3-032",
"c": "Histoire",
"k": "savoir",
"t": "L'empire du Ghana",
"s": "Afrique de l'Ouest",
"x": "L'ancien empire du Ghana, situé plus au nord que l'actuel État du Ghana, contrôlait des échanges importants entre les régions sahéliennes et les zones aurifères. Les sources arabophones médiévales décrivent sa puissance commerciale.",
"q": "Pourquoi les noms historiques et les frontières modernes peuvent-ils prêter à confusion ?",
"n": "La géographie du passé ne se superpose pas toujours à celle d'aujourd'hui."
},
{
"i": "M3-033",
"c": "Histoire",
"k": "savoir",
"t": "Sundiata Keïta et la fondation du Mali",
"s": "Tradition épique",
"x": "L'épopée de Sundiata raconte l'ascension du fondateur de l'empire du Mali. Transmise par des griots, elle mêle mémoire historique, valeurs politiques et éléments légendaires ; ses versions varient selon les traditions.",
"q": "Pourquoi les récits oraux changent-ils d'une génération à l'autre ?",
"n": "La mémoire vivante se transmet, s'adapte et se discute."
},
{
"i": "M3-034",
"c": "Histoire",
"k": "savoir",
"t": "Les griots, gardiens de mémoire",
"s": "Afrique de l'Ouest",
"x": "Dans plusieurs sociétés d'Afrique de l'Ouest, les griots et griottes ont transmis des généalogies, des récits, des louanges et des connaissances par la parole et la musique. Leurs rôles varient selon les régions et les familles.",
"q": "Quelle histoire de ta famille mériterait d'être racontée ?",
"n": "La mémoire d'un peuple ne se trouve pas seulement dans les livres."
},
{
"i": "M3-035",
"c": "Histoire",
"k": "savoir",
"t": "La conférence de Berlin",
"s": "1884-1885",
"x": "La conférence de Berlin réunit des puissances européennes et contribua à fixer des règles de concurrence coloniale en Afrique. Les Africains n'y furent pas représentés comme parties prenantes égales, et les conquêtes se poursuivirent ensuite sur le terrain.",
"q": "Pourquoi les décisions prises sans les populations concernées sont-elles lourdes de conséquences ?",
"n": "Les frontières politiques peuvent être le résultat de rapports de force."
},
{
"i": "M3-036",
"c": "Histoire",
"k": "savoir",
"t": "L'indépendance du Congo",
"s": "30 juin 1960",
"x": "Le Congo belge accéda à l'indépendance le 30 juin 1960. Cette transition fut marquée par de fortes tensions politiques et militaires, dont la crise congolaise, qui eut des conséquences nationales et internationales.",
"q": "Pourquoi une indépendance politique ne règle-t-elle pas automatiquement tous les problèmes ?",
"n": "L'indépendance est un commencement exigeant, pas une fin de l'histoire."
},
{
"i": "M3-037",
"c": "Histoire",
"k": "savoir",
"t": "Patrice Lumumba et le discours de l'indépendance",
"s": "Congo",
"x": "Le 30 juin 1960, Patrice Lumumba prononça un discours qui dénonçait les violences et humiliations du système colonial. Son rôle politique et son assassinat en janvier 1961 restent au cœur de la mémoire congolaise.",
"q": "Pourquoi les mots prononcés lors d'un moment historique restent-ils importants ?",
"n": "La parole publique peut devenir un repère de mémoire et de lutte."
},
{
"i": "M3-038",
"c": "Histoire",
"k": "savoir",
"t": "Kimpa Vita et le mouvement antonien",
"s": "Royaume Kongo",
"x": "Kimpa Vita, prophétesse kongo du début du XVIIIe siècle, prêcha un mouvement religieux connu sous le nom d'antonien. Elle défendait une vision chrétienne enracinée dans le monde kongo et fut exécutée en 1706.",
"q": "Comment une idée religieuse peut-elle devenir aussi une contestation politique ?",
"n": "Les croyances peuvent aussi exprimer une aspiration à l'autonomie."
},
{
"i": "M3-039",
"c": "Histoire",
"k": "savoir",
"t": "L'empire songhaï et Gao",
"s": "Afrique de l'Ouest",
"x": "L'empire songhaï devint une puissance majeure au XVe et au XVIe siècle, avec Gao comme centre politique important. Son organisation reposait sur le commerce, l'administration et des forces militaires.",
"q": "Qu'est-ce qui permet à un empire de gouverner un territoire vaste ?",
"n": "La puissance durable demande des institutions, pas seulement un chef."
},
{
"i": "M3-040",
"c": "Histoire",
"k": "savoir",
"t": "La bataille de Kirina : récit fondateur",
"s": "Mali médiéval",
"x": "La bataille de Kirina est un épisode central du récit traditionnel de la fondation de l'empire du Mali par Sundiata Keïta. Les détails sont surtout connus à travers des traditions orales et des reconstructions historiques.",
"q": "Comment traiter un récit fondateur transmis oralement ?",
"n": "Respecter une tradition, c'est aussi préciser ce que l'on sait et ce que l'on ignore."
},
{
"i": "M3-041",
"c": "Histoire",
"k": "savoir",
"t": "Les manuscrits de la mer Morte",
"s": "Judaïsme ancien",
"x": "Découverts à partir de 1947 dans des grottes près de Qumrân, les manuscrits de la mer Morte comprennent des textes bibliques et d'autres écrits juifs anciens. Ils ont éclairé l'histoire des textes et des communautés de l'époque.",
"q": "Pourquoi une découverte fragmentaire peut-elle bouleverser la recherche ?",
"n": "Un petit fragment peut modifier une grande compréhension du passé."
},
{
"i": "M3-042",
"c": "Histoire",
"k": "savoir",
"t": "La route maritime des épices",
"s": "Océan Indien",
"x": "Les épices circulaient par des réseaux maritimes reliant l'Asie du Sud-Est, l'Inde, la péninsule Arabique et l'Afrique orientale. Ces échanges dépendaient des vents de mousson et de la connaissance des saisons.",
"q": "Comment les saisons peuvent-elles organiser le commerce mondial ?",
"n": "Le commerce ancien dépendait autant de la nature que des marchands."
},
{
"i": "M3-047",
"c": "Philosophie",
"k": "savoir",
"t": "Marc Aurèle, l'empereur qui écrivait pour lui-même",
"s": "Stoïcisme romain",
"x": "Marc Aurèle a rédigé des notes personnelles connues sous le titre Pensées pour moi-même. Elles rappellent l'importance de la discipline intérieure, du devoir et de la lucidité face aux événements.",
"q": "Si tu écrivais une phrase pour te guider demain, que dirait-elle ?",
"n": "La réflexion personnelle peut devenir un entraînement quotidien."
},
{
"i": "M3-048",
"c": "Philosophie",
"k": "savoir",
"t": "Sénèque et le temps",
"s": "Philosophie romaine",
"x": "Dans De la brièveté de la vie, Sénèque soutient que nous perdons beaucoup de temps en le dispersant dans des occupations qui ne nous nourrissent pas. Son propos invite à examiner nos priorités.",
"q": "Quelle activité te vole du temps sans vraiment t'apporter quelque chose ?",
"n": "Le temps n'est pas seulement ce qui passe : c'est ce que nous en faisons."
},
{
"i": "M3-049",
"c": "Philosophie",
"k": "savoir",
"t": "Descartes et le doute méthodique",
"s": "Rationalisme",
"x": "Descartes propose de mettre provisoirement en doute les croyances incertaines afin de trouver un point de départ solide. Le doute méthodique n'est pas du pessimisme : c'est une méthode pour mieux établir ce que l'on sait.",
"q": "Quelle information devrais-tu vérifier avant de la partager ?",
"n": "Douter intelligemment, c'est protéger sa pensée contre les erreurs."
},
{
"i": "M3-050",
"c": "Philosophie",
"k": "savoir",
"t": "Kant et la dignité humaine",
"s": "Philosophie morale",
"x": "Kant défend l'idée qu'une personne doit toujours être traitée comme une fin en soi, et jamais simplement comme un moyen. Cette idée nourrit encore les débats sur le respect et les droits humains.",
"q": "Dans une relation, comment reconnaît-on qu'une personne est respectée ?",
"n": "La dignité ne dépend ni de l'utilité ni du statut social."
},
{
"i": "M3-051",
"c": "Philosophie",
"k": "savoir",
"t": "John Locke et les droits",
"s": "Philosophie politique",
"x": "John Locke a défendu l'idée que les individus possèdent des droits naturels, notamment à la vie, à la liberté et aux biens. Ses idées ont influencé plusieurs traditions du libéralisme politique.",
"q": "Pourquoi un pouvoir politique doit-il être limité ?",
"n": "Le pouvoir devient plus légitime lorsqu'il doit rendre des comptes."
},
{
"i": "M3-052",
"c": "Philosophie",
"k": "savoir",
"t": "Montesquieu et la séparation des pouvoirs",
"s": "Droit constitutionnel",
"x": "Montesquieu soutient que la concentration des pouvoirs favorise le despotisme. La séparation entre fonctions législative, exécutive et judiciaire vise à limiter les abus et à organiser des contre-pouvoirs.",
"q": "Pourquoi est-il dangereux qu'une seule personne décide, exécute et juge ?",
"n": "Les institutions solides reposent sur des limites réciproques."
},
{
"i": "M3-053",
"c": "Philosophie",
"k": "savoir",
"t": "Rousseau et le contrat social",
"s": "Philosophie politique",
"x": "Dans Du contrat social, Rousseau cherche à comprendre comment une autorité politique peut être légitime et liée à la volonté générale. Son œuvre a influencé les débats sur la souveraineté populaire.",
"q": "Une loi est-elle légitime simplement parce qu'elle existe ?",
"n": "La légitimité demande plus que la force : elle demande une justification."
},
{
"i": "M3-054",
"c": "Philosophie",
"k": "savoir",
"t": "Mary Wollstonecraft et l'éducation",
"s": "Philosophie féministe",
"x": "Dans Défense des droits de la femme (1792), Mary Wollstonecraft soutient que les femmes doivent accéder à une éducation de qualité. Elle relie l'inégalité à des conditions sociales et éducatives, et non à une incapacité naturelle.",
"q": "Pourquoi l'accès à l'éducation change-t-il la place d'une personne dans la société ?",
"n": "L'égalité commence aussi par l'accès aux moyens de développer ses capacités."
},
{
"i": "M3-055",
"c": "Philosophie",
"k": "savoir",
"t": "Simone de Beauvoir et la liberté",
"s": "Existentialisme",
"x": "Dans Le Deuxième Sexe, Simone de Beauvoir analyse la manière dont la société construit les rôles assignés aux femmes. Sa réflexion célèbre sur le devenir invite à examiner les normes qui semblent naturelles.",
"q": "Quelle norme sociale mérite d'être interrogée ?",
"n": "Comprendre les constructions sociales ouvre un espace de liberté."
},
{
"i": "M3-056",
"c": "Philosophie",
"k": "savoir",
"t": "Hannah Arendt et la responsabilité",
"s": "Philosophie politique",
"x": "Hannah Arendt a étudié le totalitarisme, l'action politique et la responsabilité individuelle. Sa réflexion sur la banalité du mal montre comment l'absence de pensée critique peut accompagner des actes terribles.",
"q": "Pourquoi est-il important de réfléchir à ses actes même lorsqu'on obéit à un ordre ?",
"n": "Penser par soi-même est aussi une responsabilité envers les autres."
},
{
"i": "M3-057",
"c": "Philosophie",
"k": "savoir",
"t": "Frantz Fanon et l'aliénation coloniale",
"s": "Pensée anticoloniale",
"x": "Frantz Fanon, psychiatre et penseur martiniquais, a analysé les effets psychologiques et politiques du colonialisme. Ses ouvrages ont marqué les mouvements anticoloniaux et les débats sur l'identité et la libération.",
"q": "Comment une domination politique peut-elle affecter l'image qu'un peuple a de lui-même ?",
"n": "La liberté concerne aussi la manière de se voir et de se raconter."
},
{
"i": "M3-058",
"c": "Philosophie",
"k": "savoir",
"t": "Kwame Nkrumah et le panafricanisme",
"s": "Pensée africaine",
"x": "Kwame Nkrumah, premier président du Ghana indépendant, défendit l'unité politique africaine comme moyen de renforcer la souveraineté du continent. Le panafricanisme recouvre toutefois plusieurs courants et stratégies.",
"q": "Quels défis exigent une coopération entre pays africains ?",
"n": "La solidarité devient puissante lorsqu'elle se traduit en institutions et en projets."
},
{
"i": "M3-059",
"c": "Philosophie",
"k": "savoir",
"t": "Paulo Freire et l'éducation critique",
"s": "Pédagogie",
"x": "Dans Pédagogie des opprimés, Paulo Freire critique une éducation où l'élève reçoit passivement des informations. Il défend le dialogue et l'apprentissage qui aident les personnes à comprendre et transformer leur réalité.",
"q": "À quel moment as-tu vraiment appris quelque chose : en écoutant ou en pratiquant ?",
"n": "L'éducation ne remplit pas seulement une mémoire : elle développe une capacité d'agir."
},
{
"i": "M3-060",
"c": "Philosophie",
"k": "savoir",
"t": "Confucius et la responsabilité",
"s": "Pensée chinoise",
"x": "Confucius met l'accent sur l'étude, la conduite morale, le respect et les responsabilités dans les relations humaines. Ses enseignements ont profondément influencé plusieurs sociétés d'Asie de l'Est.",
"q": "Quel comportement aimerais-tu voir davantage dans ton entourage ?",
"n": "La qualité d'une société commence aussi dans les relations quotidiennes."
},
{
"i": "M3-061",
"c": "Philosophie",
"k": "savoir",
"t": "Lao Tseu et le non-agir",
"s": "Taoïsme",
"x": "Le taoïsme associé au Tao Te King invite à agir en accord avec le cours des choses plutôt qu'à imposer constamment sa volonté. Le non-agir ne signifie pas paresse, mais action sans forcer inutilement.",
"q": "Dans quel domaine confonds-tu effort et agitation ?",
"n": "Parfois, la meilleure action consiste à retirer ce qui bloque."
},
{
"i": "M3-062",
"c": "Philosophie",
"k": "savoir",
"t": "Montaigne et la connaissance de soi",
"s": "Humanisme",
"x": "Montaigne utilise ses Essais pour examiner ses habitudes, ses contradictions et ses limites. Il fait de l'observation de soi une voie vers une pensée plus humaine et moins dogmatique.",
"q": "Quelle contradiction personnelle as-tu récemment remarquée ?",
"n": "Se connaître, c'est aussi apprendre à reconnaître ses propres limites."
},
{
"i": "M3-063",
"c": "Philosophie",
"k": "savoir",
"t": "John Stuart Mill et la liberté",
"s": "Utilitarisme",
"x": "Dans De la liberté, John Stuart Mill défend une forte protection de la liberté individuelle, avec une limite centrale : empêcher qu'on nuise à autrui. Cette idée nourrit les débats sur la liberté d'expression et l'autonomie.",
"q": "Où placerais-tu la limite entre liberté personnelle et respect d'autrui ?",
"n": "La liberté gagne à être pensée avec la responsabilité."
},
{
"i": "M3-064",
"c": "Philosophie",
"k": "savoir",
"t": "Albert Camus et l'absurde",
"s": "Existentialisme et littérature",
"x": "Dans Le Mythe de Sisyphe, Camus explore l'absurde : le décalage entre notre recherche de sens et le silence du monde. Il ne conclut pas au renoncement, mais à une forme de révolte lucide.",
"q": "Comment continuer à avancer quand tout ne semble pas avoir de sens ?",
"n": "On peut choisir de construire du sens par ses actes, même sans réponse parfaite."
},
{
"i": "M3-065",
"c": "Philosophie",
"k": "savoir",
"t": "Sartre et la responsabilité de choisir",
"s": "Existentialisme",
"x": "Pour Sartre, l'être humain se définit aussi par ses choix et ses actes. La liberté implique une responsabilité : nous ne pouvons pas toujours nous cacher derrière les circonstances pour expliquer ce que nous faisons.",
"q": "Quel choix récent révèle le type de personne que tu veux devenir ?",
"n": "Nos actes donnent une forme concrète à nos valeurs."
},
{
"i": "M3-066",
"c": "Philosophie",
"k": "savoir",
"t": "Achille Mbembe et les imaginaires politiques",
"s": "Pensée contemporaine africaine",
"x": "Achille Mbembe est un philosophe et politologue camerounais dont les travaux interrogent le pouvoir, la postcolonie et les imaginaires politiques. Ses analyses invitent à lire les sociétés africaines au-delà des catégories héritées.",
"q": "Quelle idée reçue sur l'Afrique aimerais-tu déconstruire ?",
"n": "Penser le continent exige de la nuance, de la pluralité et de la profondeur."
},
{
"i": "M3-067",
"c": "Mythologie",
"k": "savoir",
"t": "Prométhée et le feu",
"s": "Mythologie grecque",
"x": "Dans le mythe grec, Prométhée apporte le feu aux humains malgré l'interdiction de Zeus. Le récit est souvent lu comme une réflexion sur le progrès, la transgression et le prix de la connaissance.",
"q": "Le progrès doit-il toujours avoir un prix ?",
"n": "Le savoir libère, mais il demande aussi de la responsabilité."
},
{
"i": "M3-068",
"c": "Mythologie",
"k": "savoir",
"t": "Perséphone et le retour du printemps",
"s": "Mythologie grecque",
"x": "Le mythe de Perséphone, emmenée dans le monde souterrain puis autorisée à revenir auprès de sa mère Déméter une partie de l'année, sert à expliquer symboliquement les saisons dans certaines versions grecques.",
"q": "Pourquoi les humains ont-ils créé des récits pour expliquer les saisons ?",
"n": "Les mythes donnent une forme narrative aux mystères de la nature."
},
{
"i": "M3-069",
"c": "Mythologie",
"k": "savoir",
"t": "Midas et le souhait dangereux",
"s": "Mythologie grecque",
"x": "Le roi Midas obtient le pouvoir de transformer en or tout ce qu'il touche. Il découvre vite que son souhait peut aussi détruire ce qui rend la vie précieuse, comme la nourriture et les liens affectifs.",
"q": "Quel souhait pourrait devenir un problème s'il se réalisait littéralement ?",
"n": "Tout ce qui brille n'est pas forcément un bonheur."
},
{
"i": "M3-070",
"c": "Mythologie",
"k": "savoir",
"t": "Pandore et la jarre",
"s": "Mythologie grecque",
"x": "Dans une version célèbre du mythe, Pandore ouvre une jarre qui libère les maux dans le monde, tandis que l'espérance demeure. Le récit a connu plusieurs interprétations au fil du temps.",
"q": "Pourquoi la curiosité peut-elle être à la fois une force et un risque ?",
"n": "La curiosité ouvre des portes ; la sagesse aide à choisir lesquelles franchir."
},
{
"i": "M3-072",
"c": "Mythologie",
"k": "savoir",
"t": "Athéna et la sagesse stratégique",
"s": "Mythologie grecque",
"x": "Athéna est associée à la sagesse, aux arts et à la stratégie militaire. Dans les récits, elle représente souvent l'intelligence pratique plutôt que la force brute.",
"q": "Dans quelle situation la stratégie vaut-elle mieux que la force ?",
"n": "La meilleure victoire est parfois celle qui évite le combat inutile."
},
{
"i": "M3-075",
"c": "Mythologie",
"k": "savoir",
"t": "Anubis, gardien des rites funéraires",
"s": "Mythologie égyptienne",
"x": "Anubis est une divinité égyptienne associée à la momification et à la protection des morts. Il apparaît notamment dans les représentations de la pesée du cœur, où la conduite du défunt est évaluée.",
"q": "Pourquoi tant de civilisations ont-elles imaginé des rites pour accompagner les morts ?",
"n": "Les rites disent quelque chose de la manière dont une société comprend la vie."
},
{
"i": "M3-076",
"c": "Mythologie",
"k": "savoir",
"t": "Maât et la plume de vérité",
"s": "Mythologie égyptienne",
"x": "Maât représente l'ordre, la vérité et la justice dans la pensée religieuse égyptienne. Dans les scènes funéraires, le cœur du défunt est pesé face à la plume de Maât.",
"q": "Que symbolise pour toi une vie menée avec justice ?",
"n": "La vérité est représentée comme une mesure, pas comme un décor."
},
{
"i": "M3-077",
"c": "Mythologie",
"k": "savoir",
"t": "Osiris et le cycle du renouveau",
"s": "Mythologie égyptienne",
"x": "Osiris est associé à la royauté, à la mort et à la renaissance. Son mythe, lié à Isis et Horus, a joué un rôle majeur dans les croyances funéraires égyptiennes.",
"q": "Pourquoi le thème du renouveau apparaît-il dans tant de mythologies ?",
"n": "Les humains racontent souvent la vie comme un cycle de perte et de retour."
},
{
"i": "M3-078",
"c": "Mythologie",
"k": "savoir",
"t": "Ra, le soleil en voyage",
"s": "Mythologie égyptienne",
"x": "Ra, dieu solaire égyptien, traverse le ciel durant le jour et le monde souterrain durant la nuit dans plusieurs traditions. Son parcours symbolise la régularité du cosmos et le retour de la lumière.",
"q": "Quelle routine naturelle te donne un sentiment de stabilité ?",
"n": "La régularité peut être une force face au chaos."
},
{
"i": "M3-079",
"c": "Mythologie",
"k": "savoir",
"t": "Thor et son marteau",
"s": "Mythologie nordique",
"x": "Thor est le dieu nordique associé au tonnerre et protecteur des humains et des dieux. Son marteau Mjölnir est l'un de ses attributs les plus connus, symbole de force et de protection.",
"q": "La force suffit-elle pour protéger les autres ?",
"n": "La puissance devient utile lorsqu'elle sert une responsabilité."
},
{
"i": "M3-080",
"c": "Mythologie",
"k": "savoir",
"t": "Odin et le prix du savoir",
"s": "Mythologie nordique",
"x": "Dans les récits nordiques, Odin recherche la connaissance et accepte des sacrifices pour l'obtenir, notamment le sacrifice symbolique d'un œil dans une tradition liée au puits de Mímir.",
"q": "Jusqu'où serais-tu prêt à aller pour apprendre quelque chose d'essentiel ?",
"n": "La connaissance peut exiger du temps, de l'humilité et des renoncements."
},
{
"i": "M3-081",
"c": "Mythologie",
"k": "savoir",
"t": "Yggdrasil, l'arbre des mondes",
"s": "Mythologie nordique",
"x": "Yggdrasil est l'arbre cosmique qui relie plusieurs mondes dans la mythologie nordique. Il représente une vision du cosmos comme un ensemble de royaumes interdépendants.",
"q": "Si ta vie était un arbre, quelles seraient ses racines ?",
"n": "Ce qui nous relie est parfois aussi important que ce qui nous distingue."
},
{
"i": "M3-082",
"c": "Mythologie",
"k": "savoir",
"t": "Mami Wata, eaux et puissances",
"s": "Traditions africaines",
"x": "Mami Wata est une figure spirituelle présente sous différentes formes dans plusieurs régions d'Afrique et de sa diaspora. Les représentations, récits et pratiques varient fortement selon les communautés.",
"q": "Pourquoi faut-il éviter de réduire une tradition à une seule version ?",
"n": "Une tradition vivante possède souvent plusieurs voix et plusieurs histoires."
},
{
"i": "M3-083",
"c": "Mythologie",
"k": "savoir",
"t": "Shango, puissance du tonnerre",
"s": "Tradition yoruba",
"x": "Dans la tradition yoruba, Shango est une divinité associée au tonnerre, à la foudre et à la royauté. Ses récits et son culte ont voyagé avec les diasporas africaines et se sont transformés selon les contextes.",
"q": "Comment une tradition peut-elle voyager tout en gardant une mémoire ?",
"n": "La culture traverse les océans sans rester immobile."
},
{
"i": "M3-084",
"c": "Mythologie",
"k": "savoir",
"t": "Les jumeaux Ibeji",
"s": "Tradition yoruba",
"x": "Dans certaines traditions yoruba, les Ibeji sont associés aux jumeaux et à une force spirituelle particulière. Les pratiques et interprétations varient selon les communautés ; ils peuvent être liés à des rites de protection et de mémoire.",
"q": "Qu'est-ce qu'une société peut exprimer à travers ses rites familiaux ?",
"n": "Les rituels donnent une place symbolique aux liens humains."
},
{
"i": "M3-085",
"c": "Mythologie",
"k": "savoir",
"t": "Anansi, l'araignée rusée",
"s": "Traditions akan",
"x": "Anansi est un personnage-araignée de nombreux récits akan et ouest-africains, connu pour sa ruse et ses histoires. Il gagne parfois par l'intelligence, mais ses plans peuvent aussi se retourner contre lui.",
"q": "La ruse est-elle toujours une forme d'intelligence ?",
"n": "Être malin ne dispense pas d'être sage."
},
{
"i": "M3-087",
"c": "Mythologie",
"k": "savoir",
"t": "Amaterasu et la lumière cachée",
"s": "Mythologie japonaise",
"x": "Dans le mythe japonais, la déesse solaire Amaterasu se retire dans une grotte après un conflit, plongeant le monde dans l'obscurité. Les autres divinités organisent une ruse festive pour la faire sortir.",
"q": "Comment un groupe peut-il aider quelqu'un à retrouver confiance ?",
"n": "La lumière revient parfois grâce à l'intelligence collective."
},
{
"i": "M3-088",
"c": "Mythologie",
"k": "savoir",
"t": "Quetzalcoatl, le serpent à plumes",
"s": "Mésoamérique",
"x": "Quetzalcoatl, le serpent à plumes, est une divinité importante dans plusieurs traditions mésoaméricaines, avec des formes et fonctions différentes selon les peuples et les époques.",
"q": "Pourquoi un même symbole peut-il avoir plusieurs significations ?",
"n": "Les symboles vivent et changent avec les sociétés qui les portent."
},
{
"i": "M3-089",
"c": "Mythologie",
"k": "savoir",
"t": "Pachamama, la Terre nourricière",
"s": "Traditions andines",
"x": "Pachamama est une figure majeure de plusieurs traditions andines, liée à la terre, à la fertilité et aux cycles de la vie. Les pratiques qui lui sont associées varient selon les régions et les communautés.",
"q": "Que signifie prendre soin de la terre qui nous nourrit ?",
"n": "La gratitude envers la nature peut devenir une responsabilité concrète."
},
{
"i": "M3-090",
"c": "Mythologie",
"k": "savoir",
"t": "Le trickster : celui qui dérange l'ordre",
"s": "Mythes comparés",
"x": "Dans plusieurs traditions du monde, des personnages rusés transgressent les règles et révèlent les contradictions d'une société. Ils peuvent être comiques, dangereux ou libérateurs selon les récits.",
"q": "Pourquoi les histoires ont-elles besoin de personnages qui bousculent les règles ?",
"n": "Le désordre d'un personnage peut révéler les failles d'un système."
},
{
"i": "M3-091",
"c": "Énigmes",
"k": "enigme",
"t": "Les trois interrupteurs",
"s": "Logique",
"x": "Tu es devant trois interrupteurs. Dans une autre pièce fermée se trouve une ampoule classique. Un seul interrupteur l'allume. Tu peux manipuler les interrupteurs comme tu veux, mais entrer une seule fois dans la pièce.",
"q": "Comment identifier le bon interrupteur en une seule visite ?",
"a": "Allume le premier interrupteur quelques minutes, puis éteins-le. Allume le deuxième et entre. Si l'ampoule est allumée, c'est le deuxième. Si elle est éteinte mais chaude, c'est le premier. Si elle est éteinte et froide, c'est le troisième.",
"n": "La solution utilise deux indices : la lumière et la chaleur."
},
{
"i": "M3-094",
"c": "Énigmes",
"k": "enigme",
"t": "Le nombre qui manque",
"s": "Suite logique",
"x": "Complète la suite : 2, 6, 12, 20, 30, ?",
"q": "Quel motif relie les nombres ?",
"a": "42. Les écarts sont 4, 6, 8, 10 puis 12.",
"n": "Repérer les écarts peut révéler une structure cachée."
},
{
"i": "M3-095",
"c": "Énigmes",
"k": "enigme",
"t": "La course",
"s": "Logique",
"x": "Pendant une course, tu dépasses la personne qui occupe la deuxième place. À quelle place te retrouves-tu ?",
"q": "Ne confonds pas dépasser et prendre la première place.",
"a": "À la deuxième place.",
"n": "La réponse est souvent dans le détail exact de la phrase."
},
{
"i": "M3-096",
"c": "Énigmes",
"k": "enigme",
"t": "Le père de Marie",
"s": "Déduction",
"x": "Le père de Marie a cinq filles : Nana, Néné, Nini, Nono et… comment s'appelle la cinquième ?",
"q": "Relis le début de l'énoncé.",
"a": "Marie.",
"n": "Le prénom est déjà donné dans la question."
},
{
"i": "M3-097",
"c": "Énigmes",
"k": "enigme",
"t": "Les deux pièces",
"s": "Probabilités",
"x": "Tu as deux pièces équilibrées. Tu les lances en même temps. Quelle est la probabilité d'obtenir deux faces ?",
"q": "Combien d'issues équiprobables existe-t-il ?",
"a": "1 chance sur 4 : les issues sont face-face, face-pile, pile-face et pile-pile.",
"n": "Lister les possibilités évite de répondre au hasard."
},
{
"i": "M3-099",
"c": "Énigmes",
"k": "enigme",
"t": "La bougie et le vent",
"s": "Énigme",
"x": "Une bougie brûle dans une pièce. Le vent souffle et l'éteint. Que reste-t-il de la bougie ?",
"q": "Pense à ce qui a disparu et à ce qui subsiste.",
"a": "Il reste la bougie éteinte, partiellement consumée.",
"n": "La réponse la plus simple est parfois la bonne."
},
{
"i": "M3-100",
"c": "Énigmes",
"k": "enigme",
"t": "Le médecin et l'enfant",
"s": "Déduction",
"x": "Un enfant est blessé dans un accident. À l'hôpital, le médecin dit : « Je ne peux pas l'opérer, c'est mon enfant. » Comment est-ce possible ?",
"q": "Questionne l'idée que le médecin serait forcément un homme.",
"a": "Le médecin est sa mère (ou son autre parent).",
"n": "Nos automatismes peuvent influencer notre raisonnement."
},
{
"i": "M3-101",
"c": "Énigmes",
"k": "enigme",
"t": "Les cinq machines",
"s": "Proportionnalité",
"x": "Cinq machines fabriquent cinq objets en cinq minutes. Combien de temps faut-il à cent machines pour fabriquer cent objets, si elles travaillent au même rythme ?",
"q": "Calcule le rythme d'une machine.",
"a": "Cinq minutes : chaque machine fabrique un objet en cinq minutes.",
"n": "La proportionnalité demande d'identifier ce qui reste constant."
},
{
"i": "M3-102",
"c": "Énigmes",
"k": "enigme",
"t": "L'âge mystérieux",
"s": "Algèbre",
"x": "Un étudiant dit : « Dans trois ans, j'aurai deux fois l'âge que j'avais il y a trois ans. » Quel âge a-t-il aujourd'hui ?",
"q": "Appelle x son âge actuel.",
"a": "9 ans : dans trois ans il aura 12 ans, soit le double de 6 ans.",
"n": "Une équation simple peut résoudre une phrase qui semble compliquée."
},
{
"i": "M3-103",
"c": "Énigmes",
"k": "enigme",
"t": "Le verre d'eau",
"s": "Pensée latérale",
"x": "Un homme entre dans un café et demande un verre d'eau. Le serveur sort soudain un objet qui effraie l'homme. Celui-ci remercie le serveur et part. Pourquoi ?",
"q": "Imagine un problème que le verre d'eau pourrait résoudre sans être bu.",
"a": "L'homme avait le hoquet. Le serveur l'a surpris pour le faire passer.",
"n": "La pensée latérale explore des scénarios inattendus."
},
{
"i": "M3-105",
"c": "Énigmes",
"k": "enigme",
"t": "Le père a 40 ans",
"s": "Calcul",
"x": "Un père a 40 ans et son enfant 10 ans. Dans combien d'années le père aura-t-il exactement deux fois l'âge de son enfant ?",
"q": "Écris 40+x = 2(10+x).",
"a": "Dans 20 ans : le père aura 60 ans et l'enfant 30 ans.",
"n": "Les âges évoluent au même rythme, mais leur rapport change."
},
{
"i": "M3-106",
"c": "Énigmes",
"k": "enigme",
"t": "Le nombre de poignées de main",
"s": "Combinatoire",
"x": "Six étudiants se rencontrent. Chacun serre une seule fois la main de chaque autre étudiant. Combien de poignées de main au total ?",
"q": "Compte les paires, pas les gestes dans les deux sens.",
"a": "15 poignées de main : 6 × 5 ÷ 2.",
"n": "Compter chaque paire une seule fois évite les doublons."
},
{
"i": "M3-107",
"c": "Énigmes",
"k": "enigme",
"t": "Le train électrique",
"s": "Attention",
"x": "Un train électrique roule vers le nord. Le vent souffle vers l'ouest. Dans quelle direction part sa fumée ?",
"q": "Quel mot de l'énoncé change tout ?",
"a": "Il n'y a pas de fumée : le train est électrique.",
"n": "Une bonne lecture évite de résoudre un faux problème."
},
{
"i": "M3-108",
"c": "Énigmes",
"k": "enigme",
"t": "Le père et le fils",
"s": "Suite de chiffres",
"x": "Un père et son fils ont ensemble 66 ans. L'âge du père s'écrit avec les chiffres de l'âge du fils, mais à l'envers. Les deux âges ont deux chiffres et le père est plus âgé. Quelles sont les possibilités ?",
"q": "Cherche les paires de nombres à deux chiffres inversés qui font 66.",
"a": "51 et 15, ou 42 et 24. Si le fils a pour chiffres a et b, la somme des deux âges vaut 11 × (a + b) ; comme elle vaut 66, a + b = 6. Avec un père plus âgé et deux chiffres chacun, il reste ces deux solutions.",
"n": "Un problème peut être sous-déterminé : il faut parfois demander une précision."
},
{
"i": "M3-109",
"c": "Énigmes",
"k": "enigme",
"t": "Les livres sur l'étagère",
"s": "Combinatoire",
"x": "Tu as quatre livres différents. De combien de façons peux-tu les ranger sur une étagère ?",
"q": "Utilise le principe des choix successifs.",
"a": "24 façons : 4 × 3 × 2 × 1.",
"n": "Les permutations grandissent vite avec le nombre d'objets."
},
{
"i": "M3-110",
"c": "Énigmes",
"k": "enigme",
"t": "La bouteille et son bouchon",
"s": "Calcul",
"x": "Une bouteille et son bouchon coûtent ensemble 110 unités. La bouteille coûte 100 unités de plus que le bouchon. Combien coûte le bouchon ?",
"q": "Si le bouchon coûtait 10, la bouteille coûterait-elle 100 de plus ?",
"a": "5 unités : bouteille 105, bouchon 5, total 110.",
"n": "Les réponses intuitives méritent parfois une vérification algébrique."
},
{
"i": "M3-111",
"c": "Humour étudiant",
"k": "humour",
"t": "Le polycopié de 87 pages",
"s": "Vie de campus",
"x": "Le professeur dit : « Ce document est juste un petit support pour compléter le cours. » Tu l'ouvres : 87 pages, 14 chapitres, 6 annexes et une bibliographie qui a sa propre bibliographie.",
"q": "Combien de pages fait le « petit support » de ton dernier cours ?",
"n": "À l'université, le mot « petit » est parfois une unité de mesure émotionnelle."
},
{
"i": "M3-113",
"c": "Humour étudiant",
"k": "humour",
"t": "La veille de l'examen",
"s": "Révisions",
"x": "Tu avais prévu de commencer les révisions lundi. Lundi, tu as organisé ton bureau. Mardi, tu as choisi la musique. Mercredi, tu as téléchargé les PDF. Jeudi, tu as enfin découvert le titre du chapitre 1.",
"q": "À quel moment la préparation devient-elle une vraie révision ?",
"n": "Préparer les conditions de travail, c'est bien. Travailler, c'est encore mieux."
},
{
"i": "M3-114",
"c": "Humour étudiant",
"k": "humour",
"t": "Le Wi-Fi de la faculté",
"s": "Campus",
"x": "Le Wi-Fi de la faculté affiche trois barres, mais la page charge depuis si longtemps que tu as le temps de relire le cours, de méditer et de reconsidérer ton orientation.",
"q": "Quelle activité devient possible quand Internet ne fonctionne plus ?",
"n": "Parfois, la meilleure connexion est celle avec ses notes hors ligne."
},
{
"i": "M3-115",
"c": "Humour étudiant",
"k": "humour",
"t": "Le réveil du cours de 7 h",
"s": "Vie étudiante",
"x": "Ton réveil sonne à 5 h 30. Ton cerveau répond : « Message reçu, traitement prévu après une courte réunion avec l'oreiller. » À 6 h 45, la réunion n'est toujours pas terminée.",
"q": "Combien de réveils faut-il pour convaincre ton cerveau ?",
"n": "La ponctualité commence la veille, pas au troisième snooze."
},
{
"i": "M3-116",
"c": "Humour étudiant",
"k": "humour",
"t": "Le « j'arrive »",
"s": "Vie de campus",
"x": "Un camarade écrit « j'arrive » alors qu'il est encore chez lui, en serviette, à chercher ses chaussures. Ce n'est pas un mensonge : c'est une estimation très optimiste.",
"q": "Quelle expression étudiante mériterait un dictionnaire ?",
"n": "La ponctualité est une science qui mérite parfois des travaux pratiques."
},
{
"i": "M3-117",
"c": "Humour étudiant",
"k": "humour",
"t": "Le PDF nommé final-final",
"s": "Organisation",
"x": "Ton ordinateur contient : devoir.pdf, devoir-final.pdf, devoir-final2.pdf, devoir-vraiment-final.pdf et devoir-final-cette-fois.pdf. Le vrai fichier est évidemment celui que tu n'as pas ouvert.",
"q": "Quel nom donnerais-tu au prochain fichier ?",
"n": "Une bonne organisation évite les fouilles archéologiques dans son ordinateur."
},
{
"i": "M3-118",
"c": "Humour étudiant",
"k": "humour",
"t": "La question après le cours",
"s": "Études",
"x": "Le professeur demande : « Des questions ? » Silence total. Une fois dehors, tout le monde découvre exactement la même question, mais personne ne veut retourner dans l'auditoire.",
"q": "Pourquoi est-il parfois difficile de poser une question en classe ?",
"n": "Une question posée peut aider toute la salle, pas seulement une personne."
},
{
"i": "M3-119",
"c": "Humour étudiant",
"k": "humour",
"t": "Le budget étudiant",
"s": "Vie quotidienne",
"x": "Tu reçois ton argent et tu fais un budget très sérieux : transport, nourriture, impressions, économies. Trois jours plus tard, tu fais une enquête financière pour retrouver la trace de trois petits achats.",
"q": "Quel poste de dépense surprend le plus souvent ton budget ?",
"n": "Les petites dépenses savent parfois travailler en équipe."
},
{
"i": "M3-120",
"c": "Humour étudiant",
"k": "humour",
"t": "Le chargeur emprunté",
"s": "Campus",
"x": "Tu prêtes ton chargeur « juste cinq minutes ». Trois heures plus tard, il a changé de faculté, de propriétaire et probablement de pays. Tu dois maintenant lancer une enquête internationale.",
"q": "Quelle chose ne faut-il jamais prêter sans noter le nom ?",
"n": "Le prêt est un acte de confiance ; le retour est une preuve de caractère."
},
{
"i": "M3-122",
"c": "Humour étudiant",
"k": "humour",
"t": "Le « c'est facile »",
"s": "Examens",
"x": "Un camarade sort de l'examen et dit : « Franchement, c'était facile. » Tu demandes le sujet. Il répond : « Je n'ai pas compris la troisième question, mais le reste était facile. »",
"q": "Quelle phrase entend-on toujours après un examen ?",
"n": "Ne mesure pas ta préparation à la confiance affichée par les autres."
},
{
"i": "M3-123",
"c": "Humour étudiant",
"k": "humour",
"t": "Le groupe de classe à minuit",
"s": "Messagerie",
"x": "À 23 h 58, quelqu'un écrit : « Bonsoir, quelqu'un a le cours ? » À 00 h 01, 36 messages arrivent, dont 12 « moi aussi je cherche ». La solidarité universitaire est réveillée.",
"q": "À quelle heure les documents deviennent-ils soudain urgents ?",
"n": "Le meilleur moment pour demander un cours reste avant la veille de l'examen."
},
{
"i": "M3-124",
"c": "Humour étudiant",
"k": "humour",
"t": "La motivation du dimanche",
"s": "Procrastination",
"x": "Dimanche soir, tu déclares : « Dès demain, nouvelle vie : réveil tôt, sport, lecture, révision et discipline. » Lundi matin, ton premier objectif est de négocier cinq minutes supplémentaires.",
"q": "Quel petit engagement réaliste peux-tu tenir dès demain ?",
"n": "Une petite promesse tenue vaut mieux qu'une grande révolution reportée."
},
{
"i": "M3-125",
"c": "Humour étudiant",
"k": "humour",
"t": "Le stylo porte-bonheur",
"s": "Examens",
"x": "Tu as un stylo que tu utilises à chaque examen. Tu sais qu'il n'a aucun pouvoir magique, mais tu refuses de prendre le risque de tester cette théorie le jour de l'épreuve.",
"q": "As-tu un objet porte-bonheur pendant les examens ?",
"n": "Les rituels rassurent ; la préparation, elle, fait le travail."
},
{
"i": "M3-130",
"c": "Motivation",
"k": "savoir",
"t": "Une erreur est une information",
"s": "Apprentissage",
"x": "Une erreur corrigée indique précisément ce qu'il faut retravailler. Après un exercice raté, note la cause : notion incomprise, consigne mal lue, manque de temps ou méthode inadaptée.",
"q": "Quelle erreur récente t'a appris quelque chose ?",
"n": "Ne cache pas l'erreur : transforme-la en plan d'action."
},
{
"i": "M3-131",
"c": "Motivation",
"k": "savoir",
"t": "Le pouvoir d'une question",
"s": "Curiosité",
"x": "Quand tu ne comprends pas, formule une question précise : « Quelle étape me manque ? », « Pourquoi cette règle s'applique-t-elle ? » Une bonne question aide à obtenir une aide utile.",
"q": "Quelle question pourrais-tu poser à un enseignant ou à un camarade ?",
"n": "Demander de l'aide est une stratégie, pas une faiblesse."
},
{
"i": "M3-132",
"c": "Motivation",
"k": "savoir",
"t": "Construire une réputation",
"s": "Intégrité",
"x": "La réputation universitaire se construit aussi par de petits actes : rendre un travail honnête, respecter un délai, reconnaître une erreur et tenir ses engagements.",
"q": "Quel comportement aimerais-tu que les autres associent à ton nom ?",
"n": "La crédibilité se gagne par répétition, pas par déclaration."
},
{
"i": "M3-133",
"c": "Motivation",
"k": "savoir",
"t": "L'effort invisible",
"s": "Persévérance",
"x": "Les progrès ne sont pas toujours visibles séance après séance. Une lecture, un exercice corrigé ou une question comprise peuvent sembler modestes, mais ils s'accumulent.",
"q": "Quel effort discret as-tu fourni récemment ?",
"n": "Tout progrès important possède une partie que personne n'applaudit."
},
{
"i": "M3-134",
"c": "Motivation",
"k": "savoir",
"t": "Apprendre à dire non",
"s": "Priorités",
"x": "Accepter toutes les demandes peut remplir ton agenda et vider ton énergie. Dire non avec respect à une activité non prioritaire permet parfois de protéger un engagement important.",
"q": "À quoi devrais-tu dire non pour respecter une priorité ?",
"n": "Chaque oui a un coût : choisis-le consciemment."
},
{
"i": "M3-135",
"c": "Motivation",
"k": "savoir",
"t": "La discipline n'est pas la perfection",
"s": "Habitudes",
"x": "Une routine utile n'exige pas de réussir chaque jour. Si tu manques une séance, reprends simplement au prochain créneau au lieu de transformer un écart en abandon complet.",
"q": "Quel est ton plan pour reprendre après une journée improductive ?",
"n": "La constance se mesure aussi à la capacité de recommencer."
},
{
"i": "M3-136",
"c": "Amour et relations",
"k": "savoir",
"t": "L'attention vaut plus qu'un grand discours",
"s": "Relation",
"x": "Dans une relation, l'attention se voit dans les gestes ordinaires : écouter sans interrompre, se souvenir d'un détail important et respecter le temps de l'autre.",
"q": "Quel petit geste te fait sentir considéré ?",
"n": "L'affection devient crédible lorsqu'elle se traduit dans les actes."
},
{
"i": "M3-137",
"c": "Amour et relations",
"k": "savoir",
"t": "La jalousie n'est pas une preuve d'amour",
"s": "Confiance",
"x": "Ressentir de la jalousie peut arriver, mais contrôler les messages, les vêtements ou les fréquentations de l'autre n'est pas une preuve d'amour. La confiance se construit par le dialogue et le respect.",
"q": "Comment exprimer une insécurité sans contrôler l'autre ?",
"n": "Aimer quelqu'un ne donne pas un droit de propriété sur sa vie."
},
{
"i": "M3-138",
"c": "Amour et relations",
"k": "savoir",
"t": "Savoir poser une limite",
"s": "Respect",
"x": "Une limite claire indique ce que tu acceptes ou refuses : disponibilité, intimité, paroles blessantes ou pression. Une relation saine doit permettre à chacun de dire non sans peur.",
"q": "Quelle limite est importante pour ton équilibre ?",
"n": "Une limite n'est pas une punition ; c'est une information sur ton respect de toi."
},
{
"i": "M3-139",
"c": "Amour et relations",
"k": "savoir",
"t": "Les excuses qui réparent",
"s": "Communication",
"x": "Une excuse utile reconnaît le tort, évite de rejeter la faute et précise ce qui changera. Dire « désolé si tu l'as mal pris » ne reconnaît pas vraiment l'acte qui a blessé.",
"q": "Quelle différence fais-tu entre regretter et réparer ?",
"n": "Les excuses prennent leur valeur dans le changement qui suit."
},
{
"i": "M3-141",
"c": "Amour et relations",
"k": "savoir",
"t": "Étudier et aimer : trouver un rythme",
"s": "Vie étudiante",
"x": "Une relation peut soutenir les études, mais elle demande aussi du temps et de l'écoute. Parler des périodes d'examens et des disponibilités évite de confondre manque de temps et manque d'affection.",
"q": "Comment prévenir l'autre quand tu entres dans une période chargée ?",
"n": "L'organisation protège parfois les sentiments des malentendus."
},
{
"i": "M3-142",
"c": "Amour et relations",
"k": "savoir",
"t": "L'écoute active",
"s": "Communication",
"x": "Écouter activement, c'est chercher à comprendre avant de répondre : reformuler, poser une question et vérifier qu'on a bien saisi ce que l'autre ressent.",
"q": "Quelle question montre que tu écoutes vraiment ?",
"n": "Être entendu peut parfois compter autant que recevoir un conseil."
},
{
"i": "M3-143",
"c": "Amour et relations",
"k": "savoir",
"t": "Ne pas confondre silence et consentement",
"s": "Consentement",
"x": "Le consentement doit être libre, éclairé et réversible. Le silence, la peur, la pression ou l'absence de réponse ne valent pas un oui. Chacun peut changer d'avis.",
"q": "Pourquoi est-il important de demander clairement plutôt que de supposer ?",
"n": "Le respect commence lorsque la liberté de l'autre est réelle."
},
{
"i": "M3-144",
"c": "Amour et relations",
"k": "savoir",
"t": "L'amitié après un désaccord",
"s": "Amitié",
"x": "Un désaccord ne signifie pas nécessairement la fin d'une amitié. Il est possible de discuter du problème sans humilier l'autre, de reconnaître sa part et de décider ensemble de la suite.",
"q": "Comment exprimer un désaccord sans attaquer la personne ?",
"n": "On peut s'opposer à une idée sans dévaloriser celui qui la porte."
},
{
"i": "M3-145",
"c": "Amour et relations",
"k": "savoir",
"t": "Le temps personnel",
"s": "Autonomie",
"x": "Avoir besoin de temps seul, d'études ou de moments avec ses amis ne signifie pas aimer moins. Une relation équilibrée laisse de la place à l'identité de chacun.",
"q": "Comment expliquer ton besoin d'espace avec bienveillance ?",
"n": "Deux personnes peuvent être proches sans devoir être ensemble à chaque instant."
},
{
"i": "M3-146",
"c": "Amour et relations",
"k": "savoir",
"t": "Les actes et les promesses",
"s": "Confiance",
"x": "Une promesse répétée sans changement finit par perdre sa valeur. La confiance se reconstruit grâce à des actes cohérents, observables et maintenus dans le temps.",
"q": "Quel acte concret peut restaurer la confiance ?",
"n": "La confiance ne se réclame pas : elle se reconstruit."
},
{
"i": "M3-147",
"c": "Amour et relations",
"k": "savoir",
"t": "L'amour-propre sans arrogance",
"s": "Estime de soi",
"x": "L'estime de soi consiste à reconnaître sa valeur sans se croire supérieur. Elle aide à ne pas accepter l'humiliation pour éviter la solitude.",
"q": "Quelle parole bienveillante pourrais-tu te dire après un échec ?",
"n": "Se respecter n'oblige pas à rabaisser les autres."
},
{
"i": "M3-148",
"c": "Amour et relations",
"k": "savoir",
"t": "Le crush et le scénario imaginaire",
"s": "Humour et sentiments",
"x": "Tu as échangé deux phrases avec quelqu'un et ton imagination a déjà choisi les prénoms des enfants, le quartier et la couleur des rideaux. Respire : tu as peut-être simplement rencontré une personne intéressante.",
"q": "Comment garder les pieds sur terre quand quelqu'un te plaît ?",
"n": "Laisse la réalité apprendre à connaître la personne avant le scénario."
},
{
"i": "M3-149",
"c": "Amour et relations",
"k": "savoir",
"t": "Choisir une relation réciproque",
"s": "Relation",
"x": "Une relation équilibrée ne repose pas sur une seule personne qui écrit, propose, s'excuse et fait tous les efforts. La réciprocité n'est pas un calcul exact, mais chacun doit contribuer au lien.",
"q": "Dans tes relations, te sens-tu libre de donner et de recevoir ?",
"n": "Tu mérites un lien où l'effort circule dans les deux sens."
},
{
"i": "M3-150",
"c": "Amour et relations",
"k": "savoir",
"t": "Aimer sans s'oublier",
"s": "Équilibre",
"x": "S'investir dans une relation ne devrait pas t'obliger à abandonner tes études, tes amitiés, tes projets ou tes valeurs. Une relation saine peut accompagner ton développement au lieu de le remplacer.",
"q": "Quel projet personnel veux-tu continuer à nourrir ?",
"n": "Une relation peut être une partie de ta vie sans devenir toute ta vie."
},
{
"i": "M4-001",
"c": "Histoire",
"k": "savoir",
"t": "Le cuivre, métal de prestige et d'échange",
"s": "Katanga et réseaux commerciaux",
"x": "Bien avant les frontières actuelles, les régions du sud-est de l'Afrique centrale participaient à des réseaux d'échanges où le cuivre avait une grande valeur. Les objets en cuivre circulaient comme biens de prestige, matière première et parfois moyen d'échange. Les savoir-faire métallurgiques reliaient communautés, marchés et pouvoirs politiques.",
"q": "Pourquoi un métal comme le cuivre pouvait-il renforcer le pouvoir d'un royaume ?",
"n": "Les ressources naturelles ne deviennent une puissance que grâce aux savoir-faire, aux échanges et aux institutions."
},
{
"i": "M4-002",
"c": "Histoire",
"k": "savoir",
"t": "Nehanda, figure de résistance au Zimbabwe",
"s": "Mémoire et résistance",
"x": "Nehanda Nyakasikana est devenue une figure majeure de la mémoire de la résistance au pouvoir colonial dans l'actuel Zimbabwe. Associée à la première Chimurenga de 1896-1897, elle fut arrêtée et exécutée par les autorités coloniales. Son histoire a ensuite inspiré des récits politiques, littéraires et artistiques.",
"q": "Pourquoi Nehanda reste-t-elle une figure importante au-delà de son époque ?",
"n": "Une personne peut mourir, mais la signification collective de son combat peut continuer à vivre."
},
{
"i": "M4-003",
"c": "Histoire",
"k": "savoir",
"t": "La constitution de Médine, un pacte entre communautés",
"s": "Histoire politique",
"x": "Au VIIe siècle, un document connu sous le nom de Constitution de Médine est associé à l'organisation des relations entre différents groupes de la ville. Les historiens débattent de sa composition exacte et de ses différentes strates, mais il est souvent étudié comme un exemple ancien de pacte politique et communautaire.",
"q": "Quelle idée politique peut-on retenir de ce document ?",
"n": "Les institutions naissent souvent de la nécessité de faire coexister des différences."
},
{
"i": "M4-004",
"c": "Histoire",
"k": "savoir",
"t": "Les bibliothèques de Tombouctou ont voyagé pour survivre",
"s": "Patrimoine africain",
"x": "Au début du XXIe siècle, face à la menace de destruction de manuscrits à Tombouctou, des habitants et des bibliothécaires ont organisé le déplacement discret de nombreux documents vers Bamako. Ces manuscrits couvrent notamment le droit, la médecine, l'astronomie, la poésie et la religion. Leur sauvegarde a reposé sur des réseaux locaux de confiance et de courage.",
"q": "Qui a joué un rôle essentiel dans cette sauvegarde ?",
"n": "Préserver le savoir est parfois un travail collectif, discret et risqué."
},
{
"i": "M4-005",
"c": "Histoire",
"k": "savoir",
"t": "Le royaume du Bénin et ses plaques de bronze",
"s": "Art et pouvoir",
"x": "Le royaume du Bénin, dans l'actuel Nigeria, a produit des plaques et sculptures en alliage de cuivre remarquables. Certaines décoraient le palais royal et représentaient des souverains, des dignitaires ou des événements de cour. Beaucoup furent pillées lors de l'expédition britannique de 1897 et se trouvent aujourd'hui dans des collections étrangères.",
"q": "Pourquoi ces œuvres sont-elles aussi des documents historiques ?",
"n": "Une œuvre d'art peut être à la fois belle, politique et porteuse de mémoire."
},
{
"i": "M4-006",
"c": "Histoire",
"k": "savoir",
"t": "Wangari Maathai, planter pour transformer la société",
"s": "Environnement et engagement",
"x": "La Kényane Wangari Maathai a fondé le Green Belt Movement en 1977. Le mouvement a mobilisé des communautés, en particulier des femmes, autour de la plantation d'arbres, de la protection de l'environnement et de l'autonomie locale. En 2004, elle a reçu le prix Nobel de la paix.",
"q": "Quel lien son action établissait-elle entre environnement et société ?",
"n": "Un arbre planté peut aussi être le début d'une organisation collective."
},
{
"i": "M4-007",
"c": "Histoire",
"k": "savoir",
"t": "La révolution haïtienne a changé l'histoire atlantique",
"s": "Liberté et indépendance",
"x": "La révolution haïtienne, commencée en 1791, a conduit à l'indépendance d'Haïti en 1804. Des personnes réduites en esclavage et des libres de couleur ont combattu le système colonial esclavagiste. Haïti est devenue la première république noire indépendante et le premier État issu d'une révolte d'esclaves victorieuse.",
"q": "Pourquoi cette révolution a-t-elle eu un retentissement mondial ?",
"n": "La liberté proclamée dans les textes devient réelle quand des personnes luttent pour la rendre effective."
},
{
"i": "M4-008",
"c": "Histoire",
"k": "savoir",
"t": "La poste a précédé les messages instantanés de plusieurs siècles",
"s": "Communication",
"x": "Dans plusieurs grands empires, des relais de messagers permettaient de transmettre rapidement des ordres et des nouvelles. Le système de relais de l'empire achéménide perse est notamment décrit par Hérodote. Des cavaliers changeaient de monture à des stations successives, ce qui accélérait le trajet sur de longues distances.",
"q": "Quel était le secret de la rapidité de ce système ?",
"n": "Une bonne organisation peut parfois compter davantage que la vitesse individuelle."
},
{
"i": "M4-009",
"c": "Histoire",
"k": "savoir",
"t": "Le premier ordinateur programmable a été imaginé au XIXe siècle",
"s": "Histoire des sciences",
"x": "Ada Lovelace a rédigé au XIXe siècle des notes sur la machine analytique imaginée par Charles Babbage. Elle y décrit notamment une méthode permettant de calculer des nombres de Bernoulli. Cette contribution est souvent présentée comme un jalon précoce de la programmation informatique, même si la machine n'a pas été construite à son époque.",
"q": "Pourquoi son travail est-il remarquable ?",
"n": "L'innovation commence parfois par imaginer ce qu'une machine pourrait faire avant qu'elle existe."
},
{
"i": "M4-010",
"c": "Histoire",
"k": "savoir",
"t": "Le canal de Suez a raccourci les routes maritimes",
"s": "Commerce mondial",
"x": "Inauguré en 1869, le canal de Suez relie la Méditerranée à la mer Rouge. Il a profondément modifié les routes maritimes entre l'Europe et l'Asie en évitant aux navires de contourner l'Afrique par le cap de Bonne-Espérance. Son histoire est aussi liée aux intérêts impériaux, au travail des ouvriers et aux enjeux de souveraineté.",
"q": "Quel changement géographique a-t-il apporté au commerce maritime ?",
"n": "Une infrastructure peut rapprocher des continents tout en concentrant des enjeux de pouvoir."
},
{
"i": "M4-011",
"c": "Histoire",
"k": "savoir",
"t": "Les cartes de Piri Reis intriguent les historiens",
"s": "Cartographie",
"x": "En 1513, l'amiral et cartographe ottoman Piri Reis a réalisé une carte du monde connue aujourd'hui par un fragment conservé à Istanbul. Elle rassemble des informations issues de plusieurs cartes et récits de navigation. Elle est précieuse pour étudier la circulation des connaissances géographiques au début du XVIe siècle.",
"q": "Que révèle cette carte sur la production du savoir ?",
"n": "Le savoir avance rarement seul : il voyage, se traduit et se corrige."
},
{
"i": "M4-012",
"c": "Histoire",
"k": "savoir",
"t": "La conférence de Bandung a fait entendre une autre voix",
"s": "Relations internationales",
"x": "En avril 1955, des représentants de 29 pays d'Asie et d'Afrique se sont réunis à Bandung, en Indonésie. La conférence a défendu la coopération afro-asiatique, la souveraineté et le refus du colonialisme. Elle a contribué au contexte politique qui mènera au mouvement des non-alignés.",
"q": "Pourquoi Bandung est-elle importante pour les pays nouvellement indépendants ?",
"n": "L'indépendance politique prend aussi forme quand les pays construisent leurs propres espaces de dialogue."
},
{
"i": "M4-014",
"c": "Philosophie",
"k": "savoir",
"t": "Diogène et la question des besoins",
"s": "Cynisme antique",
"x": "Diogène de Sinope est associé à une philosophie qui interroge les conventions sociales et les besoins artificiels. Les anecdotes racontent qu'il cherchait à vivre avec très peu et qu'il provoquait les puissants pour montrer combien les humains dépendent parfois du regard des autres.",
"q": "Quelle question sa manière de vivre nous pose-t-elle ?",
"n": "La simplicité peut être une critique du superflu, pas une obligation de vivre dans le dénuement."
},
{
"i": "M4-015",
"c": "Philosophie",
"k": "savoir",
"t": "Ibn Khaldûn : comprendre les sociétés par leurs mécanismes",
"s": "Pensée sociale",
"x": "Au XIVe siècle, le penseur maghrébin Ibn Khaldûn a proposé une analyse des sociétés, des pouvoirs et des dynasties. Dans sa Muqaddima, il étudie notamment l'ʿasabiyya, une forme de solidarité de groupe qui peut soutenir l'émergence d'un pouvoir politique.",
"q": "Pourquoi son approche est-elle importante ?",
"n": "Comprendre une société exige d'observer ses liens, ses ressources et ses institutions."
},
{
"i": "M4-016",
"c": "Philosophie",
"k": "savoir",
"t": "Amartya Sen : la liberté, c'est aussi avoir des possibilités",
"s": "Justice et développement",
"x": "L'économiste et philosophe Amartya Sen propose d'évaluer le développement à partir des capabilités : les possibilités réelles dont disposent les personnes pour mener la vie qu'elles ont raison de valoriser. Avoir un droit sur le papier ne suffit pas si les conditions concrètes empêchent de l'exercer.",
"q": "Quelle différence existe entre un droit formel et une possibilité réelle ?",
"n": "La liberté se mesure aussi à ce qu'une personne peut effectivement faire."
},
{
"i": "M4-017",
"c": "Philosophie",
"k": "savoir",
"t": "Hobbes : pourquoi créer un pouvoir commun ?",
"s": "Contrat politique",
"x": "Thomas Hobbes imagine un état de nature dans lequel l'absence d'autorité commune rend la sécurité fragile. Pour sortir de cette situation, les individus acceptent un pouvoir politique capable d'établir des règles et de garantir la paix. Sa théorie soulève une question toujours actuelle : comment concilier sécurité et liberté ?",
"q": "Quel problème le pouvoir politique doit-il résoudre chez Hobbes ?",
"n": "Un pouvoir est institué pour protéger, mais il faut aussi réfléchir aux limites de son autorité."
},
{
"i": "M4-018",
"c": "Philosophie",
"k": "savoir",
"t": "Hume : l'habitude façonne nos attentes",
"s": "Connaissance",
"x": "David Hume remarque que nous attendons souvent qu'un événement se reproduise parce que nous l'avons vu plusieurs fois. Pourtant, observer le soleil se lever chaque matin ne constitue pas une démonstration logique absolue qu'il se lèvera demain. Nos raisonnements quotidiens reposent en partie sur l'habitude et l'induction.",
"q": "Pourquoi cette idée est-elle importante pour la science ?",
"n": "Être rationnel, ce n'est pas être certain de tout : c'est savoir sur quoi repose sa certitude."
},
{
"i": "M4-020",
"c": "Philosophie",
"k": "savoir",
"t": "John Dewey : apprendre en faisant",
"s": "Éducation",
"x": "Le philosophe et pédagogue John Dewey défend une éducation qui relie les idées à l'expérience. L'élève apprend en enquêtant, en expérimentant, en discutant et en réfléchissant aux conséquences de ses actions. L'expérience seule ne suffit toutefois pas : elle doit être analysée.",
"q": "Quelle est la différence entre faire une activité et apprendre de cette activité ?",
"n": "Une erreur devient utile lorsqu'on prend le temps de l'examiner."
},
{
"i": "M4-021",
"c": "Philosophie",
"k": "savoir",
"t": "Édouard Glissant : le droit à l'opacité",
"s": "Identité et différence",
"x": "Le penseur martiniquais Édouard Glissant défend le droit à l'opacité : une personne ou une culture ne devrait pas être obligée de se rendre entièrement transparente aux catégories d'autrui pour être respectée. La relation peut exister sans réduire l'autre à ce que l'on croit déjà comprendre.",
"q": "Que signifie respecter quelqu'un sans tout savoir de lui ?",
"n": "Comprendre l'autre ne signifie pas le posséder par une explication."
},
{
"i": "M4-022",
"c": "Philosophie",
"k": "savoir",
"t": "Mary Midgley : la morale n'est pas un calcul froid",
"s": "Éthique",
"x": "La philosophe Mary Midgley critique l'idée que les questions morales pourraient toujours être résolues par une règle unique ou un calcul isolé. Nos décisions s'inscrivent dans des relations, des responsabilités et des formes de vie partagées.",
"q": "Pourquoi le contexte compte-t-il dans un jugement moral ?",
"n": "Une règle est utile, mais elle ne dispense pas de penser."
},
{
"i": "M4-023",
"c": "Philosophie",
"k": "savoir",
"t": "La désobéissance civile : enfreindre une règle pour défendre un principe",
"s": "Démocratie",
"x": "La désobéissance civile désigne une violation publique, généralement non violente et assumée, d'une règle jugée injuste, dans le but de faire évoluer la loi ou l'opinion. Les formes historiques varient, et toutes les infractions à la loi ne sont pas de la désobéissance civile.",
"q": "Qu'est-ce qui distingue la désobéissance civile d'un simple intérêt personnel ?",
"n": "La conscience politique implique de réfléchir à la justice des règles et aux moyens de les contester."
},
{
"i": "M4-024",
"c": "Philosophie",
"k": "savoir",
"t": "La charge de la preuve : qui affirme doit justifier",
"s": "Argumentation",
"x": "Dans un débat, celui qui avance une affirmation doit apporter des raisons ou des éléments pour la soutenir. Demander à son interlocuteur de prouver que l'affirmation est fausse ne suffit pas à rendre celle-ci vraie. C'est le principe général de la charge de la preuve.",
"q": "Si quelqu'un affirme qu'un médicament guérit toutes les maladies, qui doit fournir les preuves ?",
"n": "Une affirmation répétée avec assurance n'est pas une démonstration."
},
{
"i": "M4-025",
"c": "Mythologie",
"k": "savoir",
"t": "Mulan, la guerrière qui prend la place de son père",
"s": "Tradition chinoise",
"x": "Dans la Ballade de Mulan, poème chinois transmis depuis des siècles, une jeune femme prend la place de son père âgé dans l'armée. Les versions et adaptations ultérieures diffèrent, mais le récit interroge le devoir familial, le courage et les rôles assignés aux femmes.",
"q": "Quel conflit traverse le récit de Mulan ?",
"n": "Les légendes changent avec les générations, parce que chaque époque y reconnaît de nouvelles questions."
},
{
"i": "M4-026",
"c": "Mythologie",
"k": "savoir",
"t": "Gilgamesh et la peur de perdre",
"s": "Épopée mésopotamienne",
"x": "Dans l'Épopée de Gilgamesh, le roi d'Uruk affronte la mort de son ami Enkidu. Bouleversé, il part à la recherche d'un moyen d'échapper à la mort. Son voyage le conduit finalement à comprendre les limites de la condition humaine et la valeur de ce que l'on construit.",
"q": "Qu'est-ce que Gilgamesh découvre au cours de sa quête ?",
"n": "La conscience de nos limites peut nous pousser à mieux vivre, plutôt qu'à renoncer."
},
{
"i": "M4-027",
"c": "Mythologie",
"k": "savoir",
"t": "Maui ralentit le soleil",
"s": "Traditions polynésiennes",
"x": "Dans plusieurs traditions polynésiennes, le héros culturel Māui accomplit des exploits pour aider les humains. Un récit raconte qu'il capture le soleil afin de ralentir sa course et de donner davantage de temps aux activités quotidiennes. Les versions varient selon les îles et les peuples.",
"q": "Quel besoin humain explique ce récit ?",
"n": "Les mythes racontent aussi, à leur manière, les problèmes très concrets des sociétés."
},
{
"i": "M4-028",
"c": "Mythologie",
"k": "savoir",
"t": "Mwindo, le héros de l'épopée nyanga",
"s": "Une grande tradition orale de l'est du Congo",
"x": "L'Épopée de Mwindo est un récit héroïque transmis par les Nyanga de l'est de l'actuelle République démocratique du Congo. Mwindo, dont la naissance est extraordinaire dans le récit, traverse des épreuves, affronte des adversaires et entreprend un voyage dans le monde souterrain. L'histoire met en scène le pouvoir, la parole, les conflits familiaux et la nécessité de rétablir un équilibre.",
"q": "Pourquoi est-il important de préserver les épopées transmises oralement ?",
"n": "Une tradition orale est une bibliothèque vivante : elle transmet des valeurs, une mémoire et une vision du monde."
},
{
"i": "M4-029",
"c": "Mythologie",
"k": "savoir",
"t": "La légende de Sedna, maîtresse des animaux marins",
"s": "Traditions inuit",
"x": "Dans plusieurs traditions inuit, Sedna est associée aux animaux marins et à l'équilibre entre les humains et le monde vivant. Les récits racontent différentes versions de sa transformation en puissance de la mer. Ils sont liés à des pratiques, des valeurs et des territoires précis.",
"q": "Pourquoi faut-il éviter de raconter Sedna comme un simple personnage fantastique ?",
"n": "Raconter une tradition demande du respect pour les communautés qui la portent."
},
{
"i": "M4-030",
"c": "Mythologie",
"k": "savoir",
"t": "La légende d'Arthur et l'épée dans la pierre",
"s": "Traditions médiévales",
"x": "Dans certaines versions médiévales de la légende arthurienne, le jeune Arthur prouve sa légitimité en retirant une épée enchâssée dans une pierre ou une enclume. Les récits arthuriens ont évolué au fil des auteurs et des siècles : il n'existe pas une version unique et originelle de tous les épisodes.",
"q": "Que symbolise l'épreuve de l'épée ?",
"n": "Une histoire célèbre peut avoir plusieurs versions sans perdre sa force symbolique."
},
{
"i": "M4-031",
"c": "Mythologie",
"k": "savoir",
"t": "La déesse Amaterasu n'est pas seule à porter le soleil",
"s": "Récits comparés",
"x": "Dans les traditions du monde, le soleil peut être associé à une divinité, à un héros ou à un cycle naturel. Dans la mythologie japonaise, Amaterasu est une figure solaire majeure ; dans d'autres traditions, le soleil est masculin, féminin ou personnifié autrement. Ces différences montrent la diversité des imaginaires.",
"q": "Que nous apprend la comparaison des récits solaires ?",
"n": "La comparaison des mythes aide à découvrir les cultures sans les confondre."
},
{
"i": "M4-032",
"c": "Mythologie",
"k": "savoir",
"t": "La légende de Nyami Nyami et le fleuve Zambèze",
"s": "Tradition tonga",
"x": "Dans les récits du peuple tonga vivant autour du Zambèze, Nyami Nyami est souvent décrit comme un esprit ou une créature protectrice du fleuve. Les récits modernes l'associent parfois aux bouleversements provoqués par la construction du barrage de Kariba. Les versions sont diverses et appartiennent à une tradition vivante.",
"q": "Pourquoi le fleuve occupe-t-il une place centrale dans ce récit ?",
"n": "Un paysage n'est jamais seulement un décor : il peut être au cœur de la mémoire d'un peuple."
},
{
"i": "M4-033",
"c": "Mythologie",
"k": "savoir",
"t": "La légende de Momotaro, l'enfant né d'une pêche",
"s": "Folklore japonais",
"x": "Dans un conte populaire japonais, un couple âgé découvre un enfant dans une énorme pêche descendue le long d'une rivière. Ils l'élèvent et l'appellent Momotarō. Devenu grand, il part combattre des ogres avec l'aide d'animaux qu'il rencontre en chemin.",
"q": "Qu'est-ce qui rend Momotarō plus fort dans son aventure ?",
"n": "Le héros n'est pas toujours celui qui agit seul : il sait aussi construire une équipe."
},
{
"i": "M4-034",
"c": "Mythologie",
"k": "savoir",
"t": "La légende de la fondation de Rome et les jumeaux",
"s": "Mythologie romaine",
"x": "Le récit traditionnel de la fondation de Rome raconte que Romulus et Rémus, jumeaux abandonnés, sont nourris par une louve puis élevés par un berger. Devenus adultes, ils veulent fonder une ville, mais un conflit les oppose. Romulus devient le fondateur légendaire de Rome.",
"q": "Pourquoi ce récit est-il une légende plutôt qu'un compte rendu historique ?",
"n": "Les sociétés racontent leurs origines pour exprimer ce qu'elles pensent être leur identité."
},
{
"i": "M4-035",
"c": "Mythologie",
"k": "savoir",
"t": "Le roi singe Sun Wukong défie le ciel",
"s": "Littérature chinoise",
"x": "Sun Wukong, le Roi des Singes, est le personnage central du roman chinois classique Le Voyage en Occident. Doté d'une force et de pouvoirs extraordinaires, il défie l'autorité céleste avant d'être contraint d'apprendre la maîtrise de lui-même au cours de son parcours.",
"q": "Quelle faiblesse accompagne les pouvoirs de Sun Wukong ?",
"n": "Le talent devient plus puissant lorsqu'il s'accompagne de maîtrise de soi."
},
{
"i": "M4-036",
"c": "Mythologie",
"k": "savoir",
"t": "La légende de la femme-serpent dans les récits d'Asie",
"s": "Métamorphoses",
"x": "Plusieurs traditions d'Asie de l'Est racontent des histoires de serpents capables de prendre forme humaine. La Légende du serpent blanc, très connue en Chine, raconte un amour entre une femme-serpent et un humain, confronté à la peur, aux interdits et aux préjugés.",
"q": "Quel thème humain se cache derrière la métamorphose ?",
"n": "Les récits fantastiques parlent souvent de nos réactions face à la différence."
},
{
"i": "M4-037",
"c": "Énigmes",
"k": "enigme",
"t": "Les chaussettes dans le noir",
"s": "Probabilités simples",
"x": "Dans un tiroir, il y a 10 chaussettes noires et 10 chaussettes blanches, toutes mélangées. Tu prends des chaussettes sans regarder. Combien dois-tu en prendre au minimum pour être certain d'avoir une paire de même couleur ?",
"q": "Quelle est la réponse minimale ?",
"a": "3 chaussettes. Avec seulement deux, tu peux avoir une noire et une blanche. La troisième sera forcément de l'une de ces deux couleurs et formera une paire.",
"n": "Le raisonnement par le pire cas permet souvent de trouver une certitude."
},
{
"i": "M4-038",
"c": "Énigmes",
"k": "enigme",
"t": "Le pont et la lampe",
"s": "Optimisation",
"x": "Quatre étudiants doivent traverser un pont de nuit. Ils mettent respectivement 1, 2, 7 et 10 minutes. Ils n'ont qu'une lampe, et au maximum deux personnes peuvent traverser ensemble. La lampe doit toujours être transportée. Quand deux traversent, ils avancent à la vitesse du plus lent. Quel est le temps minimal pour faire passer tout le monde ?",
"q": "Trouve une stratégie et son temps total.",
"a": "17 minutes : 1 et 2 traversent (2), 1 revient (1), 7 et 10 traversent (10), 2 revient (2), puis 1 et 2 traversent (2). Total : 17.",
"n": "La meilleure stratégie n'est pas forcément de faire traverser les plus rapides avec chaque personne."
},
{
"i": "M4-039",
"c": "Énigmes",
"k": "enigme",
"t": "Les deux cordes irrégulières",
"s": "Mesure du temps",
"x": "Tu as deux cordes. Chacune met exactement 60 minutes à brûler entièrement, mais elles ne brûlent pas à vitesse régulière. Tu as un briquet. Comment mesurer exactement 45 minutes ?",
"q": "Quelle combinaison d'allumage permet de mesurer 45 minutes ?",
"a": "Allume la première corde aux deux bouts et la seconde à un seul bout. La première finit en 30 minutes. À cet instant, allume l'autre bout de la seconde corde : ce qui lui reste brûlera en 15 minutes. Total : 45 minutes.",
"n": "Une durée totale connue ne signifie pas que chaque moitié de corde brûle en un temps égal."
},
{
"i": "M4-040",
"c": "Énigmes",
"k": "enigme",
"t": "Le nombre à deux chiffres",
"s": "Algèbre",
"x": "Je suis un nombre à deux chiffres. La somme de mes chiffres vaut 9. Si tu inverses mes chiffres, le nouveau nombre est inférieur de 27 au nombre de départ. Quel est ce nombre ?",
"q": "Quel nombre satisfait les deux conditions ?",
"a": "63. La somme 6 + 3 = 9 et 63 - 36 = 27.",
"n": "Traduire les mots en équations rend le problème plus simple."
},
{
"i": "M4-041",
"c": "Énigmes",
"k": "enigme",
"t": "Les trois boîtes mal étiquetées",
"s": "Déduction",
"x": "Trois boîtes portent les étiquettes « Pommes », « Oranges » et « Mélange ». Toutes les étiquettes sont fausses. Tu peux prendre un seul fruit dans une seule boîte, sans regarder à l'intérieur. Comment retrouver le contenu des trois boîtes ?",
"q": "Dans quelle boîte faut-il piocher ?",
"a": "Dans la boîte étiquetée « Mélange ». Puisque toutes les étiquettes sont fausses, elle ne contient pas un mélange. Le fruit tiré révèle son contenu, puis les deux autres boîtes se déduisent par élimination.",
"n": "Commencer par l'information la plus contraignante réduit les possibilités."
},
{
"i": "M4-042",
"c": "Énigmes",
"k": "enigme",
"t": "Le gardien et les deux portes",
"s": "Logique conditionnelle",
"x": "Deux portes : l'une mène à la sortie, l'autre à une impasse. Deux gardiens : l'un dit toujours la vérité, l'autre ment toujours. Tu ne sais pas qui est qui et tu peux poser une seule question à un seul gardien. Quelle question te permet de choisir la bonne porte ?",
"q": "Quelle question faut-il poser ?",
"a": "« Si je demandais à l'autre gardien quelle porte mène à la sortie, laquelle me montrerait-il ? » Il indiquera la mauvaise porte, donc il faut choisir l'autre.",
"n": "La logique peut contourner l'incertitude en construisant une question qui neutralise le mensonge."
},
{
"i": "M4-043",
"c": "Énigmes",
"k": "enigme",
"t": "La suite des carrés",
"s": "Suites numériques",
"x": "Observe cette suite : 1, 4, 9, 16, 25, ... Quel est le prochain nombre ?",
"q": "Quel nombre vient ensuite et pourquoi ?",
"a": "36 : ce sont les carrés successifs 1², 2², 3², 4², 5², puis 6².",
"n": "Cherche une règle simple avant d'inventer une suite compliquée."
},
{
"i": "M4-044",
"c": "Énigmes",
"k": "enigme",
"t": "Le calendrier impossible ?",
"s": "Calcul",
"x": "Si aujourd'hui nous sommes mardi, quel jour serons-nous dans 100 jours ?",
"q": "Quel est le jour exact ?",
"a": "Jeudi. 100 jours correspondent à 14 semaines et 2 jours ; mardi + 2 jours = jeudi.",
"n": "Pour les problèmes cycliques, commence par retirer les cycles complets."
},
{
"i": "M4-045",
"c": "Énigmes",
"k": "enigme",
"t": "Les neuf points",
"s": "Pensée latérale",
"x": "Dessine neuf points en carré, trois lignes de trois points. Le défi classique consiste à relier les neuf points avec quatre segments droits continus, sans lever le crayon. Quelle idée faut-il abandonner pour réussir ?",
"q": "Quelle hypothèse limite inutilement la solution ?",
"a": "L'idée que les traits doivent rester à l'intérieur du carré formé par les points. Il faut prolonger les lignes au-delà de cette frontière imaginaire.",
"n": "Certaines limites sont dans notre représentation du problème, pas dans le problème lui-même."
},
{
"i": "M4-046",
"c": "Énigmes",
"k": "enigme",
"t": "Les deux sabliers",
"s": "Mesure",
"x": "Tu disposes d'un sablier de 7 minutes et d'un autre de 11 minutes. Comment mesurer exactement 15 minutes à partir du moment où tu les retournes ensemble ?",
"q": "Décris une méthode possible.",
"a": "À 7 minutes, retourne le sablier de 7 minutes. À 11 minutes, le sablier de 11 minutes est vide : dans le petit, 4 minutes de sable sont déjà tombées (il en reste 3 en haut). Retourne-le alors : les 4 minutes écoulées repartent dans l'autre sens, il se videra donc 4 minutes plus tard, à 15 minutes.",
"n": "Suivre les écarts entre deux horloges imparfaites peut créer une mesure exacte."
},
{
"i": "M4-047",
"c": "Énigmes",
"k": "enigme",
"t": "Le code à trois chiffres",
"s": "Déduction",
"x": "Un code comporte trois chiffres distincts. Indices : 682 : un chiffre est correct et bien placé. 614 : un chiffre est correct mais mal placé. 206 : deux chiffres sont corrects mais mal placés. 738 : aucun chiffre n'est correct. 780 : un chiffre est correct mais mal placé. Quel est le code ?",
"q": "Peux-tu déduire le code ?",
"a": "042. Le 7, 3 et 8 sont exclus. Dans 780, seul le 0 est correct mais mal placé. Dans 206, le 0 et le 2 sont corrects mais mal placés. Les indices 682 et 614 permettent ensuite de fixer 4 en deuxième position et 2 en troisième ; le 0 est en première position.",
"n": "Chaque indice élimine des possibilités : ne cherche pas à deviner, procède par contraintes."
},
{
"i": "M4-048",
"c": "Énigmes",
"k": "enigme",
"t": "Le partage des pommes",
"s": "Problème de répartition",
"x": "Tu dois partager 17 pommes entre trois personnes : la première reçoit la moitié, la deuxième un tiers et la troisième un neuvième. Tu ne peux pas couper les pommes. Comment respecter exactement les fractions annoncées ?",
"q": "Quelle astuce permet de résoudre le problème ?",
"a": "En ajoutant temporairement une 18e pomme, on obtient 9, 6 et 2 pommes, soit 17 au total. La pomme ajoutée est ensuite retirée. Cette astuce fonctionne parce que 9 + 6 + 2 = 17.",
"n": "Une aide temporaire peut débloquer un partage, mais il faut vérifier que les conditions mathématiques sont réellement respectées."
},
{
"i": "M4-050",
"c": "Humour étudiant",
"k": "humour",
"t": "Le camarade qui a tout compris",
"s": "La vie étudiante, sans filtre",
"x": "Dans le groupe, quelqu'un écrit : « J'ai tout compris ». Tout le monde se détend. Deux minutes après, il demande : « On commence par quel chapitre ? »",
"q": "Ça t'est déjà arrivé ?",
"n": "La confiance est parfois un excellent camouflage."
},
{
"i": "M4-051",
"c": "Humour étudiant",
"k": "humour",
"t": "La photocopie fantôme",
"s": "La vie étudiante, sans filtre",
"x": "Tu arrives à la faculté avec la ferme intention de lire le syllabus. Tu demandes au voisin : « Tu as le document ? » Il répond : « Oui, je cherche quelqu'un qui l'a. »",
"q": "Ça t'est déjà arrivé ?",
"n": "La ressource existe peut-être dans une autre dimension."
},
{
"i": "M4-052",
"c": "Humour étudiant",
"k": "humour",
"t": "Le fameux petit devoir",
"s": "La vie étudiante, sans filtre",
"x": "Le chargé de cours dit : « C'est un petit travail de deux pages. » Tu ouvres les consignes : introduction, contexte, problématique, hypothèses, méthodologie, analyse, conclusion et bibliographie.",
"q": "Ça t'est déjà arrivé ?",
"n": "Deux pages, mais une carrière académique complète."
},
{
"i": "M4-053",
"c": "Humour étudiant",
"k": "humour",
"t": "Le téléphone silencieux",
"s": "La vie étudiante, sans filtre",
"x": "Tu mets ton téléphone en mode silencieux pour étudier. Il ne sonne plus, mais ton cerveau, lui, produit 48 notifications : manger, vérifier l'heure, penser à demain, regarder le plafond.",
"q": "Ça t'est déjà arrivé ?",
"n": "Le mode concentration doit parfois être installé dans la tête."
},
{
"i": "M4-055",
"c": "Humour étudiant",
"k": "humour",
"t": "La révision stratégique",
"s": "La vie étudiante, sans filtre",
"x": "Tu écris sur une feuille : « Réviser chapitre 1 ». Tu passes 25 minutes à choisir la couleur du titre, 15 minutes à ranger les stylos et 5 minutes à lire le chapitre.",
"q": "Ça t'est déjà arrivé ?",
"n": "La préparation est importante. Mais elle ne remplace pas le travail."
},
{
"i": "M4-057",
"c": "Humour étudiant",
"k": "humour",
"t": "Le débat du groupe",
"s": "La vie étudiante, sans filtre",
"x": "Le groupe de travail passe 40 minutes à choisir le nom du fichier, 20 minutes à discuter de la police et 3 minutes à répartir les recherches.",
"q": "Ça t'est déjà arrivé ?",
"n": "La mise en page est collective ; le contenu reste mystérieusement individuel."
},
{
"i": "M4-058",
"c": "Humour étudiant",
"k": "humour",
"t": "Le dictionnaire du stress",
"s": "La vie étudiante, sans filtre",
"x": "Avant l'examen, un étudiant dit : « Je suis prêt. » Son pied tremble, sa main tremble, sa voix tremble. Mais son discours, lui, est parfaitement confiant.",
"q": "Ça t'est déjà arrivé ?",
"n": "Le corps a parfois lu le programme avant nous."
},
{
"i": "M4-059",
"c": "Humour étudiant",
"k": "humour",
"t": "Le cours enregistré",
"s": "La vie étudiante, sans filtre",
"x": "Tu enregistres le cours pour le réécouter tranquillement. Trois semaines plus tard, tu retrouves un fichier de 2 h 17 nommé « Audio 14 ». Même toi, tu ne sais plus quelle matière c'est.",
"q": "Ça t'est déjà arrivé ?",
"n": "Enregistrer n'est que la première étape : il faut aussi retrouver et exploiter."
},
{
"i": "M4-060",
"c": "Humour étudiant",
"k": "humour",
"t": "La bibliothèque et la faim",
"s": "La vie étudiante, sans filtre",
"x": "Tu entres à la bibliothèque pour trois heures de concentration. Après douze minutes, tu découvres que ton estomac a convoqué une réunion extraordinaire.",
"q": "Ça t'est déjà arrivé ?",
"n": "La concentration aime aussi les pauses bien organisées."
},
{
"i": "M4-061",
"c": "Motivation",
"k": "savoir",
"t": "Le premier brouillon a le droit d'être mauvais",
"s": "Une idée à garder pour tes études",
"x": "Un premier brouillon sert à faire apparaître les idées, pas à prouver que tu maîtrises déjà parfaitement le sujet. Tu peux améliorer une phrase existante ; tu ne peux pas corriger une page qui reste dans ta tête.",
"q": "Quelle petite partie peux-tu écrire maintenant ?",
"n": "Commencer imparfaitement vaut souvent mieux qu'attendre une inspiration parfaite."
},
{
"i": "M4-062",
"c": "Motivation",
"k": "savoir",
"t": "La régularité a besoin d'un plan réaliste",
"s": "Une idée à garder pour tes études",
"x": "Un programme de révision qui prévoit six heures chaque soir peut sembler impressionnant. S'il est impossible à tenir, il devient une source de culpabilité. Un rythme plus modeste mais régulier peut produire de meilleurs résultats.",
"q": "Ton programme actuel peut-il survivre à une journée difficile ?",
"n": "Un bon plan n'est pas celui qui impressionne : c'est celui que tu peux réellement suivre."
},
{
"i": "M4-064",
"c": "Motivation",
"k": "savoir",
"t": "La mémoire aime les rappels espacés",
"s": "Une idée à garder pour tes études",
"x": "Relire plusieurs fois une page donne parfois une impression de maîtrise. Mais essayer de retrouver l'information sans regarder, puis revenir dessus après un délai, aide à renforcer la mémorisation.",
"q": "Peux-tu fermer ton cours et expliquer l'idée principale de mémoire ?",
"n": "Se tester est souvent plus instructif que relire passivement."
},
{
"i": "M4-065",
"c": "Motivation",
"k": "savoir",
"t": "Une mauvaise note n'est pas un verdict",
"s": "Une idée à garder pour tes études",
"x": "Une note mesure une performance dans certaines conditions, à un moment donné. Elle peut révéler une lacune ou une méthode à revoir, mais elle ne résume ni toute ton intelligence ni ton avenir.",
"q": "Quelle information concrète peux-tu tirer de ton dernier résultat ?",
"n": "Transforme le résultat en diagnostic, pas en identité."
},
{
"i": "M4-066",
"c": "Motivation",
"k": "savoir",
"t": "Protège ton attention comme une ressource",
"s": "Une idée à garder pour tes études",
"x": "Chaque interruption oblige à retrouver le fil de ce que tu faisais. Avant une séance, éloigne les distractions les plus tentantes et définis une tâche précise, même petite.",
"q": "Quelle distraction peux-tu retirer pendant 20 minutes ?",
"n": "L'attention se protège mieux avec un environnement qu'avec la seule volonté."
},
{
"i": "M4-068",
"c": "Motivation",
"k": "savoir",
"t": "Explique pour vérifier que tu comprends",
"s": "Une idée à garder pour tes études",
"x": "Après avoir étudié un concept, essaie de l'expliquer avec tes propres mots à une personne qui ne connaît pas le sujet. Les endroits où tu hésites révèlent ce qu'il faut approfondir.",
"q": "Peux-tu expliquer ton dernier cours en trois phrases simples ?",
"n": "Comprendre, c'est pouvoir reformuler sans simplement réciter."
},
{
"i": "M4-069",
"c": "Motivation",
"k": "savoir",
"t": "Le progrès n'est pas toujours spectaculaire",
"s": "Une idée à garder pour tes études",
"x": "Parfois, le progrès consiste à comprendre une définition, à corriger une erreur récurrente ou à poser une question que tu n'osais pas poser. Ces petites avancées préparent les grandes.",
"q": "Quel petit progrès as-tu fait cette semaine ?",
"n": "Ne méprise pas les étapes qui ne font pas de bruit."
},
{
"i": "M4-070",
"c": "Motivation",
"k": "savoir",
"t": "Choisis une priorité avant d'ouvrir ton cahier",
"s": "Une idée à garder pour tes études",
"x": "Quand tout semble urgent, commence par identifier la tâche qui aura le plus d'effet sur ton prochain cours ou examen. Une priorité claire réduit la dispersion.",
"q": "Quelle tâche mérite vraiment la première place aujourd'hui ?",
"n": "Faire moins de choses, mais les faire avec intention, peut être une stratégie."
},
{
"i": "M4-072",
"c": "Motivation",
"k": "savoir",
"t": "Le courage peut être une action minuscule",
"s": "Une idée à garder pour tes études",
"x": "Tu n'as pas besoin de résoudre tout ton semestre aujourd'hui. Ouvrir le document, relire une page ou demander le plan du cours peut suffire à relancer le mouvement.",
"q": "Quelle action de cinq minutes peux-tu faire maintenant ?",
"n": "Le mouvement commence parfois par une décision très petite."
},
{
"i": "M4-073",
"c": "Amour et relations",
"k": "savoir",
"t": "L'intérêt doit se voir dans la réciprocité",
"s": "Une relation saine se construit à deux",
"x": "Une relation ne devrait pas reposer sur une seule personne qui écrit, propose, s'excuse et fait tous les efforts. La réciprocité ne signifie pas compter chaque geste, mais sentir que chacun contribue librement au lien.",
"q": "Dans cette relation, chacun a-t-il la place de faire un pas ?",
"n": "L'affection ne devrait pas être une course où une seule personne court."
},
{
"i": "M4-074",
"c": "Amour et relations",
"k": "savoir",
"t": "Une limite n'est pas une punition",
"s": "Une relation saine se construit à deux",
"x": "Dire « je ne suis pas à l'aise avec cela » ou « j'ai besoin de temps » permet d'exprimer ses limites. Une relation saine ne demande pas de renoncer à sa sécurité ou à sa dignité pour prouver son amour.",
"q": "Quelle limite importante mériterait d'être exprimée clairement ?",
"n": "Une limite bien formulée protège la relation autant que la personne."
},
{
"i": "M4-075",
"c": "Amour et relations",
"k": "savoir",
"t": "L'écoute n'est pas attendre son tour",
"s": "Une relation saine se construit à deux",
"x": "Écouter quelqu'un, c'est chercher à comprendre ce qu'il ressent avant de préparer sa défense. On peut ne pas être d'accord et reconnaître malgré tout que son expérience mérite d'être entendue.",
"q": "Peux-tu reformuler ce que l'autre ressent avant de répondre ?",
"n": "Se sentir entendu ne signifie pas forcément obtenir ce que l'on demande."
},
{
"i": "M4-076",
"c": "Amour et relations",
"k": "savoir",
"t": "La confiance ne se construit pas par surveillance",
"s": "Une relation saine se construit à deux",
"x": "Exiger les mots de passe, contrôler les déplacements ou inspecter constamment le téléphone ne crée pas une confiance durable. La confiance se nourrit de cohérence, de dialogue et de respect mutuel.",
"q": "Quel comportement nourrit réellement la confiance ?",
"n": "La sécurité affective ne devrait pas dépendre d'un contrôle permanent."
},
{
"i": "M4-077",
"c": "Amour et relations",
"k": "savoir",
"t": "Un désaccord n'autorise pas l'humiliation",
"s": "Une relation saine se construit à deux",
"x": "Dans une dispute, critiquer un comportement précis est différent d'insulter, de rabaisser ou de menacer la personne. La manière de se disputer compte autant que le sujet du désaccord.",
"q": "Comment exprimer un reproche sans attaquer la personne ?",
"n": "On peut être ferme sur un problème sans être cruel envers quelqu'un."
},
{
"i": "M4-078",
"c": "Amour et relations",
"k": "savoir",
"t": "L'amour ne demande pas d'abandonner ses projets",
"s": "Une relation saine se construit à deux",
"x": "Une relation peut soutenir les ambitions de chacun au lieu de les opposer. Les études, les amitiés, les passions et le temps personnel restent importants, même lorsqu'on est amoureux.",
"q": "Cette relation laisse-t-elle de la place à tes objectifs personnels ?",
"n": "Aimer quelqu'un ne devrait pas rétrécir toute ta vie autour d'une seule personne."
},
{
"i": "M4-081",
"c": "Amour et relations",
"k": "savoir",
"t": "L'amitié mérite aussi de l'attention",
"s": "Une relation saine se construit à deux",
"x": "On célèbre souvent les relations amoureuses en oubliant les amis qui écoutent, encouragent et restent présents. Une amitié solide demande elle aussi du temps, de la loyauté et des conversations honnêtes.",
"q": "À quel ami pourrais-tu envoyer un message sincère aujourd'hui ?",
"n": "Prendre soin de ses amitiés, c'est aussi prendre soin de soi."
},
{
"i": "M4-082",
"c": "Amour et relations",
"k": "savoir",
"t": "Ne confonds pas intensité et stabilité",
"s": "Une relation saine se construit à deux",
"x": "Une relation très intense peut être pleine de hauts et de bas. La stabilité, elle, se construit dans la cohérence, la sécurité, le respect et la capacité à parler des difficultés sans peur.",
"q": "Te sens-tu libre d'être toi-même dans cette relation ?",
"n": "Le calme et le respect peuvent être des signes d'amour, pas un manque de passion."
},
{
"i": "M4-083",
"c": "Amour et relations",
"k": "savoir",
"t": "Tu peux apprécier quelqu'un sans lui devoir une relation",
"s": "Une relation saine se construit à deux",
"x": "Recevoir de l'attention ou de la gentillesse ne crée pas une dette amoureuse. Chacun reste libre d'accepter ou de refuser une relation sans être culpabilisé.",
"q": "Pourquoi la gratitude ne doit-elle pas devenir une obligation sentimentale ?",
"n": "La liberté de dire non protège l'authenticité du oui."
},
{
"i": "M4-084",
"c": "Amour et relations",
"k": "savoir",
"t": "La distance demande des accords clairs",
"s": "Une relation saine se construit à deux",
"x": "Quand deux personnes vivent loin l'une de l'autre, elles peuvent avoir des attentes différentes sur les appels, les visites et la disponibilité. Parler de ces attentes évite de transformer chaque silence en accusation.",
"q": "Quel accord simple rendrait la communication plus sereine ?",
"n": "La distance se gère mieux avec des attentes discutées qu'avec des suppositions."
},
{
"i": "M5-003",
"c": "Histoire",
"k": "savoir",
"t": "Koush et Méroé, une puissance du Nil",
"x": "Le royaume de Koush, dans l'actuel Soudan, a connu plusieurs périodes de puissance. À Méroé, on retrouve des traces d'artisanat, de métallurgie du fer, d'écriture méroïtique et de pouvoir royal.",
"q": "Où se situait le royaume de Koush ?",
"a": "Dans la vallée du Nil, principalement dans l’actuel Soudan, au sud de l’Égypte.",
"n": "L’histoire africaine ne se limite pas aux frontières actuelles."
},
{
"i": "M5-005",
"c": "Histoire",
"k": "savoir",
"t": "Le traité qui a redessiné l’Europe",
"x": "Le traité de Westphalie, signé en 1648, met fin à plusieurs conflits européens, dont la guerre de Trente Ans dans le Saint-Empire. Il est souvent associé à l’évolution de la diplomatie entre États, même si l’idée moderne de souveraineté s’est construite progressivement.",
"q": "En quelle année les traités de Westphalie ont-ils été signés ?",
"a": "En 1648.",
"n": "Les grands changements politiques sont rarement l’œuvre d’un seul document."
},
{
"i": "M5-006",
"c": "Histoire",
"k": "savoir",
"t": "La première femme à recevoir un Nobel",
"x": "Marie Curie a reçu le prix Nobel de physique en 1903 avec Pierre Curie et Henri Becquerel, puis le Nobel de chimie en 1911. Elle est la première femme récompensée par un Nobel et la première personne à en recevoir dans deux disciplines scientifiques différentes.",
"q": "Dans quelles disciplines Marie Curie a-t-elle reçu ses deux prix ?",
"a": "En physique en 1903 et en chimie en 1911.",
"n": "La persévérance scientifique peut ouvrir des chemins que personne n’avait encore empruntés."
},
{
"i": "M5-007",
"c": "Histoire",
"k": "savoir",
"t": "Les Douze Tables : des lois enfin visibles",
"x": "Le droit romain s’est développé pendant des siècles. La Loi des Douze Tables, traditionnellement datée du milieu du Ve siècle avant notre ère, a rendu publiques certaines règles juridiques de la jeune République romaine.",
"q": "Pourquoi la publication des règles était-elle importante ?",
"a": "Elle limitait le monopole des connaissances juridiques détenues par les élites et rendait les règles plus accessibles aux citoyens.",
"n": "Rendre les règles visibles est une étape importante vers une justice plus prévisible."
},
{
"i": "M5-010",
"c": "Histoire",
"k": "savoir",
"t": "Le premier tour du monde n’a pas été achevé par Magellan",
"x": "L’expédition partie en 1519 sous le commandement de Fernand de Magellan a réalisé la première circumnavigation connue. Magellan est mort aux Philippines en 1521 ; Juan Sebastián Elcano a ensuite conduit le navire Victoria jusqu’en Espagne en 1522.",
"q": "Qui a ramené le Victoria en Espagne ?",
"a": "Juan Sebastián Elcano, après la mort de Magellan.",
"n": "Une grande aventure collective ne se résume pas toujours au nom de son premier chef."
},
{
"i": "M5-013",
"c": "Philosophie",
"k": "savoir",
"t": "La justice doit-elle traiter tout le monde pareil ?",
"x": "Aristote distingue différentes formes de justice. La justice distributive consiste notamment à répartir certains biens ou avantages selon un critère pertinent, et pas nécessairement en donnant exactement la même chose à chacun.",
"q": "L’égalité signifie-t-elle toujours donner la même chose à tous ?",
"a": "Non. Selon le contexte, une répartition juste peut tenir compte de différences pertinentes entre les situations.",
"n": "L’équité demande parfois de regarder les situations, pas seulement les quantités."
},
{
"i": "M5-016",
"c": "Philosophie",
"k": "savoir",
"t": "L’expérience avant les idées",
"x": "John Locke défend l’idée que les connaissances humaines proviennent de l’expérience, par la sensation et la réflexion. Il critique l’idée que l’esprit possède dès la naissance un ensemble d’idées innées toutes faites.",
"q": "D’où viennent les idées selon Locke ?",
"a": "De l’expérience, notamment des sensations et de la réflexion sur ce que nous vivons.",
"n": "Apprendre, c’est aussi observer, expérimenter et réfléchir à ce que l’on observe."
},
{
"i": "M5-017",
"c": "Philosophie",
"k": "savoir",
"t": "Le principe de non-violence",
"x": "Mahatma Gandhi a fait de la résistance non violente un principe majeur de son action politique. La satyagraha désigne une forme de lutte fondée sur la force de la vérité et le refus de la violence.",
"q": "La non-violence signifie-t-elle rester passif ?",
"a": "Non. Elle peut prendre la forme d’une action collective, d’une désobéissance civile et d’une résistance organisée.",
"n": "Refuser la violence n’oblige pas à accepter l’injustice."
},
{
"i": "M5-018",
"c": "Philosophie",
"k": "savoir",
"t": "Penser avec les autres",
"x": "Hannah Arendt analyse la vie politique comme un espace où les êtres humains agissent et parlent ensemble. La pluralité — le fait que nous soyons différents — est une condition importante de la vie publique.",
"q": "Pourquoi la pluralité compte-t-elle en politique ?",
"a": "Parce que le monde commun existe entre des personnes différentes qui peuvent parler et agir ensemble.",
"n": "Le débat n’est pas un obstacle à la vie commune : il en est une condition."
},
{
"i": "M5-020",
"c": "Mythologie",
"k": "savoir",
"t": "Oshun et la puissance de l’eau douce",
"x": "Dans les traditions yoruba, Ọ̀ṣun est une divinité associée notamment aux rivières, à la fertilité, à la beauté et à la diplomatie. Les récits et pratiques qui lui sont liés diffèrent selon les lieux et les communautés.",
"q": "À quel élément naturel Ọ̀ṣun est-elle particulièrement associée ?",
"a": "À l’eau douce et aux rivières.",
"n": "Les mythes relient souvent les forces de la nature aux valeurs d’une communauté."
},
{
"i": "M5-021",
"c": "Mythologie",
"k": "savoir",
"t": "Le corbeau qui apporte la lumière",
"x": "Dans plusieurs récits des peuples autochtones de la côte nord-ouest du Pacifique, le Corbeau est un personnage transformateur associé à l’obtention ou à la mise en circulation de la lumière. Les versions varient selon les nations et les conteurs.",
"q": "Pourquoi faut-il préciser la communauté lorsqu’on raconte ce mythe ?",
"a": "Parce qu’il existe plusieurs versions et traditions distinctes ; les regrouper sous une seule histoire efface leurs différences.",
"n": "Raconter un mythe, c’est aussi respecter la communauté qui le transmet."
},
{
"i": "M5-024",
"c": "Mythologie",
"k": "savoir",
"t": "Le serpent arc-en-ciel",
"x": "Le Serpent arc-en-ciel apparaît dans plusieurs traditions aborigènes d’Australie, avec des récits différents selon les peuples. Il peut être lié à l’eau, aux paysages, à la création et aux règles qui organisent la vie.",
"q": "Peut-on parler d’une version unique du Serpent arc-en-ciel ?",
"a": "Non. Les récits varient selon les peuples aborigènes et doivent être contextualisés.",
"n": "La diversité des traditions mérite autant d’attention que leur beauté."
},
{
"i": "M5-027",
"c": "Psychologie",
"k": "savoir",
"t": "Ton cerveau complète parfois ce qu’il ne voit pas",
"x": "La perception n’est pas une simple photographie du monde. Le cerveau combine les informations sensorielles avec le contexte et les attentes pour interpréter ce qui se passe.",
"q": "Pourquoi deux personnes peuvent-elles interpréter différemment la même scène ?",
"a": "Parce que leur attention, leurs attentes, leurs expériences et le contexte influencent leur perception.",
"n": "Voir n’est pas toujours comprendre : vérifie avant de conclure."
},
{
"i": "M5-028",
"c": "Psychologie",
"k": "savoir",
"t": "L’effet de récence",
"x": "Dans une liste d’informations, les derniers éléments peuvent être mieux rappelés à court terme que ceux du milieu. Ce phénomène est appelé effet de récence et fait partie des effets de position sérielle.",
"q": "Quel élément d’une liste l’effet de récence favorise-t-il ?",
"a": "Les éléments présentés vers la fin de la liste, notamment dans le rappel immédiat.",
"n": "Pour réviser, mélange les ordres et teste-toi au lieu de toujours relire la même liste."
},
{
"i": "M5-029",
"c": "Psychologie",
"k": "savoir",
"t": "Le biais de confirmation",
"x": "Le biais de confirmation désigne la tendance à rechercher, interpréter ou retenir plus facilement les informations qui soutiennent nos croyances déjà présentes.",
"q": "Comment limiter ce biais ?",
"a": "Chercher volontairement des éléments qui pourraient contredire notre idée et examiner la qualité des preuves.",
"n": "Une bonne réflexion cherche aussi ce qui pourrait lui donner tort."
},
{
"i": "M5-030",
"c": "Psychologie",
"k": "savoir",
"t": "Pourquoi une pause peut aider à apprendre",
"x": "L’attention soutenue peut diminuer avec le temps. Des pauses courtes et planifiées peuvent aider à récupérer et à reprendre une tâche avec plus de disponibilité mentale, même si leur durée idéale dépend de la personne et de l’activité.",
"q": "Une pause signifie-t-elle perdre du temps ?",
"a": "Pas nécessairement : elle peut aider à maintenir l’attention et à éviter une fatigue excessive.",
"n": "Étudier efficacement, c’est aussi savoir récupérer."
},
{
"i": "M5-031",
"c": "Psychologie",
"k": "savoir",
"t": "L’effet de halo",
"x": "L’effet de halo survient lorsqu’une impression positive ou négative sur une caractéristique influence notre jugement sur d’autres caractéristiques sans preuve suffisante.",
"q": "Donne un exemple d’effet de halo.",
"a": "Penser qu’une personne bien habillée est forcément compétente, alors que l’apparence ne prouve pas sa compétence.",
"n": "Ne confonds pas une bonne première impression avec une preuve."
},
{
"i": "M5-032",
"c": "Psychologie",
"k": "savoir",
"t": "Le pouvoir de l’espacement",
"x": "Répartir les séances de révision dans le temps améliore généralement la mémorisation à long terme par rapport à une seule séance intensive de même durée totale.",
"q": "Comment appliquer l’effet d’espacement ?",
"a": "Revoir une notion plusieurs fois à des intervalles croissants, plutôt que tout apprendre la veille.",
"n": "Un peu aujourd’hui, un peu demain : la mémoire aime les rendez-vous."
},
{
"i": "M5-034",
"c": "Psychologie",
"k": "savoir",
"t": "Le sommeil consolide les souvenirs",
"x": "Le sommeil participe à la consolidation de certains souvenirs. Apprendre puis dormir peut aider le cerveau à stabiliser des informations, même si le sommeil ne remplace pas l’étude.",
"q": "Pourquoi sacrifier systématiquement son sommeil avant un examen est-il risqué ?",
"a": "Parce que le manque de sommeil peut nuire à l’attention, à la mémoire et aux performances cognitives.",
"n": "Une nuit de repos fait partie de la préparation, pas de la paresse."
},
{
"i": "M5-035",
"c": "Psychologie",
"k": "savoir",
"t": "L’effet spectateur",
"x": "Dans certaines situations d’urgence, la présence de plusieurs témoins peut réduire la probabilité qu’une personne donnée intervienne rapidement. La responsabilité peut sembler partagée entre tous.",
"q": "Comment augmenter les chances qu’une aide arrive ?",
"a": "Désigner clairement une personne : « Vous, appelez les secours » plutôt que demander vaguement de l’aide à la foule.",
"n": "Une consigne précise transforme les témoins en acteurs."
},
{
"i": "M5-036",
"c": "Psychologie",
"k": "savoir",
"t": "Les émotions influencent les décisions",
"x": "Les émotions participent à la prise de décision : elles aident à évaluer ce qui compte, ce qui menace ou ce qui attire. Décider rationnellement ne signifie donc pas supprimer toute émotion.",
"q": "Faut-il éliminer les émotions pour bien décider ?",
"a": "Non. Il faut les reconnaître et les mettre en perspective avec les faits et les objectifs.",
"n": "Écoute tes émotions, mais ne leur donne pas seules le dernier mot."
},
{
"i": "M5-037",
"c": "Sciences",
"k": "savoir",
"t": "Le métal qui fond dans la main",
"x": "Le gallium est un métal dont le point de fusion est d’environ 29,8 °C. Il peut donc fondre près de la température du corps humain, contrairement à la plupart des métaux courants.",
"q": "Pourquoi le gallium peut-il fondre dans une main chaude ?",
"a": "Parce que sa température de fusion est proche de 30 °C.",
"n": "La matière réserve des propriétés étonnantes, mais les expériences doivent respecter les consignes de sécurité."
},
{
"i": "M5-038",
"c": "Sciences",
"k": "savoir",
"t": "Les poulpes ont trois cœurs",
"x": "Le poulpe possède trois cœurs : deux pompent le sang vers les branchies et un autre l’envoie vers le reste du corps. Son sang contient de l’hémocyanine, une molécule à base de cuivre qui contribue à sa couleur bleutée.",
"q": "Combien de cœurs possède un poulpe ?",
"a": "Trois.",
"n": "La diversité du vivant dépasse souvent nos intuitions humaines."
},
{
"i": "M5-039",
"c": "Sciences",
"k": "savoir",
"t": "Sur Vénus, tourner sur soi dure plus longtemps qu'une année",
"x": "Vénus met environ 243 jours terrestres à tourner sur elle-même, mais environ 225 jours terrestres à faire le tour du Soleil. Sa rotation est très lente et rétrograde.",
"q": "Qu’est-ce qui est plus long sur Vénus : la rotation ou l’année orbitale ?",
"a": "La rotation sidérale, qui dure environ 243 jours terrestres.",
"n": "Même les repères les plus familiers, comme le jour et l’année, peuvent changer d’une planète à l’autre."
},
{
"i": "M5-040",
"c": "Sciences",
"k": "savoir",
"t": "Les arbres communiquent-ils ?",
"x": "Les arbres et les plantes échangent des signaux chimiques et peuvent interagir avec des organismes du sol, notamment des champignons mycorhiziens. Certaines affirmations populaires sur une communication intentionnelle entre arbres sont toutefois exagérées.",
"q": "Que faut-il retenir avec prudence ?",
"a": "Il existe des interactions biologiques souterraines, mais il ne faut pas les présenter comme une conversation humaine entre arbres.",
"n": "La science est fascinante sans avoir besoin d’être exagérée."
},
{
"i": "M5-041",
"c": "Sciences",
"k": "savoir",
"t": "Le son ne voyage pas dans le vide",
"x": "Le son est une onde mécanique : il a besoin d’un milieu matériel, comme l’air, l’eau ou un solide, pour se propager. Dans le vide spatial, il ne peut pas se transmettre comme dans l’air.",
"q": "Pourquoi une explosion dans l’espace ne s’entendrait-elle pas directement ?",
"a": "Parce que le vide ne fournit pas de milieu matériel pour transporter les vibrations sonores.",
"n": "Les films peuvent être spectaculaires ; la physique, elle, garde ses règles."
},
{
"i": "M5-042",
"c": "Sciences",
"k": "savoir",
"t": "Le miel peut se conserver très longtemps",
"x": "Le miel possède une faible teneur en eau et une forte concentration en sucres, ce qui limite le développement de nombreux micro-organismes. Sa conservation dépend toutefois de l’humidité, de la contamination et du stockage.",
"q": "Quelles propriétés contribuent à la conservation du miel ?",
"a": "Sa faible activité de l’eau, son acidité et sa forte concentration en sucres.",
"n": "Un aliment durable n’est pas pour autant à l’abri de toute altération."
},
{
"i": "M5-043",
"c": "Sciences",
"k": "savoir",
"t": "Les continents bougent encore",
"x": "Les plaques tectoniques se déplacent de quelques millimètres à plusieurs centimètres par an. Leur mouvement explique notamment la formation de montagnes, les séismes et une grande partie du volcanisme.",
"q": "Les continents sont-ils immobiles ?",
"a": "Non. Ils se déplacent avec les plaques lithosphériques auxquelles ils appartiennent.",
"n": "La Terre change même lorsque nous ne pouvons pas le percevoir à l’échelle d’une vie."
},
{
"i": "M5-044",
"c": "Sciences",
"k": "savoir",
"t": "Pourquoi le ciel paraît bleu",
"x": "Les molécules de l’atmosphère diffusent davantage les courtes longueurs d’onde de la lumière solaire, notamment le bleu, que les grandes longueurs d’onde. Ce phénomène est appelé diffusion de Rayleigh.",
"q": "Quel phénomène explique principalement la couleur bleue du ciel ?",
"a": "La diffusion de Rayleigh de la lumière dans l’atmosphère.",
"n": "Une couleur familière peut révéler une loi physique profonde."
},
{
"i": "M5-045",
"c": "Sciences",
"k": "savoir",
"t": "L’eau peut bouillir à température ambiante",
"x": "L’eau bout lorsque sa pression de vapeur atteint la pression exercée autour d’elle. En diminuant suffisamment la pression, par exemple dans une enceinte adaptée, on peut faire bouillir l’eau à une température inférieure à 100 °C.",
"q": "Pourquoi l’eau bout-elle à une température plus basse en altitude ?",
"a": "Parce que la pression atmosphérique y est plus faible.",
"n": "Un phénomène dépend parfois autant de son environnement que de la substance elle-même."
},
{
"i": "M5-046",
"c": "Sciences",
"k": "savoir",
"t": "Les tardigrades résistent à des conditions extrêmes",
"x": "Les tardigrades sont de minuscules animaux capables d’entrer dans un état de dormance appelé cryptobiose. Dans cet état, certaines espèces tolèrent des conditions extrêmes, mais elles ne sont pas invincibles.",
"q": "Comment certains tardigrades survivent-ils à la déshydratation ?",
"a": "En entrant dans un état de cryptobiose qui réduit fortement leur activité métabolique.",
"n": "La résistance exceptionnelle ne signifie pas une invulnérabilité absolue."
},
{
"i": "M5-047",
"c": "Afrique",
"k": "savoir",
"t": "Le royaume du Kongo avait une diplomatie internationale",
"x": "À partir de la fin du XVe siècle, le royaume du Kongo entretient des relations diplomatiques avec le Portugal. Des lettres royales, des échanges religieux et des relations commerciales témoignent de contacts politiques complexes, marqués aussi par des tensions.",
"q": "Le royaume du Kongo était-il isolé du monde extérieur ?",
"a": "Non. Il entretenait notamment des relations diplomatiques avec le Portugal et d’autres réseaux régionaux.",
"n": "L’histoire du Kongo est aussi une histoire de diplomatie et de choix politiques."
},
{
"i": "M5-050",
"c": "Afrique",
"k": "savoir",
"t": "L’écriture ge’ez est toujours étudiée",
"x": "Le ge’ez est une ancienne langue sémitique d’Éthiopie, qui n’est plus une langue parlée courante mais reste utilisée dans la liturgie de l’Église orthodoxe éthiopienne et dans des traditions écrites.",
"q": "Le ge’ez est-il une langue sans usage aujourd’hui ?",
"a": "Non. Il conserve un usage liturgique et une importance historique et littéraire.",
"n": "Une langue peut continuer à vivre dans les textes, les rites et la mémoire collective."
},
{
"i": "M5-051",
"c": "Afrique",
"k": "savoir",
"t": "Les murailles de Benin City",
"x": "Les terrassements et remparts historiques associés à Benin City témoignent d’un vaste aménagement urbain du royaume du Bénin. Leur construction et leur fonction sont étudiées à partir de sources historiques et archéologiques.",
"q": "Que révèlent ces ouvrages ?",
"a": "L’organisation urbaine, le pouvoir politique et les capacités de construction du royaume du Bénin.",
"n": "Les villes africaines anciennes possédaient des infrastructures complexes."
},
{
"i": "M5-052",
"c": "Afrique",
"k": "savoir",
"t": "Le swahili est une langue de rencontres",
"x": "Le kiswahili s’est développé sur la côte est-africaine dans un environnement d’échanges entre communautés bantoues et réseaux commerciaux de l’océan Indien. Il a intégré des emprunts à plusieurs langues, notamment l’arabe.",
"q": "Pourquoi le kiswahili contient-il des mots d’origines diverses ?",
"a": "Parce qu’il s’est développé dans des régions de contacts commerciaux, culturels et linguistiques.",
"n": "Les langues portent la trace des rencontres entre les peuples."
},
{
"i": "M5-053",
"c": "Afrique",
"k": "savoir",
"t": "L’université d’al-Qarawiyyin",
"x": "La mosquée et l’institution d’al-Qarawiyyin à Fès, fondées au IXe siècle selon la tradition historique, sont devenues un important centre d’enseignement. Les définitions modernes d’université ne correspondent toutefois pas toujours aux institutions médiévales.",
"q": "Pourquoi faut-il nuancer l’expression « plus vieille université » ?",
"a": "Parce que les institutions médiévales n’avaient pas toutes la même organisation que les universités modernes.",
"n": "L’histoire gagne en force lorsqu’on distingue les mots d’hier et les catégories d’aujourd’hui."
},
{
"i": "M5-054",
"c": "Afrique",
"k": "savoir",
"t": "Le lac Tchad a beaucoup changé",
"x": "Le lac Tchad a connu de fortes variations de superficie au fil des décennies, sous l’effet combiné des précipitations, des apports des fleuves, de la demande en eau et des conditions climatiques.",
"q": "Pourquoi la superficie du lac Tchad varie-t-elle ?",
"a": "Elle dépend notamment des pluies, des apports hydrologiques, de l’évaporation et des usages humains de l’eau.",
"n": "Comprendre l’environnement demande de regarder plusieurs causes à la fois."
},
{
"i": "M5-055",
"c": "Mystères",
"k": "savoir",
"t": "Le mécanisme d’Anticythère",
"x": "Découvert dans une épave antique près de l’île grecque d’Anticythère, ce mécanisme à engrenages servait à modéliser des cycles astronomiques. Il est souvent présenté comme un calculateur analogique antique.",
"q": "À quoi servait le mécanisme d’Anticythère ?",
"a": "À calculer ou représenter des cycles astronomiques et calendaires.",
"n": "Les technologies anciennes peuvent être beaucoup plus sophistiquées qu’on ne l’imagine."
},
{
"i": "M5-056",
"c": "Mystères",
"k": "savoir",
"t": "Les lignes de Nazca vues du ciel",
"x": "Dans le désert péruvien, les lignes de Nazca forment de grandes figures géométriques et animales réalisées en retirant la couche superficielle sombre du sol. Leur fonction exacte fait encore l’objet de recherches.",
"q": "Comment les figures de Nazca ont-elles été réalisées ?",
"a": "En dégageant la surface sombre du désert pour faire apparaître le sol plus clair en dessous.",
"n": "Une énigme archéologique mérite des hypothèses testées, pas des certitudes inventées."
},
{
"i": "M5-057",
"c": "Mystères",
"k": "savoir",
"t": "Le manuscrit de Voynich reste indéchiffré",
"x": "Le manuscrit de Voynich est un codex illustré écrit dans une écriture inconnue. Son origine et son contenu exact restent débattus ; aucune interprétation largement acceptée n’a permis de le lire de manière convaincante.",
"q": "Le manuscrit de Voynich a-t-il été déchiffré de façon certaine ?",
"a": "Non. Aucune lecture n’est actuellement reconnue comme une solution définitive par les spécialistes.",
"n": "Ne pas connaître la réponse est parfois le point de départ d’une vraie enquête."
},
{
"i": "M5-058",
"c": "Mystères",
"k": "savoir",
"t": "Les statues de l’île de Pâques",
"x": "Les moaï de Rapa Nui sont des statues monumentales sculptées par les habitants de l’île. Les recherches montrent qu’elles s’inscrivent dans une société organisée ; les explications simplistes sur une civilisation disparue sont à éviter.",
"q": "Qui a sculpté les moaï ?",
"a": "Les ancêtres des habitants polynésiens de Rapa Nui.",
"n": "Un mystère apparent peut disparaître quand on écoute les descendants et les données archéologiques."
},
{
"i": "M5-059",
"c": "Mystères",
"k": "savoir",
"t": "Le signal Wow!",
"x": "En 1977, un radiotélescope de l’Ohio a détecté un signal radio étroit et puissant qui a attiré l’attention des chercheurs. Il n’a pas été détecté à nouveau de manière concluante, et son origine reste inconnue.",
"q": "Le signal Wow! prouve-t-il l’existence d’extraterrestres ?",
"a": "Non. Il reste une détection intrigante, mais aucune preuve d’une origine extraterrestre n’a été établie.",
"n": "Une observation étonnante n’est pas encore une explication."
},
{
"i": "M5-060",
"c": "Mystères",
"k": "savoir",
"t": "Pourquoi le triangle des Bermudes n’est pas une preuve paranormale",
"x": "La zone appelée triangle des Bermudes est associée à des récits de disparitions de navires et d’avions. Les analyses ne montrent pas qu’elle serait plus dangereuse que d’autres zones maritimes très fréquentées, et plusieurs récits ont été exagérés.",
"q": "Le triangle des Bermudes est-il reconnu comme une zone surnaturelle ?",
"a": "Non. Les explications relèvent notamment de la météo, de la navigation, des erreurs humaines et de récits médiatiques amplifiés.",
"n": "Une histoire répétée n’est pas automatiquement un fait vérifié."
},
{
"i": "M5-061",
"c": "Mystères",
"k": "savoir",
"t": "Les sphères de pierre du Costa Rica",
"x": "Des sphères de pierre précolombiennes, parfois très régulières, ont été sculptées dans le sud du Costa Rica. Elles sont associées aux sociétés précolombiennes de la région et leur fonction exacte n’est pas toujours connue.",
"q": "Qui a réalisé les sphères de pierre du Costa Rica ?",
"a": "Des communautés précolombiennes de la région du Diquís.",
"n": "L’archéologie peut identifier les artisans et le contexte sans toujours connaître chaque usage."
},
{
"i": "M5-062",
"c": "Mystères",
"k": "savoir",
"t": "La cité souterraine de Derinkuyu",
"x": "En Cappadoce, en Turquie, Derinkuyu est une vaste ville souterraine comprenant des espaces de stockage, des passages et des lieux de vie. Elle a pu servir de refuge à différentes périodes.",
"q": "Pourquoi construire des espaces souterrains à Derinkuyu ?",
"a": "Ils pouvaient offrir protection et abri, notamment pendant des périodes d’insécurité.",
"n": "L’ingéniosité humaine sait aussi construire sous la surface."
},
{
"i": "M5-064",
"c": "Motivation",
"k": "savoir",
"t": "Le groupe de travail où un seul travaille",
"x": "Dans un travail collectif, répartir les responsabilités sans préciser les livrables peut conduire à ce que quelques personnes fassent presque tout. Une tâche claire, un responsable et une échéance réduisent cette ambiguïté.",
"q": "Que faut-il définir pour chaque tâche de groupe ?",
"a": "Un responsable, un résultat attendu et une échéance.",
"n": "Un bon groupe ne partage pas seulement un document : il partage les responsabilités."
},
{
"i": "M5-065",
"c": "Motivation",
"k": "savoir",
"t": "La fiche de révision qui devient un roman",
"x": "Une fiche de révision trop longue peut reproduire le cours au lieu d’en extraire les notions essentielles. Une bonne fiche privilégie les idées structurantes, les définitions et les questions de rappel.",
"q": "Quel est le but d’une fiche de révision ?",
"a": "Aider à retrouver et à expliquer rapidement les notions essentielles, pas recopier tout le cours.",
"n": "Si ta fiche est aussi longue que le cours, elle n’a peut-être pas encore fait son travail."
},
{
"i": "M5-067",
"c": "Motivation",
"k": "savoir",
"t": "Le téléphone et les cinq minutes qui disparaissent",
"x": "Les notifications et les changements fréquents de tâche peuvent interrompre le travail et imposer un coût de reprise de l’attention. Couper les alertes pendant une courte période peut faciliter la concentration.",
"q": "Quel geste simple peut protéger une séance de travail ?",
"a": "Mettre le téléphone en mode silencieux ou éloigné pendant une période définie.",
"n": "Tu n’as pas besoin de combattre toutes les distractions à la fois : commence par la plus proche."
},
{
"i": "M5-069",
"c": "Motivation",
"k": "savoir",
"t": "Réviser à deux sans se distraire",
"x": "La révision à deux fonctionne mieux lorsque chacun doit expliquer une notion, répondre à des questions ou corriger une réponse. Sans objectif précis, la séance peut facilement devenir une conversation sans apprentissage.",
"q": "Comment rendre une séance de révision à deux efficace ?",
"a": "Alterner les rôles : un étudiant explique, l’autre questionne, puis on inverse.",
"n": "Un camarade peut devenir ton meilleur outil de révision si vous avez une méthode."
}
]
