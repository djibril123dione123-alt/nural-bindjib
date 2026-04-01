export interface Quest {
  id: string;
  label: string;
  xp: number;
  optional?: boolean;
  priority?: boolean;
}

export interface Pillar {
  id: string;
  name: string;
  icon: string;
  color: "emerald" | "gold";
  quests: Quest[];
}

// ─── DJIBRIL (Guide) QUESTS ───
export const PILLARS_GUIDE: Pillar[] = [
  {
    id: "corps",
    name: "CORPS",
    icon: "⚔️",
    color: "emerald",
    quests: [
      { id: "c1", label: "20 Pompes", xp: 10 },
      { id: "c2", label: "20 Abdos", xp: 10 },
      { id: "c3", label: "Routine de soins corporels", xp: 10 },
      { id: "c4", label: "Marche / Mouvement (10-20 min)", xp: 10 },
    ],
  },
  {
    id: "esprit",
    name: "ESPRIT",
    icon: "📚",
    color: "emerald",
    quests: [
      { id: "e1", label: "Deep Work (45-90 min, sans téléphone)", xp: 10 },
      { id: "e2", label: "Apprendre quelque chose de nouveau (20 min)", xp: 10 },
      { id: "e3", label: "Révisions / Études", xp: 10 },
    ],
  },
  {
    id: "foi",
    name: "FOI",
    icon: "🕌",
    color: "gold",
    quests: [
      { id: "f1", label: "Priez cinq fois", xp: 10 },
      { id: "f2", label: "Apprenez le Coran", xp: 10 },
    ],
  },
  {
    id: "vie",
    name: "VIE",
    icon: "🏠",
    color: "emerald",
    quests: [
      { id: "v1", label: "Se réveiller à l'heure", xp: 10 },
      { id: "v2", label: "Fixer 3 objectifs clairs", xp: 10 },
      { id: "v3", label: "Nettoyer la chambre", xp: 10 },
      { id: "v4", label: "Ranger l'espace", xp: 10 },
      { id: "v5", label: "Préparer pour demain", xp: 10 },
      { id: "v6", label: "Méditation", xp: 10 },
      { id: "v7", label: "Zéro défilement inutile", xp: 10 },
      { id: "v8", label: "Suivre les progrès (XP)", xp: 10 },
      { id: "v9", label: "Revue quotidienne (5-10 min)", xp: 10 },
      { id: "v10", label: "Conversation significative", xp: 10 },
      { id: "v11", label: "Lessive (2x/semaine)", xp: 10, optional: true },
      { id: "v12", label: "Économiser (suivi dépenses)", xp: 10, optional: true },
    ],
  },
];

// ─── BINTA (Guardian) QUESTS ───
export const PILLARS_GUARDIAN: Pillar[] = [
  {
    id: "foi",
    name: "FAITH — La Lumière du Cœur",
    icon: "🕌",
    color: "gold",
    quests: [
      { id: "bf1", label: "Les 5 Prières à l'heure", xp: 50, priority: true },
      { id: "bf2", label: "Hifz — Mémorisation Coran", xp: 15 },
      { id: "bf3", label: "Pureté Sonore (Zéro Musique)", xp: 30 },
      { id: "bf4", label: "Élégance de la Pudeur (Hijab)", xp: 30 },
      { id: "bf5", label: "Adab & Douceur", xp: 15 },
    ],
  },
  {
    id: "esprit",
    name: "MIND — L'Élite Académique",
    icon: "📚",
    color: "emerald",
    quests: [
      { id: "be1", label: "Deep Work (45-90 min)", xp: 20 },
      { id: "be2", label: "Skills Lab — Mission Djibril", xp: 50, priority: true },
      { id: "be3", label: "Preuve de Compétence (Upload)", xp: 10 },
      { id: "be4", label: "Lecture Utile (20 min)", xp: 15 },
    ],
  },
  {
    id: "corps",
    name: "BODY — L'Énergie Vitale",
    icon: "⚔️",
    color: "emerald",
    quests: [
      { id: "bc1", label: "20 Push-ups & 20 Sit-ups", xp: 20 },
      { id: "bc2", label: "Marche / Mouvement (15 min)", xp: 10 },
      { id: "bc3", label: "Soin de Soi (Routine)", xp: 10 },
    ],
  },
  {
    id: "vie",
    name: "LIFE — La Reine de l'Ordre",
    icon: "🏠",
    color: "emerald",
    quests: [
      { id: "bv1", label: "Réveil Stratégique", xp: 20 },
      { id: "bv2", label: "Zéro Scrolling (TikTok/Insta)", xp: 40 },
      { id: "bv3", label: "Gestion du Budget", xp: 10 },
      { id: "bv4", label: "Daily Review (Journal Sakinah)", xp: 15 },
    ],
  },
];

