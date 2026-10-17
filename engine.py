"""Bounded multilingual heuristic. No URLs are opened, no content is retained.

The score is a rule index, NOT a calibrated probability of fraud or safety.
No finding returns a raw excerpt. Rule IDs are translated by the frontend.
"""
import asyncio
import re
import time
import unicodedata


ENGINE = "AETERNA Civil Shield / heuristic-2026-10-17"


class ScanCancelled(Exception):
    pass


class ScanTimedOut(Exception):
    pass


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(c))


def pattern(value):
    return re.compile(value, re.IGNORECASE)


PATTERNS = {
    "urgency": pattern(r"\b(?:urgente?|urgent|immediat\w*|subito|entro oggi|ultima possibilita|last chance|act now|within 24 hours|aujourd.hui|derniere chance|ahora|hoy mismo|ultima oportunidad|agora|hoje|ultima chance)\b"),
    "credential": pattern(r"\b(?:password|passcode|mot de passe|contrasena|senha|otp|pin|cvv|codice di sicurezza|security code|code de securite|codigo de seguridad|codigo de seguranca)\b"),
    "request": pattern(r"\b(?:invia\w*|comunica\w*|fornisci|inserisci|digita|conferma|send|share|enter|provide|confirm|envoy\w*|saisis\w*|communiqu\w*|envi\w*|introdu\w*|compart\w*|fornec\w*|digit\w*)\b"),
    "money": pattern(r"\b(?:bonifico|pagamento|paga|pagare|transfer|payment|pay|virement|paiement|payer|transferencia|pago|pagar|pagamento|pix|ricarica|recharge|recarga)\b"),
    "threat": pattern(r"\b(?:sospes\w*|bloccat\w*|chiusura|suspended|blocked|closure|suspendu\w*|bloqu\w*|fermeture|suspendid\w*|suspens\w*|encerramento)\b"),
    "prize": pattern(r"\b(?:hai vinto|vincita|premio|you won|winner|prize|gagne|gagnant|prix|has ganado|ganador|voce ganhou|ganhou|premio)\b"),
    "crypto": pattern(r"\b(?:bitcoin|btc|crypto|criptovalut\w*|cryptomonnaie\w*|criptomoned\w*|criptomoed\w*|gift card|carte regalo|cartes cadeaux|tarjetas regalo|cartoes presente)\b"),
    "extortion": pattern(r"\b(?:ricatto|diffonder\w*|video privato|sextortion|blackmail|private video|chantage|video privee?|extorsion|video privado|chantagem|extorsao)\b"),
    "recovery": pattern(r"\b(?:recupero fondi|recuperare i fondi|recover your funds|fund recovery|recuperation de fonds|recuperar (?:tus |sus |os )?fondos|recuperacao de fundos)\b"),
    "remote": pattern(r"\b(?:anydesk|teamviewer|rustdesk|accesso remoto|remote access|acces a distance|acceso remoto|acesso remoto)\b"),
    "secret": pattern(r"\b(?:non dirlo|mantieni il segreto|non parlarne|keep (?:it |this )?secret|do not tell|don.t tell|ne (?:le )?dis (?:a )?personne|no (?:se lo )?digas|mantenha segredo|nao conte)\b"),
    "authority": pattern(r"\b(?:banca|bank|banque|banco|polizia|police|policia|inps|agenzia (?:delle )?entrate|poste italiane|amazon|paypal|microsoft|apple)\b"),
    "advice": pattern(r"\b(?:non (?:ti )?(?:chiedera|chiediamo|condividere|inviare|comunicare)|mai (?:condividere|inviare|comunicare)|never (?:share|send|provide|ask)|will never ask|ne (?:communiquez|partagez|demande) jamais|nunca (?:compartas|envies|pedira|partilhe|envie|solicita)|nao (?:partilhe|envie|compartilhe))\b"),
    "short_url": pattern(r"\b(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|rb\.gy|is\.gd)/"),
    "link": pattern(r"(?:https?://|\bwww\.)[^\s<>\"']{1,2048}"),
    "iban": pattern(r"\b[a-z]{2}[0-9]{2}(?:[ ]?[a-z0-9]){11,30}\b"),
}

