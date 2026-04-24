/**
 * ==========================================
 * ACADEMY TEST - INITIAL DATABASE SEED
 * ==========================================
 */

const initialVideos = [
    { id: 1, title: "1-Dars: Kirish va Asoslar", vidId: "bKpcVgAQYk4" },
    { id: 2, title: "2-Dars: Ma'lumotlar bilan ishlash", vidId: "O6wszVg7DvE" },
    { id: 3, title: "3-Dars: Algoritmlar asoslari", vidId: "fvMA2oGRtVI" },
    { id: 4, title: "4-Dars: Amaliy mashg'ulot", vidId: "wix2CjasiPU" },
    { id: 5, title: "5-Dars: Murakkab mavzular", vidId: "N5QjbVPzTHU" },
    { id: 6, title: "6-Dars: Takrorlash", vidId: "4WaDt5jxHnI" },
    { id: 7, title: "7-Dars: Yangi bosqich", vidId: "OpdCIbpB5x8" },
    { id: 8, title: "8-Dars: Professional yondashuv", vidId: "8X7ao063Anw" },
    { id: 9, title: "9-Dars: Loyiha ustida ishlash", vidId: "ePKiCQjbsUM" },
    { id: 10, title: "10-Dars: Xatolarni tuzatish", vidId: "VoLVFSTbkt4" },
    { id: 11, title: "11-Dars: Optimizatsiya", vidId: "kcC2soyRCpo" },
    { id: 12, title: "12-Dars: Xavfsizlik", vidId: "KfZ_RvKdLvM" },
    { id: 13, title: "13-Dars: Yakuniy qismlar", vidId: "3qJ0cfRNZHk" },
    { id: 14, title: "14-Dars: Imtihon oldi tayyorgarlik", vidId: "xfSu6AnjXt8" },
    { id: 15, title: "15-Dars: Xulosa", vidId: "xKaFrgvX6Qg" }
];

// Savollarni generatsiya qilish (Har bir dars uchun 10 tadan)
function generateQuestions(title) {
    return Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        q: `${title} bo'yicha ${i + 1}-savol: Ushbu darsda o'rganilgan asosiy tushuncha nima?`,
        a: ["To'g'ri javob", "Variant A", "Variant B", "Variant C"],
        c: "To'g'ri javob"
    }));
}

export const defaultData = initialVideos.map(v => ({
    ...v,
    questions: generateQuestions(v.title)
}));