// Keep backward compat
export const PILLARS = PILLARS_GUIDE;

export function getPillarsForRole(role: "guide" | "guardian"): Pillar[] {
  return role === "guardian" ? PILLARS_GUARDIAN : PILLARS_GUIDE;
}

// ─── WISDOM QUOTES ───
export const WISDOM_QUOTES = [
  "« En vérité, avec la difficulté il y a une facilité. » — Coran 94:6",
  "« Celui qui ne remercie pas les gens ne remercie pas Allah. » — Hadith",
  "« La constance bat la motivation. Chaque jour compte. »",
  "« Soyez dans ce monde comme un étranger ou un voyageur. » — Hadith",
  "« Et quiconque place sa confiance en Allah, Il lui suffit. » — Coran 65:3",
  "« La meilleure richesse est la richesse de l'âme. » — Hadith",
  "« Les actes ne valent que par les intentions. » — Hadith",
  "« Certes, Allah ne change pas l'état d'un peuple tant qu'ils ne changent pas ce qui est en eux-mêmes. » — Coran 13:11",
];

// ═══════════════════════════════════════════════
// DYNAMIC LEVEL SYSTEM V3 (1-150)
// XP required = 50 × level²
// ═══════════════════════════════════════════════

export type RankId = "bronze" | "silver" | "gold" | "diamond";

export interface RankInfo {
  id: RankId;
  name: string;
  emoji: string;
  minLevel: number;
  maxLevel: number;
  color: string;
}

export const RANKS: RankInfo[] = [
  { id: "bronze", name: "Novice", emoji: "🥉", minLevel: 1, maxLevel: 20, color: "30 60% 50%" },
  { id: "silver", name: "Sentinelle", emoji: "🥈", minLevel: 21, maxLevel: 50, color: "0 0% 70%" },
  { id: "gold", name: "Architecte", emoji: "🥇", minLevel: 51, maxLevel: 90, color: "43 69% 53%" },
  { id: "diamond", name: "Khalifa", emoji: "💎", minLevel: 91, maxLevel: 150, color: "160 72% 50%" },
];

// Title mapping by level range (different for each role)
const GUIDE_TITLES: [number, string, string][] = [
  [1, "Apprenti Murid", "🌱"],
  [11, "Gardien de la Discipline", "🛡️"],
  [21, "Architecte du Destin", "🔧"],
  [31, "Étoile de l'Istiqamah", "✨"],
  [41, "Maître du Focus", "🎯"],
  [51, "Forgeron de l'Âme", "⚒️"],
  [61, "Sage du Savoir", "📖"],
  [71, "Sultan de l'Excellence", "👑"],
  [81, "Lumière de la Oumma", "🌟"],
  [91, "Commandeur de l'Alliance", "⚔️"],
  [101, "Khalifa de la Constance", "🏛️"],
  [111, "Légende Vivante", "🔥"],
  [121, "Architecte du Futur", "🌌"],
  [131, "Élu de la Baraka", "✨"],
  [141, "Sultan Éternel", "👑"],
];

const GUARDIAN_TITLES: [number, string, string][] = [
  [1, "Apprentie Murid", "🌱"],
  [11, "Gardienne de la Paix", "🛡️"],
  [21, "Étoile Montante", "⭐"],
  [31, "Étoile de l'Istiqamah", "✨"],
  [41, "Maîtresse du Focus", "🎯"],
  [51, "Perle de Sagesse", "📖"],
  [61, "Flamme de la Détermination", "🔥"],
  [71, "Reine de l'Alliance", "👑"],
  [81, "Lumière de la Sérénité", "🌟"],
  [91, "Impératrice du Savoir", "📚"],
  [101, "Khalifa de la Grâce", "🏛️"],
  [111, "Légende de la Baraka", "💎"],
  [121, "Architecte des Rêves", "🌌"],
  [131, "Étoile du Destin", "✨"],
  [141, "Sultane du Destin", "👑"],
];

