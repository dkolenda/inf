# Wyglądy ludzika Pivot Animatora

Źródłem geometrii jest `generate-skins.js`. Skrypt zapisuje trzy arkusze SVG, a `build-skins.js` renderuje z nich docelowe pliki PNG przez lokalny Chrome/Edge.

Uruchomienie z katalogu głównego projektu:

```powershell
node assets/pivot-skins/src/build-skins.js
```

Walidację gotowych plików można też uruchomić osobno:

```powershell
node assets/pivot-skins/src/validate-skins.js
```

`test-skins.html` ładuje bezpośrednio `pivot-animator.js`, więc pozy testowe są rysowane przez właściwą funkcję `drawPivotSkinPart`. Ostatnia kolumna nakłada na każdy arkusz canvas zwrócony przez `pivotSkinTemplate()` oraz czytelne osie i punkty z `PIVOT_SKIN_PARTS`.

