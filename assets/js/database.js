export const darslar = [
    {
        id: 1,
        t: "1-Modul: Kiberxavfsizlikka Kirish",
        v: "https://youtu.be/BvL4VZTrKQY",
        description: "Kiberxavfsizlik asoslari, axborot xavfsizligi tushunchalari va zamonaviy tahdidlar haqida umumiy tushuncha."
    },
    {
        id: 2,
        t: "2-Modul: Tarmoq Xavfsizligi va Protocollar",
        v: "https://youtu.be/DHIqjfqLTK8",
        description: "Tarmoq arxitekturasi, OSI modeli, TCP/IP protokollari va tarmoqni himoyalash usullari."
    },
    {
        id: 3,
        t: "3-Modul: Etik Hacking va Pentesting",
        v: "https://youtu.be/ME-29s54CE0",
        description: "Zaifliklarni qidirish, tizimga kirish testlari va xavfsizlik teshiklarini aniqlash metodologiyasi."
    },
    {
        id: 4,
        t: "4-Modul: Samsung Galaxy Z Fold 3 Texnologiyasi",
        v: "https://youtu.be/7Ym_E1vP5Ew", 
        description: "Bukun qatlamli ekranlar va Samsungning eng ilg'or texnologiyalari haqida batafsil ma'lumot olamiz."
    },
    {
        id: 5,
        t: "5-Modul: iPhone 13 Pro Max Sharhi",
        v: "https://youtu.be/8M7X1n8U-Yc",
        description: "Apple kompaniyasining eng kuchli smartfoni, uning kamerasi va batareya quvvati imkoniyatlari."
    },
    {
        id: 6,
        t: "6-Modul: O'rgimchaklar Hayoti Sirlari",
        v: "https://youtu.be/2WzM8_YI1kE",
        description: "O'rgimchaklarning turlari, ularning to'r to'qishi va tabiatdagi o'rni haqida qiziqarli darslik."
    },
    {
        id: 7,
        t: "7-Modul: P.I.T Qurilish Asboblari",
        v: "https://youtu.be/j7y3M8_YI1k",
        description: "Perforatorlar va shurpovyurlarni tanlash, ulardan to'g'ri foydalanish bo'yicha mutaxassis maslahati."
    },
    {
        id: 8,
        t: "8-Modul: Teraksoy Tog'lari Sayohati",
        v: "https://youtu.be/WzM8_YI1kE",
        description: "Qirg'izistonning go'zal tabiati, Teraksoy tog'lari va u yerdagi ekstremal sayohat xotiralari."
    }
];

