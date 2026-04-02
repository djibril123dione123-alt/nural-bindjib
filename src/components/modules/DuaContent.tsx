import { useState, useMemo } from "react";
import { motion } from "framer-motion";

const DUAS = [
  { category: "Matin", items: [
    { arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ", translation: "Nous voilà au matin et la royauté appartient à Allah", source: "Muslim" },
    { arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا", translation: "Ô Allah, c'est par Toi que nous atteignons le matin et le soir", source: "Tirmidhi" },
    { arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ", translation: "Ô Allah, je Te demande le bien-être", source: "Ibn Majah" },
  ]},
  { category: "Soir", items: [
    { arabic: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ", translation: "Nous voilà au soir et la royauté appartient à Allah", source: "Muslim" },
    { arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", translation: "Je cherche refuge dans les paroles parfaites d'Allah", source: "Muslim" },
  ]},
  { category: "Protection", items: [
    { arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ", translation: "Au nom d'Allah, rien ne peut nuire avec Son nom", source: "Abu Dawud" },
    { arabic: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ", translation: "Allah me suffit, il n'y a de divinité que Lui", source: "Abu Dawud" },
  ]},
  { category: "Couple", items: [
    { arabic: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ", translation: "Seigneur, accorde-nous en nos épouses et descendants la joie des yeux", source: "Coran 25:74" },
    { arabic: "اللَّهُمَّ بَارِكْ لَهُمَا وَبَارِكْ عَلَيْهِمَا", translation: "Ô Allah, bénis-les et répands Ta bénédiction sur eux", source: "Abu Dawud" },
  ]},
];

export default function DuaContent() {
  const [activeCategory, setActiveCategory] = useState(DUAS[0].category);

  const currentDuas = useMemo(() => DUAS.find(d => d.category === activeCategory)?.items || [], [activeCategory]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DUAS.map(d => (
          <motion.button key={d.category} whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(d.category)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === d.category ? "bg-primary/20 border border-primary text-primary" : "glass text-muted-foreground"
            }`}>
            {d.category}
          </motion.button>
        ))}
      </div>

      <div className="space-y-3">
        {currentDuas.map((dua, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl p-5 space-y-3">
            <p className="text-right text-xl font-display text-accent leading-loose" dir="rtl">{dua.arabic}</p>
            <p className="text-sm text-foreground/80 italic">{dua.translation}</p>
            <p className="text-[10px] text-muted-foreground">📚 {dua.source}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
