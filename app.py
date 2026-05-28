from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    message: str

# DATABASE RISCHI AETERNA™

danger_words = {

# URGENZA
"urgente":20,
"subito":15,
"immediato":15,
"adesso":10,
"ultima possibilità":20,
"scadenza":15,
"entro oggi":20,
"bloccato":25,
"sospeso":25,
"verifica urgente":30,

# SOLDI
"bonifico":35,
"pagamento":20,
"transazione":20,
"iban":40,
"conto":20,
"wallet":30,
"bitcoin":40,
"btc":35,
"crypto":35,
"ricarica":30,
"poste pay":35,
"paypal":20,
"carta":25,
"mastercard":20,
"visa":20,
"commissione":15,

# ISTITUZIONI
"poste italiane":40,
"inps":35,
"agenzia entrate":40,
"banca":20,
"amazon":15,
"paypal sicurezza":30,
"ministero":20,
"europol":25,

# DATI PERSONALI
"otp":45,
"password":35,
"codice":20,
"pin":40,
"cvv":45,
"documento":20,
"identità":20,
"accesso":15,
"account":15,
"verifica account":30,

# MINACCE
"denuncia":25,
"tribunale":25,
"polizia":20,
"procedimento":20,
"multa":20,
"violazione":15,
"arresto":35,

# PHISHING
"clicca qui":40,
"link":20,
"http":35,
"https":20,
"www":20,
"tracking":20,
"pacco":20,
"spedizione":20,
"corriere":20,
"dhl":20,
"ups":20,
"fedex":20,

# PSICOLOGIA
"regalo":15,
"vincita":25,
"premio":20,
"fortunato":15,
"offerta":10,
"gratis":15,
"cashback":15,

# SEXTORTION
"video privato":50,
"webcam":30,
"registrato":40,
"diffonderemo":50,
"pagaci":40,
"ricatto":50,

# RECOVERY SCAM
"recupero fondi":35,
"wallet bloccato":40,
"sbloccare conto":40,

# ALTRO
"telegram":15,
"whatsapp":10,
"contattaci":15,
"numero verde":15,
"servizio clienti":10

}

@app.get("/")
def home():
    return {
        "status":"online",
        "motore":"AETERNA Civil Shield™"
    }

@app.post("/scan")
def scan(req: ScanRequest):

    text = req.message.lower()

    score = 0
    found = []

    for word, value in danger_words.items():
        if word in text:
            score += value
            found.append(word)

    # NUMERI TELEFONO
    if re.search(r"\+?\d{8,}", text):
        score += 25
        found.append("numero telefono")

    # IMPORTI EURO
    if re.search(r"\d+\s?(euro|€)", text):
        score += 30
        found.append("importo denaro")

    # LINK
    if re.search(r"http[s]?://", text):
        score += 35
        found.append("link web")

    # EMAIL
    if re.search(r"\S+@\S+\.\S+", text):
        score += 15
        found.append("email")

    # IBAN
    if re.search(r"[A-Z]{2}\d{2}[A-Z0-9]{11,30}", text):
        score += 50
        found.append("iban")

    if score >= 90:
        rischio = "ALTISSIMO RISCHIO"
    elif score >= 60:
        rischio = "ALTO RISCHIO"
    elif score >= 35:
        rischio = "RISCHIO MEDIO"
    else:
        rischio = "BASSO RISCHIO"

    return {

        "rischio": rischio,
        "threat_score": min(score,100),
        "analisi": found,
        "motore":"AETERNA Civil Shield™ AI Engine",
        "disclaimer":"Analisi automatizzata basata su pattern comportamentali, phishing detection e indicatori cyber euristici."

    }
