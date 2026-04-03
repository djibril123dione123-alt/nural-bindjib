import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface Dua {
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
      {
        arabic: "أَسْتَغْفِرُ اللَّهَ",
        transliteration: "Astaghfirullah",
        translation: "Je demande pardon à Allah",
        repeat: "3 fois",
      },
      {
        arabic: "اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ",
        transliteration: "Allahoumma Antas-Salam wa minkas-Salam, tabarakta ya dhal-jalali wal-ikram",
        translation: "Ô Allah, Tu es la Paix et de Toi vient la paix. Béni sois-Tu, ô Détenteur de la Majesté et de la Générosité.",
      },
      {
        arabic: "سُبْحَانَ اللَّهِ",
        transliteration: "SubhanAllah",
        translation: "Gloire à Allah",
        repeat: "33 fois",
      },
      {
        arabic: "الْحَمْدُ لِلَّهِ",
        transliteration: "Alhamdulillah",
        translation: "Louange à Allah",
        repeat: "33 fois",
      },
      {
        arabic: "اللَّهُ أَكْبَرُ",
        transliteration: "Allahu Akbar",
        translation: "Allah est le plus Grand",
        repeat: "33 fois",
      },
      {
        arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",
        transliteration: "La ilaha illa Allah, wahdahu la charika lah, lahul-mulku wa lahul-hamdu, wa houwa 'ala koulli chay'in qadir",
        translation: "Il n'y a de divinité qu'Allah, Seul sans associé. À Lui la royauté, à Lui la louange, et Il est Omnipotent.",
        note: "Le 100ème — Clôture du Tasbih",
      },
      {
        arabic: "آية الكرسي — اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...",
        transliteration: "Ayatul Kursi — Allahu la ilaha illa Huwal-Hayyul-Qayyum...",
        translation: "Le Verset du Trône (Al-Baqara 2:255). Celui qui le lit après chaque prière, rien ne l'empêche d'entrer au Paradis sinon la mort.",
        note: "🛡️ Protection suprême",
      },
      {
        arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
        transliteration: "Qul Huwa Allahu Ahad / Qul A'udhu bi Rabbil-Falaq / Qul A'udhu bi Rabbin-Nas",
        translation: "Al-Ikhlas, Al-Falaq et An-Nas — Les 3 Protectrices.",
        note: "1 fois (3 fois après Fajr et Maghrib)",
      },
    ],
  },
  {
    category: "Coucher",
    icon: "🌙",
    items: [
      {
        arabic: "الوضوء قبل النوم",
        transliteration: "Al-Woudou qabl an-nawm",
        translation: "Faire ses ablutions avant de dormir (dormir en état de pureté).",
        note: "💧 Première étape",
      },
      {
        arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
        transliteration: "Qul Huwa Allahu Ahad / Qul A'udhu bi Rabbil-Falaq / Qul A'udhu bi Rabbin-Nas",
        translation: "Joindre les mains, souffler dedans, réciter les 3 Protectrices, puis passer les mains sur tout le corps.",
        repeat: "3 fois",
        note: "🤲 Le Rituel des Mains",
      },
      {
        arabic: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ...",
        transliteration: "Ayatul Kursi",
        translation: "Pour avoir un gardien d'Allah toute la nuit.",
        note: "🛡️ 1 fois",
      },
      {
        arabic: "سُبْحَانَ اللَّهِ (٣٣) ۝ الْحَمْدُ لِلَّهِ (٣٣) ۝ اللَّهُ أَكْبَرُ (٣٤)",
        transliteration: "SubhanAllah (33) / Alhamdulillah (33) / Allahu Akbar (34)",
        translation: "Le Tasbih de Fatima — Recommandé par le Prophète ﷺ à sa fille Fatima.",
        note: "✨ Tasbih de Fatima",
      },
      {
        arabic: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
        transliteration: "Bismika Allahumma amoutu wa ahya",
        translation: "C'est en Ton nom, ô Allah, que je meurs et que je vis.",
        note: "💤 Dernière parole avant de dormir",
      },
    ],
  },
  {
    category: "Stratégiques",
    icon: "🚀",
    items: [
      {
        arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ وَالْعَجْزِ وَالْكَسَلِ وَالْبُخْلِ وَالْجُبْنِ وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ",
        transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan, wal-'ajzi wal-kasal, wal-bukhli wal-jubn, wa dala'id-dayni wa ghalabatir-rijal",
        translation: "Ô Allah, je cherche protection auprès de Toi contre l'anxiété, la tristesse, l'impuissance, la paresse, l'avarice, la lâcheté, le fardeau des dettes et la domination des hommes.",
        note: "⚔️ Contre le stress et la paresse",
      },
      {
        arabic: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا",
        transliteration: "Allahumma la sahla illa ma ja'altahu sahlan, wa Anta taj'alul-hazna idha chi'ta sahlan",
        translation: "Ô Allah, rien n'est facile sauf ce que Tu rends facile, et Tu peux rendre la difficulté facile si Tu le veux.",
        note: "📚 Pour faciliter une tâche difficile",
      },
      {
        arabic: "اللَّهُمَّ اجْعَلْنِي خَيْرًا مِمَّا يَظُنُّونَ وَاغْفِرْ لِي مَا لَا يَعْلَمُونَ وَلَا تُؤَاخِذْنِي بِمَا يَقُولُونَ",
        transliteration: "Allahoumma j'alni khayran mimma yadhunnun, wa-ghfir li ma la ya'lamun, wa la tu'akhidhni bima yaqulun",
        translation: "Ô Allah, fais que je sois meilleur que ce qu'ils pensent de moi, pardonne-moi ce qu'ils ignorent, et ne me tiens pas rigueur de ce qu'ils disent.",
        note: "🤲 L'invocation d'humilité (Abou Bakr)",
      },
    ],
  },
  {
    category: "Matin",
    icon: "☀️",
    items: [
      {
        arabic: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ",
        transliteration: "Asbahna wa asbahal-mulku lillah, wal-hamdulillah",
        translation: "Nous voilà au matin et la royauté appartient à Allah, et la louange est à Allah.",
        note: "📚 Muslim",
      },
      {
        arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ",
        transliteration: "Allahumma bika asbahna wa bika amsayna, wa bika nahya wa bika namutu wa ilaykan-nushur",
        translation: "Ô Allah, c'est par Toi que nous atteignons le matin et le soir, par Toi que nous vivons et mourons, et vers Toi est la résurrection.",
        note: "📚 Tirmidhi",
      },
      {
        arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ",
        transliteration: "Allahumma inni as'alukal-'afiyata fid-dunya wal-akhira",
        translation: "Ô Allah, je Te demande le bien-être dans ce monde et dans l'au-delà.",
        note: "📚 Ibn Majah",
      },
    ],
  },
  {
    category: "Soir",
    icon: "🌆",
    items: [
      {
        arabic: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ",
        transliteration: "Amsayna wa amsal-mulku lillah, wal-hamdulillah",
        translation: "Nous voilà au soir et la royauté appartient à Allah, et la louange est à Allah.",
        note: "📚 Muslim",
      },
      {
        arabic: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
        transliteration: "A'udhu bi kalimatillahit-tammati min sharri ma khalaq",
        translation: "Je cherche refuge dans les paroles parfaites d'Allah contre le mal de ce qu'Il a créé.",
        note: "📚 Muslim",
      },
    ],
  },
  {
    category: "Couple",
    icon: "💞",
    items: [
      {
        arabic: "رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا",
        transliteration: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yunin waj'alna lil-muttaqina imama",
        translation: "Seigneur, accorde-nous en nos épouses et descendants la joie des yeux, et fais de nous un modèle pour les pieux.",
        note: "📖 Coran 25:74",
      },
      {
        arabic: "اللَّهُمَّ بَارِكْ لَهُمَا وَبَارِكْ عَلَيْهِمَا وَاجْمَعْ بَيْنَهُمَا فِي خَيْرٍ",
        transliteration: "Allahumma barik lahuma wa barik 'alayhima wajma' baynahuma fi khayr",
        translation: "Ô Allah, bénis-les, répands Ta bénédiction sur eux et réunis-les dans le bien.",
        note: "📚 Abu Dawud",
      },
    ],
  },
  {
    category: "Protection",
    icon: "🛡️",
    items: [
      {
        arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
        transliteration: "Bismillahilladhi la yadurru ma'asmihi shay'un fil-ardi wa la fis-sama'i wa huwas-Sami'ul-'Alim",
        translation: "Au nom d'Allah, avec le nom de Qui rien ne peut nuire sur terre ni dans le ciel, et Il est l'Audient, l'Omniscient.",
        repeat: "3 fois matin et soir",
        note: "📚 Abu Dawud",
      },
      {
        arabic: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
        transliteration: "Hasbiyallahu la ilaha illa Huwa, 'alayhi tawakkaltu wa Huwa Rabbul-'Arshil-'Adhim",
        translation: "Allah me suffit, il n'y a de divinité que Lui, à Lui je m'en remets et Il est le Seigneur du Trône immense.",
        repeat: "7 fois matin et soir",
        note: "📚 Abu Dawud",
      },
    ],
  },
];

export default function DuaContent() {
  const [activeCategory, setActiveCategory] = useState(DUAS[0].category);

  const current = useMemo(() => DUAS.find(d => d.category === activeCategory), [activeCategory]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {DUAS.map(d => (
          <motion.button
            key={d.category}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory(d.category)}
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

      <div className="space-y-3">
        {current?.items.map((dua, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass rounded-2xl p-5 space-y-3 glow-border-gold"
          >
            <p className="text-right text-xl font-display text-accent leading-[2.2]" dir="rtl">
              {dua.arabic}
            </p>

            <p className="text-sm text-primary font-medium italic">
              {dua.transliteration}
            </p>

            <p className="text-sm text-foreground/80">
              {dua.translation}
            </p>

            <div className="flex items-center justify-between pt-1">
              {dua.note && (
                <span className="text-[10px] text-muted-foreground">{dua.note}</span>
              )}
              {dua.repeat && (
                <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">
                  🔁 {dua.repeat}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
