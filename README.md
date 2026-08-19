# wedding-kada 💍

Svatební web Kateřina & Jakub. Postavený na Next.js.

Tento návod je pro úplné začátečníky na **Windows** — provede tě od nuly (žádný GitHub účet, nic nainstalováno) až k tomu, že web upravuješ pomocí Claude a změny nahráváš zpět.

---

## 1. Vytvoř si GitHub účet

1. Jdi na [github.com/signup](https://github.com/signup).
2. Zadej e-mail, heslo, uživatelské jméno.
3. Potvrď e-mail, který ti přijde.

> GitHub = místo, kde je uložený kód tohoto webu. Aby sis mohl(a) nahrávat změny, musí tě vlastník repozitáře pozvat — pošli mu své GitHub uživatelské jméno a on tě přidá v **Settings → Collaborators**. Pozvánku potvrď v e-mailu.

## 2. Nainstaluj Git

Git = nástroj na stahování a nahrávání kódu.

1. Stáhni instalátor z [git-scm.com/download/win](https://git-scm.com/download/win).
2. Spusť ho a všude klikej **Next** (výchozí nastavení je v pořádku).
3. Po instalaci otevři aplikaci **Git Bash** (najdeš ji v nabídce Start) — v ní budeš psát všechny příkazy z tohoto návodu.

Nastav si jméno a e-mail (stejný jako na GitHubu):

```bash
git config --global user.name "Tvoje Jmeno"
git config --global user.email "tvuj@email.cz"
```

## 3. Nainstaluj Node.js

Node.js = prostředí, ve kterém web běží na tvém počítači.

1. Jdi na [nodejs.org](https://nodejs.org).
2. Stáhni **LTS** verzi (Windows Installer) a nainstaluj (klikej „Next").
3. **Zavři a znovu otevři Git Bash**, pak ověř:
   ```bash
   node --version
   ```
   Mělo by vypsat něco jako `v22.x.x`.

## 4. Stáhni si projekt

V Git Bash:

```bash
cd ~/Desktop
git clone https://github.com/pro0255/wedding-kada.git
cd wedding-kada
npm install
```

> Git se tě při prvním nahrávání změn zeptá na přihlášení — vyber **Sign in with your browser** a přihlas se GitHub účtem.

## 5. Spusť web u sebe

```bash
npm run dev
```

Otevři v prohlížeči [http://localhost:3000](http://localhost:3000) — vidíš web. Zastavíš ho klávesami **Ctrl+C** v Git Bash.

## 6. Pořiď si Claude a nainstaluj Claude Code

Claude Code = AI asistent v terminálu, který za tebe umí web upravovat.

1. Vytvoř si účet na [claude.ai](https://claude.ai) a kup předplatné **Pro** (v nastavení účtu → Upgrade).
2. Nainstaluj Claude Code — v Git Bash:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
3. Spusť ho **ve složce projektu**:
   ```bash
   cd ~/Desktop/wedding-kada
   claude
   ```
4. Při prvním spuštění se přihlas svým Claude účtem (otevře se prohlížeč).

Teď můžeš česky psát, co chceš změnit, např.: _„Změň datum svatby na hlavní stránce na 12. 9. 2026"_ — Claude to udělá. Změny si zkontroluj na [http://localhost:3000](http://localhost:3000) (musí zároveň běžet `npm run dev` v druhém okně Git Bash).

## 7. Nahraj změny na GitHub

Všechnu práci s gitem (stahování a nahrávání změn) nech na Claudovi — nic neřeš ručně. Až budeš se změnami spokojený(á), napiš Claudovi:

> _„commitni a pushni změny"_

## 8. Než začneš pracovat příště

Nejdřív si stáhni nejnovější verzi (kdyby mezitím měnil někdo jiný) — zase přes Claude:

> _„udělej git pull, ať mám nejnovější verzi"_

---

## Rychlý tahák

| Co chci | Jak |
|---|---|
| Spustit web u sebe | `npm run dev` v Git Bash → [localhost:3000](http://localhost:3000) |
| Otevřít AI asistenta | `claude` v Git Bash (ve složce projektu) |
| Stáhnout nejnovější verzi | napiš Claudovi: _„udělej git pull"_ |
| Nahrát změny | napiš Claudovi: _„commitni a pushni změny"_ |
