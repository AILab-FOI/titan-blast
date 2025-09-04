# titan-blast
> Diplomski rad - Tim Juić

## Opis igre

Titan Blast je dvodimenzionalna kooperativna mrežna igra za više igrača razvijena u TypeScript-u za web preglednike. Igrači se zajedno bore protiv valova vanzemaljskih neprijatelja koristeći različite klase karaktera, svaku s jedinstvenim oružjem i sposobnostima.

Igra koristi klijent-poslužitelj arhitekturu s autorativnim serverom. Igrači se kreću kroz 2D mapu s ortogonalnim pogledom (odozgora), surađuju u obrani te nastoje preživjeti što duže protiv neprestanih napada neprijatelja.

> **⚠️ NAPOMENA:** Ova igra predstavlja proof-of-concept i nije potpuno dovršena. Glavni cilj razvoja bio je implementirati i demonstrirati multiplayer komunikaciju u web pregledniku te istražiti tehnike mrežnih igara u stvarnom vremenu. Igra služi kao tehnološka demonstracija.

## Implementirane glavne funkcionalnosti

### Mrežna komunikacija
- UDP-bazirana komunikacija preko GeckosIO biblioteke za minimalno kašnjenje
- Pouzdana isporuka kritičnih poruka
- Optimizacija mrežnog prometa s delta kompresijom

### Fizička simulacija
- Rapier 2D pogon za realistične sudare i kretanje
- Kretanje na temelju fizičkih sila sa postupnim ubrzavanjem

### Sustav pucanja
- Raycast / hitscan detekcija pogodaka sa vizualnim metcima i animacijom traga metka
- Sustav probijanja metaka kroz neprijatelje s realističnim opadom štete kroz udaljenost
- Različiti tipovi oružja (automatsko, poluautomatsko, sačmarica)

### Umjetna inteligencija
- A* pathfinding algoritam za inteligentno kretanje neprijatelja kroz prepreke
- Različite strategije odabira meta
- Optimizirano da igra može izdržati veći broj neprijatelja

### Klijentska optimizacija
- **Predviđanje na klijentu** - Responzivno kretanje bez čekanja na server
- **Interpolacija** - Glatki prikaz kretanja drugih igrača
- **Kompenzacija kašnjenja** - Fer gameplay unatoč mrežnom kašnjenju

### Grafički prikaz
- PixiJS za visokoperformantni 2D rendering
- Sustav animacija s sprite-ovima
- Dinamička kamera koja prati igrača
- Vizualizacija metaka i tragova

### Sustav mape
- Unaprijed napravljena mapa (nije proceduralno generirana)
- Tile-based mape kreirane u Tiled editoru
- Strujanje mape - učitavanje dijelova prema potrebi
- Organizacija u chunk-ove za optimizaciju

### Autentifikacija i sigurnost
- JWT-bazirana autentifikacija
- Guest opcija za brz pristup
- Asimetrična kriptografija za sigurnost tokena

### Vizualna sučelja i početna stranica
- Početna stranica igre sa tipkama za pokretanje, registraciju, prijavu
- Forme za prijavu, registraciju


## Pokretanje igre lokalno

### Preduvjeti
- Node.js (v20 ili noviji)
- npm (obično instaliran sa nodejs)
- Igra bi trebala raditi i na MacOS I Windows 11 računalima. Ostali OS nisu testirani

### Instalacija i pokretanje

```bash
# Kloniranje repozitorija
git clone https://github.com/AILab-FOI/titan-blast/
cd titan-blast

# Instaliranje dependencies za sve module
npm install
```

### Pokretanje servisa (potrebno 3 terminala)

**1. Pokretanje auth servis (port 3001)**
```bash
cd auth
npm run dev
```

**2. Pokretanje game server (port 8080)**
```bash
cd server  
npm run dev
```

**3. Pokretanje client (port 3000)**
```bash
cd client
npm run dev
```

Igra će biti dostupna na `http://localhost:3000`

## Tehnologije

- **Frontend:** TypeScript, PixiJS, Lit, TailwindCSS
- **Backend:** Node.js, TypeScript, SQLite
- **Komunikacija:** GeckosIO (WebRTC/UDP), WebSockets
- **Fizika:** Rapier 2D (WebAssembly)
- **Pathfinding:** EasyStar.js (A* algoritam)

## Struktura projekta

```
titan-blast/
├── client/          # Frontend aplikacija
├── server/          # Game server logika
├── auth/            # Autentifikacijski servis
├── shared/          # Zajednički kod
```

## Kontrole

- **Kretanje:** WASD ili strelice
- **Pucanje:** Lijevi klik miša
- **Ciljanje:** Miš


