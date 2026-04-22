export function harfIndeksi(harf) {
    return harf.toUpperCase().charCodeAt(0) - 64;
}

export function indeksdanHarf(indeks, isLower) {
    let m = indeks % 26;
    if (m === 0) m = 26;
    let char = String.fromCharCode(m + 64);
    return isLower ? char.toLowerCase() : char;
}

export function shifrlashVigenere(matn, kalit) {
    let kalitHarflar = kalit.split('').filter(c => /[a-zA-Z]/.test(c)).map(c => c.toUpperCase());
    if (kalitHarflar.length === 0) return { error: "Kalitda kamida 1 ta lotin harfi bo'lishi kerak!" };

    let ustunlar = [];
    let natijaStr = "";
    let kIdx = 0;

    for (let i = 0; i < matn.length; i++) {
        let char = matn[i];
        if (/[a-zA-Z]/.test(char)) {
            let isLower = (char === char.toLowerCase());
            let t_num = harfIndeksi(char);
            let g_char = kalitHarflar[kIdx % kalitHarflar.length];
            let g_num = harfIndeksi(g_char);

            let yigindi = t_num + g_num;
            let mod_val = yigindi % 26;
            if (mod_val === 0) mod_val = 26;

            let c_harf = indeksdanHarf(mod_val, isLower);

            ustunlar.push([char, g_char, t_num, g_num, yigindi, mod_val, c_harf]);
            natijaStr += c_harf;
            kIdx++;
        } else {
            natijaStr += char;
        }
    }
    return { natijaStr, ustunlar, qatorNomlari: ["Ti", "Gi", "Ti(1-26)", "Gi(1-26)", "Ti+Gi", "mod 26", "Ci"] };
}

export function deshifrlashVigenere(matn, kalit) {
    let kalitHarflar = kalit.split('').filter(c => /[a-zA-Z]/.test(c)).map(c => c.toUpperCase());
    if (kalitHarflar.length === 0) return { error: "Kalitda kamida 1 ta lotin harfi bo'lishi kerak!" };

    let ustunlar = [];
    let natijaStr = "";
    let kIdx = 0;

    for (let i = 0; i < matn.length; i++) {
        let char = matn[i];
        if (/[a-zA-Z]/.test(char)) {
            let isLower = (char === char.toLowerCase());
            let c_num = harfIndeksi(char);
            let g_char = kalitHarflar[kIdx % kalitHarflar.length];
            let g_num = harfIndeksi(g_char);

            let farq = c_num - g_num;
            let plus26 = farq + 26;
            let mod_val = plus26 % 26;
            if (mod_val === 0) mod_val = 26;

            let t_harf = indeksdanHarf(mod_val, isLower);

            ustunlar.push([char, g_char, c_num, g_num, farq, plus26, mod_val, t_harf]);
            natijaStr += t_harf;
            kIdx++;
        } else {
            natijaStr += char;
        }
    }
    return { natijaStr, ustunlar, qatorNomlari: ["Ci", "Gi", "Ci(1-26)", "Gi(1-26)", "Ci-Gi", "+26", "mod 26", "Ti"] };
}
