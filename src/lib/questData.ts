export interface Quest {
  id: string;
  label: string;
  xp: number;
  optional?: boolean;
}

export interface Pillar {
  id: string;
  name: string;
  icon: string;
  color: "emerald" | "gold";
  quests: Quest[];
}

export const PILLARS: Pillar[] = [
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

export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  minXp: number;
  maxXp: number;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, title: "Discipline fragile", emoji: "🌱", minXp: 0, maxXp: 300 },
  { level: 2, title: "En chemin vers la constance", emoji: "🛡️", minXp: 300, maxXp: 700 },
  { level: 3, title: "Discipline de fer", emoji: "✨", minXp: 700, maxXp: 1200 },
  { level: 4, title: "Mentalité d'élite", emoji: "👑", minXp: 1200, maxXp: Infinity },
];

export function getLevel(totalXp: number): LevelInfo {
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
