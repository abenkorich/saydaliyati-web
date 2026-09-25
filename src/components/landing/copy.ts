export const locales = ["en", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export type LandingCopy = {
  brand: string;
  tagline: string;
  skip: string;
  nav: string[];
  login: string;
  language: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  cta: string;
  explore: string;
  reassurance: string[];
  preview: string;
  previewHello: string;
  previewTitle: string;
  previewTabs: string[];
  previewStock: string;
  previewMedicine: string[];
  previewStatus: string;
  previewRoutine: string;
  previewNote: string;
  floatingTitle: string;
  floatingText: string;
  promise: string;
  promiseAccent: string;
  promiseText: string;
  features: { title: string; body: string; tag: string }[];
  stepsEyebrow: string;
  stepsTitle: string;
  stepsText: string;
  steps: { title: string; body: string }[];
  privacyEyebrow: string;
  privacyTitle: string;
  privacyBody: string;
  privacyPoints: string[];
  faqEyebrow: string;
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  finalTitle: string;
  finalText: string;
  footerNote: string;
  footer: string;
};
export const copy: Record<Locale, LandingCopy> = {
  en: {
    brand: "Saydaliyati",
    tagline: "All my medicines, in one place.",
    skip: "Skip to content",
    nav: ["Why Saydaliyati", "How it works", "Questions"],
    login: "Open portal",
    language: "Choose language",
    eyebrow: "A LITTLE CARE. EVERY DAY.",
    title: "Your medicines.",
    accent: "A little more organised.",
    description:
      "A calmer way to keep track of what’s in your pharmacy, follow your treatments, and stay close to your everyday care.",
    cta: "Make room for better care",
    explore: "Take a look around",
    reassurance: ["Your pharmacy, together", "Your choices, respected"],
    preview: "Illustrative portal preview",
    previewHello: "A little care, every day",
    previewTitle: "My pharmacy",
    previewTabs: ["Overview", "Treatments"],
    previewStock: "Everything has its place",
    previewMedicine: ["Your everyday medicine", "Your medicine cabinet"],
    previewStatus: "Stock recorded",
    previewRoutine: "Your treatment routine",
    previewNote: "A clear view of your saved schedules.",
    floatingTitle: "One less thing to keep in mind.",
    floatingText: "Your medicines. Your routines. Together.",
    promise: "Less searching.",
    promiseAccent: "More peace of mind.",
    promiseText:
      "Bring the small details of everyday care into one thoughtful space.",
    features: [
      {
        title: "Know what you have.",
        body: "Keep your medicines, quantities and recorded expiry dates together. Find low stock or expired entries in a few taps.",
        tag: "MY PHARMACY",
      },
      {
        title: "Keep your routine in view.",
        body: "Review your existing treatment schedules and record eligible doses as taken or skipped, with a clear confirmation.",
        tag: "YOUR TREATMENTS",
      },
      {
        title: "Stay connected to your care.",
        body: "Find dose reminders in your inbox and choose your notification preferences. Nothing is enabled without your choice.",
        tag: "YOUR REMINDERS",
      },
    ],
    stepsEyebrow: "A SIMPLE PLACE TO START",
    stepsTitle: "A little organisation.\nAn everyday difference.",
    stepsText:
      "Start with what you have. Build a clearer picture, one medicine at a time.",
    steps: [
      {
        title: "Make yourself at home",
        body: "Create your account with an email address or international phone number.",
      },
      {
        title: "Bring your pharmacy together",
        body: "Find a medicine in the catalog and add the quantity, unit and expiry date you know.",
      },
      {
        title: "Keep your care in sight",
        body: "Review your pharmacy, saved treatments and reminder inbox whenever you need them.",
      },
    ],
    privacyEyebrow: "PERSONAL CARE. PERSONAL SPACE.",
    privacyTitle: "Your choices belong to you.",
    privacyBody:
      "Care feels better when you’re in control. Your pharmacy is connected to your account, and reminder preferences are always an explicit choice.",
    privacyPoints: [
      "Private account access",
      "Clear notification choices",
      "No automatic dose recording",
    ],
    faqEyebrow: "A FEW GOOD QUESTIONS",
    faqTitle: "Before you settle in.",
    faqs: [
      {
        question: "What can I do with Saydaliyati?",
        answer:
          "Organise your pharmacy, search the medicine catalog, review existing treatment plans, record eligible doses and read your reminder inbox.",
      },
      {
        question: "Does Saydaliyati provide medical advice?",
        answer:
          "Saydaliyati helps you organise information. It does not diagnose conditions or replace advice from your doctor or pharmacist. Recording a dose does not change your prescribed schedule.",
      },
      {
        question: "How do reminders work?",
        answer:
          "Dose reminders appear in your in-app inbox when enabled. Browser and phone push notifications are not available yet. Other preference choices are saved for future features.",
      },
      {
        question: "Which languages are available?",
        answer:
          "This introduction is available in Arabic, English and French. The patient portal is currently in English.",
      },
    ],
    finalTitle: "A little more clarity.\nA little more care.",
    finalText: "Give your everyday medicines a place of their own.",
    footerNote: "Patient portal currently available in English.",
    footer: "Made for the small acts of everyday care.",
  },
  fr: {
    brand: "Saydaliyati",
    tagline: "Tous mes médicaments, au même endroit.",
    skip: "Aller au contenu",
    nav: ["Pourquoi Saydaliyati", "Comment ça marche", "Questions"],
    login: "Ouvrir le portail",
    language: "Choisir la langue",
    eyebrow: "UN PEU D’ATTENTION. CHAQUE JOUR.",
    title: "Vos médicaments.",
    accent: "Un quotidien plus simple.",
    description:
      "Un espace apaisant pour retrouver votre pharmacie, suivre vos traitements et prendre soin des petits détails du quotidien.",
    cta: "Mieux organiser mon quotidien",
    explore: "Découvrir Saydaliyati",
    reassurance: ["Votre pharmacie réunie", "Vos choix respectés"],
    preview: "Aperçu illustratif du portail",
    previewHello: "Un peu d’attention, chaque jour",
    previewTitle: "Ma pharmacie",
    previewTabs: ["Vue d’ensemble", "Traitements"],
    previewStock: "Chaque chose à sa place",
    previewMedicine: [
      "Votre médicament du quotidien",
      "Votre armoire à pharmacie",
    ],
    previewStatus: "Stock enregistré",
    previewRoutine: "Votre routine de traitement",
    previewNote: "Vos horaires enregistrés, en un coup d’œil.",
    floatingTitle: "Une chose de moins à retenir.",
    floatingText: "Vos médicaments et vos habitudes, réunis.",
    promise: "Moins de recherches.",
    promiseAccent: "Plus de sérénité.",
    promiseText:
      "Les petits détails de votre santé trouvent leur place dans un espace pensé pour vous.",
    features: [
      {
        title: "Sachez ce que vous avez.",
        body: "Regroupez vos médicaments, quantités et dates de péremption renseignées. Retrouvez facilement les stocks faibles ou les produits périmés.",
        tag: "MA PHARMACIE",
      },
      {
        title: "Gardez votre routine en vue.",
        body: "Consultez vos traitements existants et confirmez les prises éligibles comme prises ou sautées, après une confirmation claire.",
        tag: "VOS TRAITEMENTS",
      },
      {
        title: "Restez proche de votre suivi.",
        body: "Retrouvez vos rappels de prise dans votre boîte de réception et choisissez vos préférences. Rien n’est activé sans votre accord.",
        tag: "VOS RAPPELS",
      },
    ],
    stepsEyebrow: "POUR COMMENCER SIMPLEMENT",
    stepsTitle: "Un peu d’organisation.\nUn quotidien plus serein.",
    stepsText:
      "Partez de ce que vous avez. Retrouvez une vue claire, un médicament à la fois.",
    steps: [
      {
        title: "Installez-vous",
        body: "Créez votre compte avec une adresse e-mail ou un numéro de téléphone international.",
      },
      {
        title: "Réunissez votre pharmacie",
        body: "Recherchez un médicament et renseignez sa quantité, son unité et sa date de péremption si vous la connaissez.",
      },
      {
        title: "Gardez votre suivi à portée de main",
        body: "Consultez votre pharmacie, vos traitements enregistrés et vos rappels quand vous en avez besoin.",
      },
    ],
    privacyEyebrow: "VOTRE SANTÉ. VOTRE ESPACE.",
    privacyTitle: "Vos choix vous appartiennent.",
    privacyBody:
      "Prendre soin de soi, c’est aussi garder le contrôle. Votre pharmacie est liée à votre compte et vous choisissez explicitement vos préférences de rappel.",
    privacyPoints: [
      "Accès personnel à votre compte",
      "Préférences clairement choisies",
      "Aucune prise enregistrée automatiquement",
    ],
    faqEyebrow: "QUELQUES BONNES QUESTIONS",
    faqTitle: "Avant de commencer.",
    faqs: [
      {
        question: "Que puis-je faire avec Saydaliyati ?",
        answer:
          "Organiser votre pharmacie, rechercher un médicament, consulter vos traitements existants, enregistrer les prises éligibles et lire vos rappels.",
      },
      {
        question: "Saydaliyati donne-t-il des conseils médicaux ?",
        answer:
          "Saydaliyati vous aide à organiser vos informations. Il ne pose pas de diagnostic et ne remplace pas votre médecin ou votre pharmacien. Enregistrer une prise ne modifie pas votre prescription.",
      },
      {
        question: "Comment fonctionnent les rappels ?",
        answer:
          "Les rappels de prise apparaissent dans votre boîte de réception lorsque vous les activez. Les notifications push sur téléphone et navigateur ne sont pas encore disponibles. Les autres préférences sont conservées pour de futures fonctionnalités.",
      },
      {
        question: "Quelles langues sont disponibles ?",
        answer:
          "Cette présentation est disponible en arabe, en anglais et en français. Le portail patient est actuellement en anglais.",
      },
    ],
    finalTitle: "Un peu plus de clarté.\nUn peu plus d’attention.",
    finalText: "Offrez à vos médicaments du quotidien un espace bien à eux.",
    footerNote: "Le portail patient est actuellement en anglais.",
    footer: "Pour les petits gestes qui prennent soin de vous.",
  },
  ar: {
    brand: "صيدليتي",
    tagline: "كل أدويتي، في مكان واحد.",
    skip: "انتقل إلى المحتوى",
    nav: ["لماذا صيدليتي", "كيف تبدأ", "أسئلة شائعة"],
    login: "الدخول إلى البوابة",
    language: "اختر اللغة",
    eyebrow: "قليل من العناية. كل يوم.",
    title: "أدويتك معًا.",
    accent: "ويومك أكثر ترتيبًا.",
    description:
      "مساحة هادئة تجمع أدويتك، وتساعدك على متابعة علاجاتك والاهتمام بتفاصيل رعايتك اليومية.",
    cta: "ابدأ بتنظيم صيدليتك",
    explore: "اكتشف صيدليتي",
    reassurance: ["صيدليتك في مكان واحد", "خياراتك محلّ احترام"],
    preview: "معاينة توضيحية للبوابة",
    previewHello: "قليل من العناية، كل يوم",
    previewTitle: "صيدليتي",
    previewTabs: ["نظرة عامة", "العلاجات"],
    previewStock: "لكل شيء مكانه",
    previewMedicine: ["دواؤك اليومي", "خزانة أدويتك"],
    previewStatus: "المخزون مسجّل",
    previewRoutine: "روتين علاجك",
    previewNote: "مواعيد علاجك المسجّلة، بنظرة واحدة.",
    floatingTitle: "تفصيل أقل يشغل بالك.",
    floatingText: "أدويتك وروتينك، في مكان واحد.",
    promise: "بحث أقل.",
    promiseAccent: "وراحة بال أكثر.",
    promiseText: "اجمع تفاصيل العناية اليومية في مساحة بسيطة صُمّمت لتناسبك.",
    features: [
      {
        title: "اعرف ما لديك.",
        body: "اجمع أسماء أدويتك وكمياتها وتواريخ صلاحيتها المسجّلة. واعثر بسهولة على المخزون المنخفض أو الأدوية المنتهية الصلاحية.",
        tag: "صيدليتك",
      },
      {
        title: "روتين علاجك أمامك.",
        body: "راجع جداول علاجاتك الحالية، وسجّل الجرعات المؤهّلة على أنها مأخوذة أو متروكة، بعد تأكيد واضح منك.",
        tag: "علاجاتك",
      },
      {
        title: "ابقَ قريبًا من تفاصيل رعايتك.",
        body: "اطّلع على تذكيرات الجرعات في صندوق الوارد واختر تفضيلات الإشعارات. لا يُفعّل شيء دون اختيارك.",
        tag: "تذكيراتك",
      },
    ],
    stepsEyebrow: "بداية بسيطة",
    stepsTitle: "قليل من التنظيم.\nفرق في كل يوم.",
    stepsText: "ابدأ بما لديك، وامنح صيدليتك صورة أوضح، دواءً بعد دواء.",
    steps: [
      {
        title: "أنشئ مساحتك الخاصة",
        body: "أنشئ حسابك باستخدام بريدك الإلكتروني أو رقم هاتفك بالصيغة الدولية.",
      },
      {
        title: "اجمع أدويتك",
        body: "ابحث عن الدواء في الدليل، ثم أضف الكمية والوحدة وتاريخ الصلاحية إن كان معلومًا.",
      },
      {
        title: "تابع رعايتك بسهولة",
        body: "راجع صيدليتك وعلاجاتك المسجّلة وصندوق التذكيرات متى احتجت إليها.",
      },
    ],
    privacyEyebrow: "رعاية شخصية. ومساحة تخصّك.",
    privacyTitle: "خياراتك تبقى لك.",
    privacyBody:
      "تبدأ الراحة حين تكون أنت صاحب القرار. صيدليتك مرتبطة بحسابك، وتفضيلات التذكير لا تُفعّل إلا باختيار صريح منك.",
    privacyPoints: [
      "دخول خاص إلى حسابك",
      "خيارات إشعارات واضحة",
      "لا تسجيل تلقائي للجرعات",
    ],
    faqEyebrow: "أسئلة تستحق الإجابة",
    faqTitle: "قبل أن تبدأ.",
    faqs: [
      {
        question: "ماذا يمكنني أن أفعل مع صيدليتي؟",
        answer:
          "يمكنك تنظيم صيدليتك، والبحث في دليل الأدوية، ومراجعة علاجاتك الحالية، وتسجيل الجرعات المؤهّلة، وقراءة التذكيرات في صندوق الوارد.",
      },
      {
        question: "هل تقدّم صيدليتي نصائح طبية؟",
        answer:
          "تساعدك صيدليتي على تنظيم معلوماتك، ولا تشخّص الحالات أو تحلّ محلّ طبيبك أو الصيدلي. تسجيل الجرعة لا يغيّر جدول علاجك الموصوف.",
      },
      {
        question: "كيف تعمل التذكيرات؟",
        answer:
          "تظهر تذكيرات الجرعات في صندوق الوارد داخل التطبيق عند تفعيلها. إشعارات الهاتف والمتصفح الفورية غير متاحة بعد، وتُحفظ الخيارات الأخرى لميزات مستقبلية.",
      },
      {
        question: "ما اللغات المتاحة؟",
        answer:
          "هذه الصفحة متاحة بالعربية والإنجليزية والفرنسية. أمّا بوابة المريض فهي متاحة حاليًا بالإنجليزية.",
      },
    ],
    finalTitle: "وضوح أكثر.\nوعناية أقرب.",
    finalText: "امنح أدويتك اليومية مكانًا يجمعها.",
    footerNote: "بوابة المريض متاحة حاليًا باللغة الإنجليزية.",
    footer: "من أجل تفاصيل العناية الصغيرة، كل يوم.",
  },
};