export const testlar = {
    1: [
        { q: "Kiberxavfsizlikning asosiy maqsadi nima?", a: ["Hujum qilish", "Himoyalash", "Dasturlash"], c: "Himoyalash" },
        { q: "Malware nima?", a: ["Foydali dastur", "Zararli dastur", "Antivirus"], c: "Zararli dastur" },
        { q: "Xavfsizlik paroli qanday bo'lishi kerak?", a: ["Faqat raqam", "Murakkab (harf, raqam, belgi)", "Ismingiz"], c: "Murakkab (harf, raqam, belgi)" }
    ],
    2: [
        { q: "IP manzil nima?", a: ["Tarmoq qurilmasining manzili", "Kompyuter paroli", "Sayt nomi"], c: "Tarmoq qurilmasining manzili" },
        { q: "Wi-Fi ni qanday himoyalash kerak?", a: ["Ochiq qoldirish", "WPA2/WPA3 parolini qo'yish", "Parolni aytib berish"], c: "WPA2/WPA3 parolini qo'yish" },
        { q: "HTTP va HTTPS o'rtasidagi farq?", a: ["Rangida", "Xavfsiz ulanishda (SSL)", "Tezligida"], c: "Xavfsiz ulanishda (SSL)" }
    ],
    3: [
        { q: "Etik Hacking nima?", a: ["Qonuniy ravishda tizimni tekshirish", "O'g'rilik qilish", "Faqat sayt buzish"], c: "Qonuniy ravishda tizimni tekshirish" },
        { q: "Phishing qanday hujum turi?", a: ["Tarmoqni uzish", "Aldov orqali ma'lumot olish", "Fayllarni o'chirish"], c: "Aldov orqali ma'lumot olish" },
        { q: "Pentesting nima uchun kerak?", a: ["O'yin o'ynash uchun", "Tizim zaifliklarini topish va tuzatish uchun", "Internetni tezlashtirish uchun"], c: "Tizim zaifliklarini topish va tuzatish uchun" }
    ],
    4: [
        { q: "Samsung Z Fold 3 ning asosiy o'ziga xosligi nima?", a: ["Ekranining bukilishi", "Faqat bitta kamerasi borligi", "Suvga chidamsizligi"], c: "Ekranining bukilishi" },
        { q: "Z Fold 3 da qaysi turdagi ekran ishlatilgan?", a: ["LCD", "Dynamic AMOLED 2X", "IPS"], c: "Dynamic AMOLED 2X" },
        { q: "Ushbu modelda S-Pen ishlatish mumkinmi?", a: ["Yo'q", "Faqat maxsus S-Pen", "Har qanday qalam"], c: "Faqat maxsus S-Pen" }
    ],
    5: [
        { q: "iPhone 13 Pro Max qaysi protsessorda ishlaydi?", a: ["A14 Bionic", "A15 Bionic", "M1"], c: "A15 Bionic" },
        { q: "Ushbu modelda ekran yangilanish chastotasi qancha?", a: ["60 Hz", "90 Hz", "120 Hz (ProMotion)"], c: "120 Hz (ProMotion)" },
        { q: "iPhone 13 Pro Max ning asosiy kamerasi necha megapiksel?", a: ["12 MP", "48 MP", "108 MP"], c: "12 MP" }
    ],
    6: [
        { q: "O'rgimchaklar qaysi guruhga kiradi?", a: ["Hasharotlar", "Bo'g'imoyoqlilar (O'rgimchaksimonlar)", "Sudralib yuruvchilar"], c: "Bo'g'imoyoqlilar (O'rgimchaksimonlar)" },
        { q: "O'rgimchaklar to'ri nimadan tayyorlanadi?", a: ["Paxta", "Oqsil (Ipak tolasiga o'xshash)", "Sintetika"], c: "Oqsil (Ipak tolasiga o'xshash)" },
        { q: "Dunyo bo'yicha o'rgimchaklarning taxminan nechta turi bor?", a: ["100 ta", "10,000 ta", "45,000 dan ortiq"], c: "45,000 dan ortiq" }
    ],
    7: [
        { q: "P.I.T perforatori asosan nima uchun ishlatiladi?", a: ["Daraxt kesish", "Beton va toshni teshish", "Mashina yuvish"], c: "Beton va toshni teshish" },
        { q: "Shurpovyur (buragich) tanlashda nimaga e'tibor berish kerak?", a: ["Faqat rangiga", "Kuchlanish (V) va aylanish kuchiga (Nm)", "Og'irligiga"], c: "Kuchlanish (V) va aylanish kuchiga (Nm)" },
        { q: "Bez shotka (cho'tkasiz) motorlarning afzalligi nima?", a: ["Arzonligi", "Uzoqroq xizmat qilishi va samaradorligi", "Ko'p shovqin qilishi"], c: "Uzoqroq xizmat qilishi va samaradorligi" }
    ],
    8: [
        { q: "Teraksoy tog'lari qaysi davlatda joylashgan?", a: ["O'zbekiston", "Qirg'iziston", "Tojikiston"], c: "Qirg'iziston" },
        { q: "Tog'li hududlarda havo bosimi qanday bo'ladi?", a: ["Yuqori bo'ladi", "Past bo'ladi", "O'zgarmaydi"], c: "Past bo'ladi" },
        { q: "Tog'ga chiqishda eng muhim narsa nima?", a: ["Yaxshi poyabzal va tayyorgarlik", "Faqat telefon", "Ko'p ovqat yeb olish"], c: "Yaxshi poyabzal va tayyorgarlik" }
    ]
};
