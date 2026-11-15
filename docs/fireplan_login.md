# Inloggen bij Fireplan vanuit een ander programma

Deze handleiding beschrijft de Fireplan-aanmeldflow die Romeo207 momenteel gebruikt. Het gaat om de web-login van Fireplan: een formulier met een tijdelijk CSRF-token, gevolgd door een Fireplan-sessiecookie. De code gebruikt geen OAuth-flow en ontvangt geen `access_token` of `refresh_token`.

De flow is afgeleid van de Romeo207-integratie. Fireplan kan het formulier of de loginpagina wijzigen; controleer bij een wijziging eerst de actuele loginpagina en test de flow met een niet-productieve actie.

## 1. Begrippen: token en sessie

| Begrip | Betekenis in deze flow | Geldigheid en gebruik |
|---|---|---|
| Fireplan-CSRF-token (`_csrf_token`) | Verborgen formulierwaarde die Fireplan bij `GET /fr/login` levert. Romeo207 stuurt die mee in de login-POST. | Tijdelijk en gekoppeld aan de loginpagina/sessie. Vraag een nieuwe waarde op bij iedere nieuwe loginpoging. |
| Fireplan-sessiecookie(s) | Cookies die Fireplan tijdens de HTTP-uitwisseling zet. Ze bewijzen daarna dat de gebruiker is aangemeld. | Bewaar en verstuur ze via dezelfde cookiejar; Fireplan bepaalt wanneer ze verlopen of intrekt. |
| OAuth access-/refresh-token | Niet van toepassing op deze door Romeo207 gebruikte flow. | Verwacht of genereer deze tokens dus niet zelf. |
| Romeo207-CSRF-token | Beschermt de eigen Romeo207-API tegen cross-site requests. Dit is niet het Fireplan-formuliertoken. | Alleen nodig als het andere programma de Romeo207-API gebruikt. |
| Romeo207-sessiecookie | Django-cookie waarmee de browser bij Romeo207 aangemeld blijft. Dit is niet geldig bij Fireplan. | Alleen gebruiken voor Romeo207-verzoeken. |

Een CSRF-token is geen aanmeldbewijs op zichzelf. De geauthenticeerde Fireplan-sessie bestaat uit de cookie(s) in de cookiejar. Hardcode geen cookienamen: Fireplan kan die wijzigen.

## 2. Direct bij Fireplan inloggen

De basis-URL is omgevingsafhankelijk. Romeo207 gebruikt standaard `https://fireplan.firebru2k8.local`, en kan dit aanpassen via `FIREPLAN_BASE_URL`.

De huidige HTTP-volgorde:

1. Maak een nieuwe HTTP-sessie met cookiejar.
2. Vraag `GET {FIREPLAN_BASE_URL}/fr/login` op.
3. Controleer de HTTP-status en zoek in de HTML naar `input[name="_csrf_token"]`.
4. Stuur met dezelfde sessie een formulier-POST naar `/fr/login` met:
   - `auth_login[login]`: Fireplan-gebruikersnaam
   - `auth_login[password]`: Fireplan-wachtwoord
   - `_csrf_token`: de waarde uit het formulier
   - `auth_login[submit]`: `Se connecter`
5. Laat de HTTP-client redirects volgen en behoud alle cookies.
6. Controleer dat de login echt gelukt is door een pagina op te vragen die alleen voor een aangemelde gebruiker beschikbaar is. Romeo207 zoekt de link naar het personeelsdossier op de loginrespons en probeert daarna ook `/fr/`.
7. Gebruik de cookiejar voor verdere Fireplan-verzoeken. Herhaal de loginflow als Fireplan de sessie laat verlopen.

Gebruik een cookiejar van de HTTP-bibliotheek; kopieer de cookies niet handmatig tussen losse requests. Verstuur de Fireplan-cookies alleen naar de geconfigureerde Fireplan-host.

### Python-voorbeeld

Dit voorbeeld volgt de formuliervelden uit Romeo207. Het schrijft het wachtwoord of de cookies niet naar de console. Installeer hiervoor `requests` en `beautifulsoup4` in de omgeving van het programma.

