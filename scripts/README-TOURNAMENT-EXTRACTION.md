# Extrakce dat turnaje z ITF IPIN

## Problém
Stránka ITF IPIN vyžaduje přihlášení, takže automatická extrakce není možná bez autentizace.

## Řešení

### Varianta 1: Browser Console Script (Doporučeno)

1. Přihlaste se do IPIN na https://ipin.itftennis.com
2. Přejděte na stránku turnaje:
   ```
   https://ipin.itftennis.com/factsheet?tournamentId=f25547bf-5bf7-407a-bd96-142afa09f2bc&circuitId=4a17c0c7-3dd4-4193-b868-dadfdf16732f
   ```
3. Otevřete Developer Console (F12 nebo Cmd+Option+I)
4. Otevřete soubor `extract-tournament-browser.js` a zkopírujte celý obsah
5. Vložte do konzole a stiskněte Enter
6. JSON data budou zobrazena a zkopírována do schránky

### Varianta 2: Node.js s Puppeteer (Pro automatizaci)

Pokud chcete plně automatizovaný proces, můžete použít Puppeteer:

```bash
npm install puppeteer
```

Pak upravte skript pro automatické přihlášení (bude vyžadovat vaše přihlašovací údaje).

## Výstup

Skript vrátí JSON ve formátu:

```json
{
  "tournamentKey": "f25547bf-5bf7-407a-bd96-142afa09f2bc",
  "tournamentName": "Název turnaje",
  "city": "Město",
  "startDate": "DD.MM.YYYY"
}
```

## Poznámky

- Tournament Key je extrahován z URL parametru `tournamentId`
- Název, město a datum jsou extrahovány z obsahu stránky pomocí různých selektorů
- Pokud některá data nejsou nalezena, hodnota bude `null`
