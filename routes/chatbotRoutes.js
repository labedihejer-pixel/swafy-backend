const express = require("express");
const router  = express.Router();

// ══════════════════════════════════════════════
//   BASE DE CONNAISSANCES SWAFY - ENRICHIE
// ══════════════════════════════════════════════
const KB = {

  // ── SWAFY ─────────────────────────────────
  swafy: `🌟 **Swafy** est une plateforme numérique tunisienne dédiée aux jeunes 
(15-35 ans), développée par l'Agence Tunisienne pour la Jeunesse (ATJ). 
Elle offre: débats structurés, lives interactifs, publications multimédias 
et un suivi personnalisé pour encourager la participation citoyenne.`,

  contact: `📞 **Contacts Swafy / ATJ:**
• Site officiel: www.swafy.tn
• Email: contact@swafy.tn  
• Téléphone: +216 71 XXX XXX
• Adresse: Agence Tunisienne pour la Jeunesse, Tunis
• Réseaux: @SwafyTN (Facebook, Instagram, Twitter)`,

  inscription: `📝 **Inscription sur Swafy:**
1. Cliquez sur "S'inscrire"
2. Remplissez: nom, email, âge, établissement, gouvernorat
3. Choisissez votre statut (étudiant, lycéen, diplômé...)
4. Acceptez les règles de participation
5. Accès immédiat à votre espace Jeune !
💡 L'inscription est gratuite et ouverte à tous les jeunes tunisiens.`,

  debat: `⚖️ **Les Débats sur Swafy (style Kialo):**
Chaque débat a une question centrale avec deux colonnes:
• ✅ **POUR**: argumentez en faveur
• ❌ **CONTRE**: argumentez contre
Vous pouvez: commenter, répondre aux arguments d'autres, 
réagir avec 👍👎 et emojis 🔥💡👏😮, et suivre les débats.`,

  live: `🎥 **Sessions Live sur Swafy:**
Les lives sont organisés par l'administration ATJ.
• Regardez en direct
• Commentez et interagissez en temps réel  
• Accédez aux archives des anciens lives
• Sujets: citoyenneté, culture, entrepreneuriat, droits...`,

  publication: `📢 **Publications sur Swafy:**
Depuis "Publier" vous pouvez partager:
• 📸 Photos & Images
• 🎬 Vidéos
• 📄 Documents PDF
• ⚖️ Questions Pour/Contre (débats)
La communauté peut commenter, liker et réagir à vos publications.`,

  // ── SCIENCE & CULTURE ─────────────────────
  ia: `🤖 **Intelligence Artificielle (IA):**
L'IA est la simulation de l'intelligence humaine par des machines.
Domaines: Machine Learning, Deep Learning, NLP, Computer Vision.
Applications: ChatGPT, reconnaissance faciale, voitures autonomes, 
diagnostic médical, traduction automatique.
En Tunisie: startups comme InstaDeep, programmes d'IA à l'INSAT, ESPRIT.`,

  maths: `📐 **Mathématiques - Bases:**
• **Algèbre**: équations, polynômes, matrices
• **Analyse**: fonctions, dérivées, intégrales, limites
• **Probabilités**: événements, loi normale, espérance
• **Géométrie**: euclidienne, analytique, trigonométrie
💡 Ressources: Khan Academy, Mathway, Wolfram Alpha`,

  physique: `⚛️ **Physique - Domaines clés:**
• **Mécanique**: lois de Newton, énergie, mouvements
• **Électromagnétisme**: champs, circuits, ondes EM
• **Thermodynamique**: chaleur, entropie, gaz parfaits
• **Optique**: lumière, réfraction, lentilles
• **Physique quantique**: modèle atomique, dualité onde-corpuscule`,

  chimie: `🧪 **Chimie - Fondamentaux:**
• **Chimie organique**: hydrocarbures, fonctions, polymères
• **Chimie minérale**: acides/bases, oxydoréduction, sels
• **Biochimie**: protéines, ADN, enzymes, métabolisme
• **Chimie analytique**: spectroscopie, chromatographie`,

  biologie: `🧬 **Biologie - Domaines:**
• **Biologie cellulaire**: cellule, mitose, méiose, organites
• **Génétique**: ADN, gènes, hérédité, mutations, CRISPR
• **Écologie**: écosystèmes, chaînes alimentaires, biodiversité
• **Physiologie**: systèmes nerveux, cardiovasculaire, immunitaire`,

  informatique: `💻 **Informatique - Ressources:**
• **Langages**: Python, JavaScript, Java, C++, SQL
• **Web**: HTML/CSS, React, Node.js, bases de données
• **Algorithmes**: tri, recherche, complexité O(n)
• **Réseaux**: TCP/IP, HTTP, sécurité, cybersécurité
• Plateformes: freeCodeCamp, Coursera, edX, MIT OpenCourseWare`,

  histoire: `📚 **Histoire de la Tunisie:**
• Carthage (814 av. J-C) - civilisation punique
• Période romaine (146 av. J-C - 429 ap. J-C)
• Conquête arabe (670) - islamisation
• Régences ottomanes (1574-1881)
• Protectorat français (1881-1956)
• Indépendance: 20 mars 1956, Bourguiba
• Révolution du 14 janvier 2011 (Jasmin)`,

  entrepreneuriat: `🚀 **Entrepreneuriat en Tunisie:**
• **BFPME**: Banque de Financement des PME
• **ANETI**: Agence Nationale pour l'Emploi
• **STARTUP ACT**: loi favorable aux startups (2018)
• **Smart Tunisia**: programme IT offshore
• **ATI**: Agence Technique de l'Internet
Incubateurs: Carthage Business Angels, Flat6Labs, Cogite`,

  droits: `⚖️ **Droits des Jeunes en Tunisie:**
• Droit à l'éducation (gratuite jusqu'au bac)
• Droit à la santé (CNSS, hôpitaux publics)  
• Droit au travail et à la formation professionnelle
• Droit à la participation politique (vote dès 18 ans)
• Droit à la culture et aux loisirs
• Protection contre la discrimination et les violences`,

  sante: `🏥 **Santé & Bien-être des Jeunes:**
• **Santé mentale**: anxiété, dépression, stress scolaire
  → Ligne d'écoute: 80 100 300 (gratuit)
• **Nutrition**: alimentation équilibrée méditerranéenne
• **Sport**: recommandé 150min/semaine d'activité modérée
• **Sommeil**: 7-9h pour les 18-25 ans
• Centres de santé jeunes dans chaque gouvernorat`,

  culture: `🎭 **Culture Tunisienne:**
• **Fêtes**: Aïd el-Fitr, Aïd el-Adha, Nouvel An berbère (Yennayer)
• **Musique**: malouf, mezoued, musique contemporaine tunisienne
• **Cinéma**: Journées Cinématographiques de Carthage (JCC)
• **Artisanat**: poterie Nabeul, tapis Kairouan, broderies Tunis
• **Gastronomie**: couscous, brik, tajine, makroudh, bambalouni`,

  environnement: `🌱 **Environnement & Développement Durable:**
• La Tunisie a signé l'Accord de Paris (COP21)
• Défis: désertification, pénurie d'eau, pollution côtière
• Énergies renouvelables: Plan Solaire Tunisien (ELMED)
• Organisations: WWF Tunisie, APAL, réseau REMENA
• Actions jeunes: nettoyages côtiers, jardins urbains, recyclage`,

  default: `🤔 Je n'ai pas trouvé de réponse précise à votre question.

Vous pouvez me demander:
• 🌐 Infos sur **Swafy** et l'ATJ
• ⚖️ Comment fonctionne les **débats**
• 📢 Comment faire une **publication**
• 🎥 Les **lives** et archives
• 🔬 Sciences: IA, maths, physique, chimie, bio, info
• 📚 Histoire, culture, droits, santé, entrepreneuriat en Tunisie

Précisez votre question pour une meilleure réponse !`,
};