```python
import os
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


def fireplan_login(username: str, password: str) -> requests.Session:
    base_url = os.environ.get(
        "FIREPLAN_BASE_URL",
        "https://fireplan.firebru2k8.local",
    ).rstrip("/")
    login_url = urljoin(base_url + "/", "fr/login")

    session = requests.Session()
    session.headers.update({"User-Agent": "MyProgram/1.0 (Fireplan integration)"})
    # TLS-certificaatvalidatie blijft aan. Gebruik geen verify=False.
    response = session.get(login_url, timeout=12)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    token_field = soup.select_one('input[name="_csrf_token"]')
    if not token_field or not token_field.get("value"):
        session.close()
        raise RuntimeError("Fireplan-loginformulier of CSRF-token ontbreekt.")

    response = session.post(
        login_url,
        data={
            "auth_login[login]": username,
            "auth_login[password]": password,
            "_csrf_token": token_field["value"],
            "auth_login[submit]": "Se connecter",
        },
        timeout=12,
    )
    response.raise_for_status()

    # Romeo207 zoekt een personeelsdossierlink op de loginrespons en
    # probeert daarna ook de startpagina.
    home_url = urljoin(base_url + "/", "fr/")
    home = session.get(home_url, timeout=12)
    home.raise_for_status()
    home_soup = BeautifulSoup(home.text, "html.parser")
    has_personnel_link = any(
        "dossier personnel" in link.get_text(" ", strip=True).casefold()
        for link in home_soup.select("a.nav-link")
    )
    if not has_personnel_link:
        session.close()
        raise RuntimeError("Fireplan heeft de sessie niet aangemeld.")

    return session


# Haal geheimen uit een veilige secret store of omgevingsvariabelen;
# zet ze niet letterlijk in de broncode.
session = fireplan_login(
    os.environ["FIREPLAN_USERNAME"],
    os.environ["FIREPLAN_PASSWORD"],
)
try:
    # Gebruik session.get/post(...) voor volgende Fireplan-verzoeken.
    # Bijvoorbeeld: response = session.get(protected_url, timeout=12)
    pass
finally:
    session.close()
```

De controle op de personeelsdossierlink volgt de huidige Romeo207-implementatie. Als Fireplan de navigatietekst wijzigt, pas de controle aan een andere beschermde resource aan. Een HTTP 200 alleen bewijst niet dat de login gelukt is: Fireplan kan bij een mislukte login ook opnieuw de loginpagina teruggeven.

## 3. Sessie bewaren en opnieuw openen

Een `requests.Session` houdt cookies tijdens de levensduur van het proces bij. Als het programma de sessie over een herstart heen wil bewaren, sla dan alleen de cookiegegevens op in een beschermde secret store of versleutelde database. Bewaar minimaal de velden die nodig zijn om cookies correct te herstellen, zoals naam, waarde, domein, pad, secure-vlag en vervaldatum. De cookiejar van de HTTP-bibliotheek heeft de voorkeur boven het zelf construeren van een `Cookie`-header.

Behandel bewaarde sessiecookies als wachtwoorden: iemand die ze steelt, kan mogelijk als die Fireplan-gebruiker handelen tot Fireplan ze intrekt of laat verlopen. Versleutel ze at rest, beperk toegang, log ze nooit, en verwijder ze bij uitloggen of accountverwijdering. Bewaar geen sessiecookies in broncode, browserlocalStorage, foutmeldingen of gewone logbestanden.

Romeo207 bewaart de Fireplan-cookies en het Fireplan-wachtwoord versleuteld in zijn database met `FIREPLAN_CREDENTIAL_KEY` uit `.env`. Wanneer een bewaarde Fireplan-sessie niet meer geldig is, probeert Romeo207 met het versleutelde wachtwoord opnieuw in te loggen en de cookies te vernieuwen. Een ander programma krijgt die databasegegevens of encryptiesleutel niet automatisch en hoort ze niet uit Romeo207 te kopiëren.

## 4. Als het programma Romeo207 als tussenlaag gebruikt

Als het andere programma alleen via Romeo207 gegevens nodig heeft, kan het bij Romeo207 inloggen en vervolgens Romeo207-API-verzoeken doen. Dat is een andere sessie dan rechtstreeks bij Fireplan aanmelden. Romeo207 voert tijdens de login zelf de Fireplan-authenticatie uit.

Huidige browser/API-stappen:

1. `GET /api/csrf/` op de Romeo207-host. Bewaar de ontvangen cookies en lees `csrfToken` uit het JSON-antwoord.
2. `POST /api/auth/login/` met JSON `{"username":"...", "password":"..."}`. Stuur de cookies uit stap 1 mee en zet de token in de `X-CSRFToken`-header.
3. Bij HTTP 200 is een goedgekeurde gebruiker aangemeld. Bewaar de `sessionid`-cookie en stuur die mee bij volgende API-calls.
4. HTTP 202 met `pendingApproval: true` betekent dat de Fireplan-login gelukt is, maar dat Romeo207-toegang nog door een beheerder moet worden goedgekeurd. Dit is geen aangemelde Romeo207-sessie.
5. HTTP 403 kan betekenen dat het Romeo207-account gedeactiveerd is. HTTP 401 duidt onder meer op ongeldige Fireplan-gegevens of een ontbrekende geldige aanmelding.
6. `POST /api/auth/logout/` beëindigt de Romeo207-sessie; stuur ook bij deze POST een geldige CSRF-token mee.

