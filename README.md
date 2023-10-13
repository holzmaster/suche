# Hässliche Suche
> Volltextsuche für das pr0gramm

Archiviert seit dem 2023-10-13. Keine Lust und Zeit mehr. ¯\\\_(ツ)_/¯

## Setup & Start etc

Zeug runterladen:
```shell
curl -o meili -L https://github.com/meilisearch/MeiliSearch/releases/latest/download/meilisearch-linux-amd64
chmod +x meili

git clone https://github.com/holzmaster/suche suche && pushd $_
pushd server; npm ci; popd
pushd client; npm ci; popd
popd
```

- Datenbank starten:
    - Dev: `./meili --no-analytics true`
    - Produktion `MEILI_MASTER_KEY=lol ./meili --no-analytics true --max-mdb-size 1073741824000 --env production`
- Schema einrichten: `cd suche/server; ./db-setup.js`
- Frontend starten: `cd suche/client; python3 -m http.server` (vorher willst du vielleicht die URL zum API-Endpunkt anpassen)
- Brauchst du nur noch Daten ¯\_(ツ)_/¯

## FAQ
### Kannst du mir die Rohdaten geben?
Nein. Nicht, weil ich nicht will, sondern weil das nicht gewünscht ist.

### Wie bist du an die Daten gekommen?
Langes, passives crawlen und viel Bandbreite. Die Texte aus den Bildern werden mit [Tesseract](https://github.com/tesseract-ocr/tesseract) extrahiert.

Womöglich möchtest du dir diese APIs anschauen:
- .NET: https://github.com/holzmaster/OpenPr0gramm
- C# https://github.com/holzmaster/node-pr0gramm-api
- go: https://github.com/mopsalarm/go-pr0gramm
- Java/Kotlin: https://github.com/mopsalarm/Pr0
- ...oder du hackst dir einfach selbst was zusammen

Achtung: Sind alle nicht auf dem selben stand und auch nicht aktuell.

### Kann man dich kaufen?
Vielleicht! Seriöse Anfragen kannst du mir via PN mitteilen und wir schauen weiter.
