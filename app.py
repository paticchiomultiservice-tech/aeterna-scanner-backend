from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import re

app = FastAPI()

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DIZIONARIO PHISHING
# =========================

PHISHING_WORDS = [

    # soldi / banca
    "bonifico",
    "iban",
    "pagamento",
    "ricarica",
    "wallet",
    "bitcoin",
    "crypto",
    "btc",
    "eth",
    "investimento",
    "guadagno",
    "vincita",
    "commissione",
    "saldo",
    "credito",
    "debito",
    "fattura",
    "conto corrente",
    "carta bloccata",
    "prelievo",
    "paypal",
    "postepay",
    "mastercard",
    "visa",
    "american express",

    # urgenza
    "urgente",
    "immediato",
    "subito",
    "entro oggi",
    "ultima possibilità",
    "azione richiesta",
    "account sospeso",
    "conto sospeso",
    "verifica account",
    "accesso negato",
    "blocco account",
    "blocco carta",
    "sicurezza bancaria",
    "attività sospetta",
    "tentativo di accesso",

    # phishing classico
    "clicca qui",
    "accedi ora",
    "verifica identità",
    "conferma dati",
    "reset password",
    "password",
    "otp",
    "codice sicurezza",
    "codice verifica",
    "sms banca",
    "link sicuro",
    "autenticazione",

    # enti italiani
    "poste italiane",
    "agenzia entrate",
    "inps",
    "ministero",
    "polizia postale",
    "banca intesa",
    "unicredit",
    "paypal assistenza",

    # truffe online
    "gift card",
    "amazon card",
    "steam card",
    "google play card",
    "supporto tecnico",
    "contattaci subito",
    "free money",
    "free gift",
    "premio",
    "hai vinto",
    "congratulazioni",

    # manipolazione
    "non condividere",
    "mantieni segreto",
    "procedura urgente",
    "sei stato selezionato",
    "proteggi il tuo account",
    "evita il blocco",
]

# =========================
# PATTERN PERICOLOSI
# =========================

DANGER_PATTERNS = [

    "urgente",
    "clicca qui",
    "verifica account",
    "blocco account",
    "otp",
    "password",
    "bonifico immediato",
    "conto sospeso",
    "sicurezza bancaria",
    "accesso sospeso",
    "hai vinto",
    "gift card",
    "crypto",
    "bitcoin",
]

# =========================
# ROOT
# =========================

@app.get("/")
def home():

    return {
        "status": "AETERNA Scanner Engine Online"
    }

# =========================
# SCAN
# =========================

@app.post("/scan")
def scan(data: dict):

    text = data.get("text", "").lower()

    score = 0

    findings = []

    # =========================
    # CONTROLLO PAROLE
    # =========================

    for word in PHISHING_WORDS:

        if word in text:

            score += 18

            findings.append(
                f"Keyword sospetta rilevata: {word}"
            )

    # =========================
    # CONTROLLO MANIPOLAZIONE
    # =========================

    for danger in DANGER_PATTERNS:

        if danger in text:

            score += 30

            findings.append(
                f"Manipolazione psicologica: {danger}"
            )

    # =========================
    # CONTROLLO SOLDI
    # =========================

    MONEY_PATTERNS = [

        r"€\s?\d+",
        r"\d+\s?euro",
        r"iban",
        r"bonifico",
        r"ricarica",
        r"pagamento",
        r"btc",
        r"crypto",
    ]

    for pattern in MONEY_PATTERNS:

        if re.search(pattern, text):

            score += 40

            findings.append(
                "Pattern economico sospetto"
            )

    # =========================
    # CONTROLLO LINK
    # =========================

    LINK_PATTERNS = [

        "http://",
        "bit.ly",
        "tinyurl",
        "grabify",
        "t.me",
        ".ru",
    ]

    for link in LINK_PATTERNS:

        if link in text:

            score += 35

            findings.append(
                f"Link sospetto rilevato: {link}"
            )

    # =========================
    # SCORE MASSIMO
    # =========================

    if score > 100:
        score = 100

    # =========================
    # RISCHIO
    # =========================

    risk = "basso"

    if score >= 85:

        risk = "ALTO RISCHIO"

    elif score >= 50:

        risk = "RISCHIO MEDIO"

    elif score >= 20:

        risk = "attenzione"

    # =========================
    # RISPOSTA
    # =========================

    return {

        "rischio": risk,

        "threat_score": score,

        "analisi": findings,

        "motore": "AETERNA Scanner Engine™",

        "disclaimer":
        "Analisi indicativa basata su euristiche e pattern comportamentali."
    }