Bij een same-origin browserclient beheert de browser de cookies. Een server-naar-server-client moet de cookiejar zelf bewaren en de CSRF-token plus cookies meesturen. Deel de Romeo207-sessiecookie niet met Fireplan en de Fireplan-cookies niet met Romeo207-API-routes.

## 5. Fouten en diagnose

- **Geen `_csrf_token` in het formulier:** de loginpagina is veranderd, Fireplan heeft een foutpagina teruggegeven of de verbinding/proxy wijzigde de respons. Stop en inspecteer de HTML veilig; log geen formulierinhoud of tokens.
- **Login geweigerd:** controleer gebruikersnaam, wachtwoord en accountstatus. Romeo207 herkent in de huidige respons de melding `identifiants invalides`.
- **HTTP 200 maar niet ingelogd:** controleer de uiteindelijke URL en de verwachte beschermde pagina. Vertrouw niet alleen op de statuscode.
- **Sessieverval:** Fireplan kan sessiecookies intrekken of laten verlopen. Vraag een nieuwe login aan en vervang de bewaarde cookiejar.
- **TLS- of DNS-fout:** controleer netwerktoegang, DNS en de juiste Fireplan-URL. Romeo207 houdt certificaatketenvalidatie aan; de code schakelt alleen de hostnaamcontrole uit voor de expliciet ingestelde Fireplan-host, omdat de interne certificaatnaam niet overeenkomt met de `.local`-naam. Zet TLS-validatie in een ander programma niet uit met `verify=False`; configureer zo nodig de juiste CA-bundel.
- **403 in Romeo207:** Fireplan-aanmelding kan geslaagd zijn, maar Romeo207-toegang of goedkeuring ontbreekt. Romeo207-toestemming vervangt de Fireplan-autorisaties niet en andersom.

## 6. Beveiligingsregels

- Gebruik HTTPS en behoud certificaatvalidatie.
- Vraag nooit om een Fireplan-wachtwoord als de gebruiker dat niet verwacht; gebruik een veilige invoer of secret store.
- Stop wachtwoorden, CSRF-tokens en cookies niet in logs, telemetry, foutmeldingen, screenshots of repositorybestanden.
- Beperk de toegang en bewaartermijn van wachtwoorden en cookies. Versleutel ze als ze persistent opgeslagen moeten worden.
- Beperk requests en cookies tot de geconfigureerde Fireplan-host; volg geen redirects naar een onverwachte host met inloggegevens.
- Bouw automatische login niet als herhaalde brute-force poging. Respecteer blokkeringen en Fireplan-beleid.
- Gebruik bij voorkeur een officiële Fireplan API of ondersteunde integratiemethode als die beschikbaar is; HTML-formulieren en sessiecookies zijn kwetsbaar voor wijzigingen aan de website.

## Bron in Romeo207

De actuele implementatie staat in `backend/fireplan/client.py` (`authenticate_and_read_profile`, `session_from_profile`), `backend/fireplan/cookies.py`, `backend/accounts/api.py` (Romeo207 API login/CSRF) en `backend/config/settings.py` (Fireplan-host, TLS en cookiebeveiliging).

## Fireplan-module in Pager Asset Management

De module **Beheer → Fireplan** in deze toepassing bewaart het Fireplan-wachtwoord en de cookiejar versleuteld in PostgreSQL met de aparte omgevingssleutel `FIREPLAN_CREDENTIAL_KEY`. Een geldige sessie wordt eerst hergebruikt; alleen wanneer de beschermde startpagina de sessie niet meer bevestigt, meldt de toepassing opnieuw aan. De sleutel wordt niet in de database opgeslagen. Bewaar dezelfde sleutel veilig en herstel die samen met een databaseback-up. Deze module legt de aanmeldbasis; het ophalen en synchroniseren van Fireplan-inventarisgegevens is een volgende stap.

Deze module valideert standaard zowel de certificaatketen als de hostnaam. Voor een interne `.local`-alias met een CA-vertrouwd certificaat voor de canonieke Fireplan-hostnaam kan `FIREPLAN_ALLOW_CERTIFICATE_HOSTNAME_MISMATCH=true` de hostnaamcontrole uitschakelen. De certificaatketen blijft gevalideerd; gebruik deze optie alleen op het vertrouwde interne netwerk.