# Sentence/contrast boundaries prevent a genuine warning in one clause from
# whitelisting an unrelated credential request elsewhere in the message. This
# remains a bounded rule, not semantic understanding or a guarantee.
CLAUSE_BREAKS = pattern(r"[.!?;\r\n]+|\b(?:ma|but|however|mais|pourtant|pero|sin embargo|mas|porem|contudo)\b")


async def analyze(message, cancel_event, deadline, disconnected=None):
    text = normalize(message)
    found = []
    flags = {}
    clauses = []
    clause = ""
    try:
        for name, rule in PATTERNS.items():
            if cancel_event.is_set():
                raise ScanCancelled()
            if time.monotonic() >= deadline:
                raise ScanTimedOut()
            if disconnected is not None and await disconnected():
                cancel_event.set()
                raise ScanCancelled()
            flags[name] = bool(rule.search(text))
            await asyncio.sleep(0)  # Cancellation can run between bounded steps.

        def add(key, points):
            found.append({"key": key, "points": points})

        credential_request = False
        credential_reference = False
        clauses = CLAUSE_BREAKS.split(text)
        for index, clause in enumerate(clauses):
            if index % 64 == 0:
                if cancel_event.is_set():
                    raise ScanCancelled()
                if time.monotonic() >= deadline:
                    raise ScanTimedOut()
                if disconnected is not None and await disconnected():
                    cancel_event.set()
                    raise ScanCancelled()
                await asyncio.sleep(0)
            if not PATTERNS["credential"].search(clause) or PATTERNS["advice"].search(clause):
                continue
            credential_reference = True
            if PATTERNS["request"].search(clause):
                credential_request = True
        if credential_request:
            add("credential_request", 40)
        elif credential_reference:
            add("credential_reference", 8)
        if flags["urgency"]:
            add("urgency", 12)
        if flags["threat"] and flags["urgency"]:
            add("account_pressure", 18)
        if flags["money"] and (flags["urgency"] or flags["threat"]):
            add("payment_pressure", 25)
        if flags["prize"] and flags["money"]:
            add("prize_payment", 30)
        if flags["crypto"] and flags["money"]:
            add("irreversible_payment", 25)
        if flags["extortion"]:
            add("extortion", 40)
        if flags["recovery"] and flags["money"]:
            add("fund_recovery", 25)
        if flags["remote"] and flags["request"]:
            add("remote_access", 35)
        if flags["secret"]:
            add("secrecy", 15)
        if flags["authority"] and (flags["threat"] or credential_request):
            add("authority_pressure", 15)
        if flags["short_url"]:
            add("shortened_link", 12)
        # HTTPS on its own is not a fraud indicator. No network lookup occurs.
        if flags["link"] and (flags["urgency"] or credential_reference):
            add("link_with_pressure", 15)
        if flags["iban"] and flags["money"]:
            add("bank_details", 8)
        score = min(100, sum(item["points"] for item in found))
        band = "high" if score >= 60 else "medium" if score >= 30 else "low"
        recommendations = ["verify_independently", "do_not_share_secrets"]
        if any(item["key"] in ("payment_pressure", "prize_payment", "irreversible_payment", "fund_recovery", "bank_details") for item in found):
            recommendations.append("pause_payment")
        if flags["link"] or flags["remote"]:
            recommendations.append("avoid_links_and_remote_access")
        if flags["extortion"]:
            recommendations.append("seek_qualified_help")
        if not found:
            recommendations.append("absence_is_not_safety")
        if cancel_event.is_set():
            raise ScanCancelled()
        return {
            "score": score, "band": band, "indicators": found,
            "recommendations": recommendations, "engine": ENGINE,
            "limitations": ["heuristic_not_probability", "no_sender_or_link_verification", "text_only_no_guarantee"],
        }
    finally:
        # Reference release is NOT a certified physical RAM overwrite.
        text = ""
        message = ""
        clause = ""
        clauses.clear()
        flags.clear()