// ══════════════════════════════════════════════
//   MOTEUR DE MATCHING
// ══════════════════════════════════════════════
const normalize = (str) =>
  str.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "")
     .replace(/['']/g, " ");

const PATTERNS = [
  { keys: ["swafy","plateforme","site","projet","atj","agence"], reply: KB.swafy },
  { keys: ["contact","telephone","email","adresse","joindre","appeler"], reply: KB.contact },
  { keys: ["inscri","compte","register","rejoindre","creer compte"], reply: KB.inscription },
  { keys: ["debat","pour","contre","argument","kialo","voter"], reply: KB.debat },
  { keys: ["live","direct","stream","diffusion"], reply: KB.live },
  { keys: ["publier","publication","post","partager","photo","video","pdf"], reply: KB.publication },
  { keys: ["ia","intelligence artificielle","machine learning","deep learning","chatgpt","gpt"], reply: KB.ia },
  { keys: ["math","calcul","algebre","analyse","geometrie","probabilite","statistique"], reply: KB.maths },
  { keys: ["physique","mechanique","thermodynamique","optique","quantique","newton"], reply: KB.physique },
  { keys: ["chimie","molecule","acide","base","reaction chimique"], reply: KB.chimie },
  { keys: ["biologie","genetique","adn","cellule","evolution","ecosysteme"], reply: KB.biologie },
  { keys: ["informatique","programmation","code","python","javascript","web","reseau","algo"], reply: KB.informatique },
  { keys: ["histoire","tunisie","carthage","independance","revolution","bourguiba"], reply: KB.histoire },
  { keys: ["entrepreneuriat","startup","entreprise","investissement","financement"], reply: KB.entrepreneuriat },
  { keys: ["droit","jeune","loi","citoyen","vote","protection"], reply: KB.droits },
  { keys: ["sante","mental","stress","sport","nutrition","medecin","hospital"], reply: KB.sante },
  { keys: ["culture","musique","cinema","artisanat","fete","tradition"], reply: KB.culture },
  { keys: ["environnement","ecologie","climat","durable","nature","pollution"], reply: KB.environnement },
];

router.post("/", (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ reply: "Veuillez entrer un message valide." });
  }

  const msg = normalize(message);
  let reply = KB.default;

  for (const pattern of PATTERNS) {
    if (pattern.keys.some((k) => msg.includes(normalize(k)))) {
      reply = pattern.reply;
      break;
    }
  }

  res.json({ reply });
});

module.exports = router;