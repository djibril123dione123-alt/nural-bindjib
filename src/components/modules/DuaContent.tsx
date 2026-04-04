import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { vibrate } from "@/hooks/useHaptics";
import { toast } from "sonner";

interface Dua {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  note?: string;
  repeat?: string;
}

interface DuaCategory {
  category: string;
  icon: string;
  items: Dua[];
}

const DUAS: DuaCategory[] = [
  {
    category: "Après Salat",
    icon: "🕋",
    items: [
      { id: "as1", arabic: "أَسْتَغْفِرُ اللَّهَ", transliteration: "Astaghfirullah", translation: "Je demande pardon à Allah", repeat: "3 fois" },
      { id: "as2", arabic: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ", transliteration: "Allahoumma Antas-Salam wa minkas-Salam, tabarakta ya dhal-jalali wal-ikram", translation: "Ô Allah, Tu es la Paix et de Toi vient la paix. Béni sois-Tu, ô Détenteur de la Majesté et de la Générosité." },
      { id: "as3", arabic: "سُبْحَانَ اللَّهِ", transliteration: "SubhanAllah", translation: "Gloire à Allah", repeat: "33 fois" },
      { id: "as4", arabic: "الْحَمْدُ لِلَّهِ", transliteration: "Alhamdulillah", translation: "Louange à Allah", repeat: "33 fois" },
      { id: "as5", arabic: "اللَّهُ أَكْبَرُ", transliteration: "Allahu Akbar", translation: "Allah est le plus Grand", repeat: "33 fois" },
      { id: "as6", arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ", transliteration: "La ilaha illa Allah, wahdahu la charika lah, lahul-mulku wa lahul-hamdu, wa houwa 'ala koulli chay'in qadir", translation: "Il n'y a de divinité qu'Allah, Seul sans associé. À Lui la royauté, à Lui la louange, et Il est Omnipotent.", note: "Le 100ème — Clôture du Tasbih" },
      { id: "as7", arabic: "آية الكرسي — اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...", transliteration: "Ayatul Kursi — Allahu la ilaha illa Huwal-Hayyul-Qayyum...", translation: "Le Verset du Trône (Al-Baqara 2:255). Celui qui le lit après chaque prière, rien ne l'empêche d'entrer au Paradis sinon la mort.", note: "🛡️ Protection suprême" },
      { id: "as8", arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ", transliteration: "Qul Huwa Allahu Ahad / Qul A'udhu bi Rabbil-Falaq / Qul A'udhu bi Rabbin-Nas", translation: "Al-Ikhlas, Al-Falaq et An-Nas — Les 3 Protectrices.", note: "1 fois (3 fois après Fajr et Maghrib)" },
    ],
  },
  {
    category: "Coucher",
    icon: "🌙",
    items: [
      { id: "co1", arabic: "الوضوء قبل النوم", transliteration: "Al-Woudou qabl an-nawm", translation: "Faire ses ablutions avant de dormir (dormir en état de pureté).", note: "💧 Première étape" },
      { id: "co2", arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ", transliteration: "Qul Huwa Allahu Ahad / Qul A'udhu bi Rabbil-Falaq / Qul A'udhu bi Rabbin-Nas", translation: "Joindre les mains, souffler dedans, réciter les 3 Protectrices, puis passer les mains sur tout le corps.", repeat: "3 fois", note: "🤲 Le Rituel des Mains" },
      { id: "co3", arabic: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...", transliteration: "Ayatul Kursi", translation: "Pour avoir un gardien d'Allah toute la nuit.", note: "🛡️ 1 fois" },
      { id: "co4", arabic: "سُبْحَانَ اللَّهِ (٣٣) ۝ الْحَمْدُ لِلَّهِ (٣٣) ۝ اللَّهُ أَكْبَرُ (٣٤)", transliteration: "SubhanAllah (33) / Alhamdulillah (33) / Allahu Akbar (34)", translation: "Le Tasbih de Fatima — Recommandé par le Prophète ﷺ à sa fille Fatima.", note: "✨ Tasbih de Fatima" },
      { id: "co5", arabic: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", transliteration: "Bismika Allahumma amoutu wa ahya", translation: "C'est en Ton nom, ô Allah, que je meurs et que je vis.", note: "💤 Dernière parole avant de dormir" },
    ],
  },
  {
    category: "Stratégiques",
    icon: "🚀",
    items: [
      { id: "st1", arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ وَالْعَجْزِ وَالْكَسَلِ وَالْبُخْلِ وَالْجُبْنِ وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ", transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal, wal-bukhli wal-jubn, wa dala'id-dayni wa ghalabatir-rijal", translation: "Ô Allah, je cherche protection auprès de Toi contre l'anxiété, la tristesse, l'impuissance, la paresse, l'avarice, la lâcheté, le fardeau des dettes et la domination des hommes.", note: "⚔️ Contre le stress et la paresse" },
      { id: "st2", arabic: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا", transliteration: "Allahumma la sahla illa ma ja'altahu sahlan, wa Anta taj'alul-hazna idha chi'ta sahlan", translation: "Ô Allah, rien n'est facile sauf ce que Tu rends facile, et Tu peux rendre la difficulté facile si Tu le veux.", note: "📚 Pour faciliter une tâche difficile" },
      { id: "st3", arabic: "اللَّهُمَّ اجْعَلْنِي خَيْرًا مِمَّا يَظُنُّونَ وَاغْفِرْ لِي مَا لَا يَعْلَمُونَ وَلَا تُؤَاخِذْنِي بِمَا يَقُولُونَ", transliteration: "Allahoumma j'alni khayran mimma yadhunnun, wa-ghfir li ma la ya'lamun, wa la tu'akhidhni bima yaqulun", translation: "Ô Allah, fais que je sois meilleur que ce qu'ils pensent de moi, pardonne-moi ce qu'ils ignorent, et ne me tiens pas rigueur de ce qu'ils disent.", note: "🤲 L'invocation d'humilité (Abou Bakr)" },
    ],
  },
  {
    category: "Matin",
    icon: "☀️",
    items: [
      { id: "ma1", arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ", transliteration: "Asbahna wa asbahal-mulku lillah, wal-hamdulillah", translation: "Nous voilà au matin et la royauté appartient à Allah, et la louange est à Allah.", note: "📚 Muslim" },
      { id: "ma2", arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ", transliteration: "Allahumma bika asbahna wa bika amsayna, wa bika nahya wa bika namutu wa ilaykan-nushur", translation: "Ô Allah, c'est par Toi que nous atteignons le matin et le soir, par Toi que nous vivons et mourons, et vers Toi est la résurrection.", note: "📚 Tirmidhi" },
      { id: "ma3", arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", transliteration: "Allahumma inni as'alukal-'afiyata fid-dunya wal-akhira", translation: "Ô Allah, je Te demande le bien-être dans ce monde et dans l'au-delà.", note: "📚 Ibn Majah" },
    ],
  },
  {
    category: "Soir",
    icon: "🌆",
    items: [
      { id: "so1", arabic: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ", transliteration: "Amsayna wa amsal-mulku lillah, wal-hamdulillah", translation: "Nous voilà au soir et la royauté appartient à Allah, et la louange est à Allah.", note: "📚 Muslim" },
      { id: "so2", arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", transliteration: "A'udhu bi kalimatillahit-tammati min sharri ma khalaq", translation: "Je cherche refuge dans les paroles parfaites d'Allah contre le mal de ce qu'Il a créé.", note: "📚 Muslim" },
    ],
  },
  {
    category: "Protection",
    icon: "🛡️",
    items: [
      { id: "pr1", arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", transliteration: "Bismillahilladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim", translation: "Au nom d'Allah, avec le nom de Qui rien ne peut nuire sur terre ni dans le ciel, et Il est l'Audient, l'Omniscient.", repeat: "3 fois matin et soir", note: "📚 Abu Dawud" },
      { id: "pr2", arabic: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ", transliteration: "Hasbiyallahu la ilaha illa Huwa, 'alayhi tawakkaltu wa Huwa Rabbul-'Arshil-'Adhim", translation: "Allah me suffit, il n'y a de divinité que Lui, à Lui je m'en remets et Il est le Seigneur du Trône immense.", repeat: "7 fois matin et soir", note: "📚 Abu Dawud" },
    ],
  },
];

export default function DuaContent() {
  const [activeCategory, setActiveCategory] = useState(DUAS[0].category);
  const [customDuas, setCustomDuas] = useState<Dua[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDua, setNewDua] = useState({ arabic: "", transliteration: "", translation: "", note: "" });

  const current = useMemo(() => DUAS.find(d => d.category === activeCategory), [activeCategory]);

  const addCustomDua = useCallback(() => {
    if (!newDua.arabic.trim() || !newDua.translation.trim()) {
      toast.error("Remplis au moins l'arabe et la traduction.");
      return;
    }
    const dua: Dua = {
      id: `custom-${Date.now()}`,
      ...newDua,
    };
    setCustomDuas(prev => [...prev, dua]);
    setNewDua({ arabic: "", transliteration: "", translation: "", note: "" });
    setShowAddModal(false);
    vibrate(30);
    toast.success("Dua ajoutée ✨");
  }, [newDua]);

  const deleteCustomDua = useCallback((id: string) => {
    setCustomDuas(prev => prev.filter(d => d.id !== id));
    toast.info("Dua supprimée");
  }, []);

  const allItems = useMemo(() => {
    const base = current?.items || [];
    return [...base, ...customDuas];
  }, [current, customDuas]);

  return (
    <div className="space-y-5">
      {/* Category selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DUAS.map(d => (
          <motion.button
            key={d.category}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setActiveCategory(d.category); vibrate(10); }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeCategory === d.category
                ? "bg-primary/20 border border-primary text-primary"
                : "glass text-muted-foreground"
            }`}
          >
            <span>{d.icon}</span>
            {d.category}
          </motion.button>
        ))}
      </div>

      {/* Add custom dua */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowAddModal(true)}
        className="w-full py-2 rounded-xl glass border border-dashed border-primary/30 text-xs text-primary font-semibold"
      >
        + Ajouter une Dua personnalisée
      </motion.button>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <p className="text-sm font-display font-semibold text-foreground">Nouvelle Dua</p>
            <textarea
              placeholder="Texte arabe (avec Tachkil)"
              value={newDua.arabic}
              onChange={e => setNewDua(p => ({ ...p, arabic: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
              rows={2}
              dir="rtl"
            />
            <input
              placeholder="Translitération phonétique"
              value={newDua.transliteration}
              onChange={e => setNewDua(p => ({ ...p, transliteration: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <input
              placeholder="Traduction française"
              value={newDua.translation}
              onChange={e => setNewDua(p => ({ ...p, translation: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <input
              placeholder="Note (optionnel)"
              value={newDua.note}
              onChange={e => setNewDua(p => ({ ...p, note: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={addCustomDua}
                className="flex-1 py-2 rounded-lg bg-primary/20 text-primary text-xs font-semibold">
                ✓ Ajouter
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 rounded-lg bg-secondary/50 text-muted-foreground text-xs">
                Annuler
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dua cards */}
      <div className="space-y-3">
        {allItems.map((dua, i) => (
          <motion.div
            key={dua.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5 space-y-3 glow-border-gold group"
          >
            <p className="text-right text-xl font-display text-accent leading-[2.2]" dir="rtl">
              {dua.arabic}
            </p>
            <p className="text-sm text-primary font-medium italic">{dua.transliteration}</p>
            <p className="text-sm text-foreground/80">{dua.translation}</p>
            <div className="flex items-center justify-between pt-1">
              {dua.note && <span className="text-[10px] text-muted-foreground">{dua.note}</span>}
              <div className="flex items-center gap-2">
                {dua.repeat && (
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">
                    🔁 {dua.repeat}
                  </span>
                )}
                {dua.id.startsWith("custom-") && (
                  <button onClick={() => deleteCustomDua(dua.id)} className="text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
