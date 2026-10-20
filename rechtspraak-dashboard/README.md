# Rechtspraak Inzicht

Nederlands dashboard voor de openbare XML-API van Rechtspraak.nl. Backend en frontend staan samen in `worker/index.js` en hebben geen npm-afhankelijkheden.

## Functies
- Datumselectie op uitspraakdatum, expliciete ophaalknop en paginering van de volledige selectie.
- Rechtsgebieden uit officiële metadata met filters.
- Gemiddelde, minimum en maximum van herkende voorwaardelijke en onvoorwaardelijke gevangenisstraffen in maanden.
- Tbs als afzonderlijke maatregel, zonder fictieve vaste duur.
- Individuele uitspraakteksten, bronlinks, zoeken en CSV-export.
- Zichtbare melding bij een gedeeltelijke dataset.

## Draaien op Cloudflare Workers

Vanuit deze map: `npx wrangler dev` voor lokale ontwikkeling en `npx wrangler deploy` voor publicatie. Een Cloudflare-account is nodig voor publicatie. `wrangler.jsonc` wijst naar de zelfstandige Worker. De productieversie wordt ook via ChatGPT Sites aangeboden.

## API

`GET /api/search?start=2026-10-15&end=2026-10-15&offset=0`

`GET /api/content?id=ECLI:NL:...`

De proxy accepteert uitsluitend deze twee upstream-endpoints en valideert datums en ECLI’s. Zoekpagina’s bevatten maximaal 50 resultaten. De browser haalt documenten achtereenvolgens op, met 150 ms pauze. De upstream-cache heeft 5 minuten TTL voor zoeken en 24 uur voor inhoud.

## Betrouwbaarheid

Strafherkenning is een beperkte, verkennende regelgebaseerde extractie uit het beslissingsgedeelte, geen gevalideerde juridische annotatie. Alleen één numeriek geformuleerde gevangenisstraf wordt verwerkt. Afwijkende of meervoudige straffen kunnen ontbreken of verkeerd worden geïnterpreteerd. Controleer steeds de officiële uitspraak. Onbekend is geen nul. Dagen worden naar maanden omgerekend met 365,25/12; jaren met 12 maanden. Levenslang, taakstraf, boetes, hechtenis en jeugddetentie worden niet in de duurstatistieken opgenomen. Tbs kent hier geen gemiddelde/minimale/maximale duur. Onderwerpen zijn rechtsgebieden, geen automatisch afgeleide delictclassificatie.

Bron en documentatie: https://www.rechtspraak.nl/uitspraken/open-data

Dit is een onafhankelijk dashboard en geen officiële toepassing van de Rechtspraak.