// Alliance Pass Rewards
export interface AllianceReward {
  level: number;
  title: string;
  description: string;
  emoji: string;
  unlocked?: boolean;
}

export const ALLIANCE_REWARDS: AllianceReward[] = [
  { level: 10, title: "Message Secret", description: "Débloque un message caché de ton partenaire", emoji: "💌" },
  { level: 25, title: "Album Privé", description: "Débloque l'Album de vos souvenirs de projet", emoji: "📸" },
  { level: 50, title: "Dark Premium", description: "Débloque le mode Dark Premium total", emoji: "🌑" },
  { level: 100, title: "Médaille d'Honneur", description: "La Médaille d'Honneur de l'Alliance", emoji: "🏅" },
  { level: 150, title: "Légende Éternelle", description: "Statut légendaire — vous avez tout accompli", emoji: "🏆" },
];

// ─── CORE FUNCTIONS ───

/** XP needed to reach a given level: 50 × level² */
export function xpForLevel(level: number): number {
  return 50 * level * level;
}

/** Calculate level from total XP */
export function calculateLevel(totalXp: number): number {
  // level = floor(sqrt(totalXp / 50))
  const lvl = Math.floor(Math.sqrt(totalXp / 50));
  return Math.max(1, Math.min(150, lvl));
}

/** Get rank for a given level */
export function getRank(level: number): RankInfo {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].minLevel) return RANKS[i];
  }
  return RANKS[0];
}

/** Get title + emoji for a level and role */
export function getTitle(level: number, role: "guide" | "guardian" = "guide"): { title: string; emoji: string } {
  const titles = role === "guardian" ? GUARDIAN_TITLES : GUIDE_TITLES;
  let result = titles[0];
  for (const t of titles) {
    if (level >= t[0]) result = t;
  }
  return { title: result[1], emoji: result[2] };
}

/** Get full level info */
export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  rank: RankInfo;
  currentXp: number;
  xpForCurrent: number;
  xpForNext: number;
  progress: number; // 0-100
  isMilestone: boolean; // every 5 levels
}

export function getLevelInfo(totalXp: number, role: "guide" | "guardian" = "guide"): LevelInfo {
  const level = calculateLevel(totalXp);
  const { title, emoji } = getTitle(level, role);
  const rank = getRank(level);
  const xpForCurrent = xpForLevel(level);
  const xpForNext = level >= 150 ? xpForCurrent : xpForLevel(level + 1);
  const range = xpForNext - xpForCurrent;
  const progress = level >= 150 ? 100 : range > 0 ? Math.min(100, ((totalXp - xpForCurrent) / range) * 100) : 100;

  return {
    level,
    title,
    emoji,
    rank,
    currentXp: totalXp,
    xpForCurrent,
    xpForNext,
    progress,
    isMilestone: level % 5 === 0 && level > 0,
  };
}

// Milestone messages every 5 levels
export function getMilestoneMessage(level: number, partnerName: string): string | null {
  if (level % 5 !== 0) return null;
  const messages = [
    `${partnerName} est fier(e) de toi ! Continue comme ça ! 🌟`,
    `Mashallah ${partnerName}, tu brilles ! ${level} niveaux accomplis ! ✨`,
    `« La persévérance est la clé. » — ${partnerName} croit en toi ! 🔑`,
    `${partnerName} te dit : Tu es incroyable, niveau ${level} ! 👑`,
    `Alliance Level ${level} ! ${partnerName} et toi êtes inarrêtables ! 🚀`,
  ];
  return messages[Math.floor(level / 5) % messages.length];
}

// ─── BACKWARD COMPAT ───
// Keep old exports working
export const LEVELS = [
  { level: 1, title: "Discipline fragile", emoji: "🌱", minXp: 0, maxXp: 300 },
  { level: 2, title: "En chemin vers la constance", emoji: "🛡️", minXp: 300, maxXp: 700 },
  { level: 3, title: "Discipline de fer", emoji: "✨", minXp: 700, maxXp: 1200 },
  { level: 4, title: "Mentalité d'élite", emoji: "👑", minXp: 1200, maxXp: Infinity },
];

export function getLevel(totalXp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getLevelProgress(totalXp: number): number {
  const lvl = getLevel(totalXp);
  if (lvl.maxXp === Infinity) return 100;
  const range = lvl.maxXp - lvl.minXp;
  return Math.min(100, ((totalXp - lvl.minXp) / range) * 100);
}
