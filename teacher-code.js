// Kod nauczyciela = godzina i minuta cyframi + dzień i miesiąc literami (0 = A, 1 = B … 9 = J).
// Przykład: 12.10, godz. 00:08 → 0008BCBA.
function teacherCodeAt(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const letters = (value) => pad(value).replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit)));
  return pad(date.getHours()) + pad(date.getMinutes()) + letters(date.getDate()) + letters(date.getMonth() + 1);
}

// Dopuszczamy pomyłkę o minutę w obie strony (np. kod podany tuż przed zmianą minuty).
function isTeacherCodeValid(code, now = new Date()) {
  return [-1, 0, 1].some((offset) => teacherCodeAt(new Date(now.getTime() + offset * 60000)) === code);
}
