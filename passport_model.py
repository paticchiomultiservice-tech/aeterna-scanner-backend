"""Closed organisational profile and service projections; never account rights.

Only finite categories, booleans and bounded timestamps/IDs are accepted. No
free text, customer identity, credentials, scanned content or entitlement field
can be persisted through this schema. Validation errors contain no input.
"""
from datetime import datetime, timezone
import json
import re
import time
from phone_continuity import validate_continuity, PASSPORT_SCHEMAS, GUARD


MAX_PASSPORT_BYTES = 40000
CLIENTS = ("Privato", "Professionista", "Creator / Influencer", "PMI", "Azienda Enterprise")
GOALS = ("protection", "access", "family", "legacy", "business", "ai", "complete")
PHASES = ("map", "access", "recovery", "backup", "verify", "people", "permissions", "legacy", "memory", "review")
STATES = ("todo", "declared", "tested", "review")
PREFERENCES = {"representation": ("undecided", "no_replica", "discuss"),
               "helper": ("undecided", "considered", "review"),
               "agent": ("undecided", "review", "documented")}
SERVICES = ("email", "apple", "google", "microsoft", "bank", "social", "cloud", "business", "other")
ACCESS = ("unknown", "passkey", "password_mfa", "password_only", "provider")
RECOVERY = ("unknown", "same_device", "other_device", "offline", "trusted_contact", "provider")
AGENTS = ("chatgpt", "copilot", "gemini", "claude", "other")
PURPOSES = ("personal", "family", "work", "creative")
ROLE_TYPES = ("partner", "child", "relative", "friend", "colleague", "professional", "other")
ROLE_SCOPES = ("contacts", "access", "archives", "business", "future")
FUTURE_KEYS = ("voice", "face", "style")
EXTRAS = ("digitalLegacy", "continuity", "reputation", "accountRecovery", "familyAccess", "businessContinuity", "creatorProtection", "staffTraining", "brandMonitoring", "executiveShield", "vendorAccessReview", "crisisWarRoom", "boardReport")
COUNTS = ("accountCritici", "social", "emailnum", "siti", "domini", "wallet", "cloud", "dispositivi", "collaboratori", "archiviDocumenti")
DELIVERY_STATES = ("to_agree", "scheduled", "in_progress", "awaiting_customer", "delivered", "cancelled")
DELIVERY_CODES = {
    "base": ("audit", "mapping", "report"),
    "silver": ("audit", "mapping", "report", "accountRecovery"),
    "gold": ("audit", "mapping", "report", "accountRecovery", "reputation", "continuity", "digitalLegacy"),
    "guardian": ("audit", "mapping", "report", "accountRecovery", "reputation", "continuity", "digitalLegacy", "review"),
}
EPOCH = "1970-01-01T00:00:00.000Z"


class PassportSchemaUnsupported(ValueError):
    pass


def invalid():
    raise ValueError("INVALID_ORGANISATIONAL_DATA")


def exact(value, keys):
    if type(value) is not dict or set(value) != set(keys):
        invalid()
    return value


def choice(value, choices):
    if type(value) is not str or value not in choices:
        invalid()
    return value


def boolean(value):
    if type(value) is not bool:
        invalid()
    return value


def integer(value, minimum, maximum):
    if type(value) is not int or not minimum <= value <= maximum:
        invalid()
    return value


def array(value, maximum):
    if type(value) is not list or len(value) > maximum:
        invalid()
    return value


def choices(value, allowed):
    items = [choice(item, allowed) for item in array(value, len(allowed))]
    if len(set(items)) != len(items):
        invalid()
    return [item for item in allowed if item in items]


def timestamp(value, seconds_allowed=False):
    expression = r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    expression += r"(?:\.[0-9]{3})?Z" if seconds_allowed else r"\.[0-9]{3}Z"
    if type(value) is not str or not re.fullmatch(expression, value):
        invalid()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        normalized = parsed.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except ValueError:
        invalid()
    if normalized != (value if "." in value else value[:-1] + ".000Z"):
        invalid()
    return normalized


def at_or_before(value, upper, seconds_allowed=False):
    normalized = timestamp(value, seconds_allowed)
    if normalized > upper:
        invalid()
    return normalized


def item_id(value):
    if type(value) is not str or not re.fullmatch(r"item_[a-z0-9-]{8,40}", value):
        invalid()
    return value


def records(value, maximum, validator):
    result = [validator(item) for item in array(value, maximum)]
    if len({item["id"] for item in result}) != len(result):
        invalid()
    return result


def journey(value):
    exact(value, ("schema", "createdAt", "updatedAt", "clientType", "goals", "phases", "preferences", "diary"))
    choice(value["schema"], ("aeterna.journey.v1",))
    created = timestamp(value["createdAt"], True)
    updated = timestamp(value["updatedAt"], True)
    if updated < created or created < EPOCH:
        invalid()
    exact(value["phases"], PHASES)
    phases = {}
    for key in PHASES:
        row = exact(value["phases"][key], ("status", "updatedAt"))
        status = choice(row["status"], STATES)
        when = row["updatedAt"]
        if when is None:
            if status != "todo":
                invalid()
        else:
            when = at_or_before(when, updated, True)
            if when < created:
                invalid()
        phases[key] = {"status": status, "updatedAt": when}
    exact(value["preferences"], PREFERENCES)
    preferences = {key: choice(value["preferences"][key], allowed) for key, allowed in PREFERENCES.items()}
    diary, latest, previous = [], {}, created
    for row in array(value["diary"], 50):
        exact(row, ("phase", "status", "time"))
        phase, status = choice(row["phase"], PHASES), choice(row["status"], STATES)
        when = at_or_before(row["time"], updated, True)
        if when < previous:
            invalid()
        previous = when
        event = {"phase": phase, "status": status, "time": when}
        latest[phase] = event
        diary.append(event)
    for key, event in latest.items():
        if phases[key] != {"status": event["status"], "updatedAt": event["time"]}:
            invalid()
    return {"schema": "aeterna.journey.v1", "createdAt": created, "updatedAt": updated,
            "clientType": choice(value["clientType"], CLIENTS), "goals": choices(value["goals"], GOALS),
            "phases": phases, "preferences": preferences, "diary": diary}


def inventory(value):
    exact(value, ("id", "service", "access", "recovery", "testedAt"))
    return {"id": item_id(value["id"]), "service": choice(value["service"], SERVICES),
            "access": choice(value["access"], ACCESS), "recovery": choice(value["recovery"], RECOVERY),
            "testedAt": None if value["testedAt"] is None else timestamp(value["testedAt"])}


def delegation(value):
    exact(value, ("id", "agent", "purpose", "read", "draft", "externalAction", "confirmation", "until", "state"))
    if value["confirmation"] is not True:
        invalid()
    until = value["until"]
    if until != "":
        if type(until) is not str or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", until):
            invalid()
        try:
            if datetime.fromisoformat(until).date().isoformat() != until:
                invalid()
        except ValueError:
            invalid()
    return {"id": item_id(value["id"]), "agent": choice(value["agent"], AGENTS),
            "purpose": choice(value["purpose"], PURPOSES), "read": boolean(value["read"]),
            "draft": boolean(value["draft"]), "externalAction": boolean(value["externalAction"]),
            "confirmation": True, "until": until,
            "state": choice(value["state"], ("planned", "declared", "withdrawn"))}


def care(value, upper):
    exact(value, ("roles", "future", "memory", "review"))
    def role(row):
        exact(row, ("id", "role", "scope", "alternate"))
        return {"id": item_id(row["id"]), "role": choice(row["role"], ROLE_TYPES),
                "scope": choice(row["scope"], ROLE_SCOPES), "alternate": boolean(row["alternate"])}
    roles = records(value["roles"], 6, role)
    exact(value["future"], FUTURE_KEYS)
    future = {key: choice(value["future"][key], ("undecided", "avoid", "discuss")) for key in FUTURE_KEYS}
    memory = exact(value["memory"], ("topic", "prepared", "updatedAt"))
    topic = choice(memory["topic"], ("undecided", "photo", "story", "values", "instructions"))
    prepared = boolean(memory["prepared"])
    if prepared and (topic == "undecided" or memory["updatedAt"] is None):
        invalid()
    if not prepared and memory["updatedAt"] is not None:
        invalid()
    when = at_or_before(memory["updatedAt"], upper) if prepared else None
    if when is not None and when < EPOCH:
        invalid()
    review = exact(value["review"], ("cadenceDays", "lastCheckedAt"))
    cadence = integer(review["cadenceDays"], 30, 365)
    if cadence not in (30, 90, 180, 365):
        invalid()
    last = None if review["lastCheckedAt"] is None else at_or_before(review["lastCheckedAt"], upper)
    if last is not None and last < EPOCH:
        invalid()
    return {"roles": roles, "future": future, "memory": {"topic": topic, "prepared": prepared, "updatedAt": when},
            "review": {"cadenceDays": cadence, "lastCheckedAt": last}}


def validate_passport(value):
    if type(value) is not dict:
        invalid()
    if type(value.get("schema")) is str and value["schema"] not in PASSPORT_SCHEMAS:
        raise PassportSchemaUnsupported("WORKSPACE_SCHEMA_UNSUPPORTED")
    schema = choice(value.get("schema"), PASSPORT_SCHEMAS)
    keys = ("schema", "updatedAt", "journey", "inventory", "delegations", "care")
    exact(value, keys + (("continuity",) if schema == "aeterna.passport.v4" else ()))
    upper = timestamp(value["updatedAt"])
    # Match the durable gateway's server clock window exactly. Client clocks
    # may be up to five minutes ahead; arbitrary future proof dates are refused.
    maximum = datetime.fromtimestamp(int(time.time()) + 300, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if upper < EPOCH or upper > maximum:
        invalid()
    path = journey(value["journey"])
    if path["updatedAt"] > upper:
        invalid()
    items = records(value["inventory"], 12, inventory)
    if any(item["testedAt"] and not EPOCH <= item["testedAt"] <= upper for item in items):
        invalid()
    result = {"schema": schema, "updatedAt": upper, "journey": path,
              "inventory": items, "delegations": records(value["delegations"], 8, delegation),
              "care": care(value["care"], upper)}
    if schema == "aeterna.passport.v4":
        result["continuity"] = validate_continuity(value["continuity"], items, upper)
    if len(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")) > MAX_PASSPORT_BYTES:
        invalid()
    return result


def validate_capabilities(value):
    exact(value, ("ok", "passport_schemas", "phone_loss", "transition_guard"))
    if value["ok"] is not True or value["phone_loss"] is not True or value["transition_guard"] != GUARD:
        invalid()
    if type(value["passport_schemas"]) is not list or value["passport_schemas"] != list(PASSPORT_SCHEMAS):
        invalid()
    return {"ok": True, "passport_schemas": list(PASSPORT_SCHEMAS), "phone_loss": True, "transition_guard": GUARD}


def validate_workspace(value):
    exact(value, ("ok", "revision", "passport", "saved_at"))
    if value["ok"] is not True:
        invalid()
    revision = integer(value["revision"], 0, 2147483647)
    if value["passport"] is None:
        if revision != 0 or value["saved_at"] is not None:
            invalid()
        return {"ok": True, "revision": 0, "passport": None, "saved_at": None}
    if revision == 0 or value["saved_at"] is None:
        invalid()
    return {"ok": True, "revision": revision, "passport": validate_passport(value["passport"]),
            "saved_at": timestamp(value["saved_at"])}


def validate_delivery_ledger(value, configuration, submitted, current_time):
    exact(value, ("schema", "revision", "items"))
    if value["schema"] != "aeterna.delivery-ledger.v1":
        invalid()
    revision = integer(value["revision"], 1, 2**31 - 1)
    codes = set(DELIVERY_CODES[configuration["plan"]]) | set(configuration["extras"])
    items, seen = [], set()
    for entry in array(value["items"], len(codes)):
        exact(entry, ("service_code", "state", "responsible", "due_at", "delivered_at",
                      "evidence_reference", "acknowledged_at"))
        code = choice(entry["service_code"], codes)
        state = choice(entry["state"], DELIVERY_STATES)
        name, evidence = entry["responsible"], entry["evidence_reference"]
        if code in seen or (name is not None and (
                type(name) is not str or name != name.strip()
                or not re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'’-]{0,59}", name))):
            invalid()
        seen.add(code)
        due = None if entry["due_at"] is None else timestamp(entry["due_at"])
        delivered = None if entry["delivered_at"] is None else at_or_before(entry["delivered_at"], current_time)
        ack = None if entry["acknowledged_at"] is None else at_or_before(entry["acknowledged_at"], current_time)
        if state not in ("to_agree", "cancelled") and name is None:
            invalid()
        if (state == "scheduled" and due is None) or (due is not None and due < submitted):
            invalid()
        if state == "delivered":
            if (delivered is None or delivered < submitted or type(evidence) is not str
                    or not re.fullmatch(r"DOC-[A-Z0-9][A-Z0-9_-]{3,47}", evidence)
                    or (ack is not None and ack < delivered)):
                invalid()
        elif delivered is not None or evidence is not None or ack is not None:
            invalid()
        items.append(dict(entry))
    return {"schema": value["schema"], "revision": revision, "items": items}


def validate_services(value):
    exact(value, ("ok", "source_available", "orders"))
    if value["ok"] is not True:
        invalid()
    available = boolean(value["source_available"])
    orders, references = [], set()
    current_time = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    order_keys = ("reference", "submitted_at", "state", "configuration", "fulfilment")
    for row in array(value["orders"], 20):
        exact(row, (*order_keys, "delivery_ledger") if type(row) is dict and "delivery_ledger" in row else order_keys)
        reference = row["reference"]
        if type(reference) is not str or not re.fullmatch(r"AO-[A-F0-9]{32}", reference) or reference in references:
            invalid()
        references.add(reference)
        configuration = exact(row["configuration"], ("client", "plan", "profiles", "goals", "extras", "counts"))
        counts = exact(configuration["counts"], COUNTS)
        clean_config = {"client": choice(configuration["client"], CLIENTS),
                        "plan": choice(configuration["plan"], ("base", "silver", "gold", "guardian", "scanner_10")),
                        "profiles": integer(configuration["profiles"], 1, 500),
                        "goals": choices(configuration["goals"], GOALS), "extras": choices(configuration["extras"], EXTRAS),
                        "counts": {key: integer(counts[key], 0, 500) for key in COUNTS}}
        if clean_config["plan"] == "scanner_10":
            if clean_config["profiles"] != 1 or clean_config["extras"] or any(clean_config["counts"].values()):
                invalid()
        business = {"PMI", "Azienda Enterprise"}
        creator = business | {"Creator / Influencer"}
        for extra in clean_config["extras"]:
            if extra in ("businessContinuity", "staffTraining", "brandMonitoring") and clean_config["client"] not in business:
                invalid()
            if extra == "creatorProtection" and clean_config["client"] not in creator:
                invalid()
            if extra in ("executiveShield", "vendorAccessReview", "crisisWarRoom", "boardReport") and clean_config["client"] != "Azienda Enterprise":
                invalid()
            included = ((extra == "accountRecovery" and clean_config["plan"] in ("silver", "gold", "guardian")) or
                        (extra == "reputation" and clean_config["plan"] in ("gold", "guardian")) or
                        (extra in ("digitalLegacy", "continuity") and clean_config["plan"] == "guardian"))
            if included:
                invalid()
        fulfilment = exact(row["fulfilment"], ("status", "delivered_at"))
        status = choice(fulfilment["status"], ("not_started", "in_progress", "delivered"))
        delivered = None if fulfilment["delivered_at"] is None else timestamp(fulfilment["delivered_at"])
        if (status == "delivered") != (delivered is not None):
            invalid()
        state = choice(row["state"], ("payment_pending", "active", "review_required", "cancelled"))
        if state != "active" and status != "not_started":
            invalid()
        submitted = timestamp(row["submitted_at"])
        order = {"reference": reference, "submitted_at": submitted, "state": state,
                 "configuration": clean_config, "fulfilment": {"status": status, "delivered_at": delivered}}
        if "delivery_ledger" in row:
            if state != "active" or clean_config["plan"] == "scanner_10":
                invalid()
            order["delivery_ledger"] = validate_delivery_ledger(row["delivery_ledger"], clean_config, submitted, current_time)
        orders.append(order)
    if not available and orders:
        invalid()
    return {"ok": True, "source_available": available, "orders": orders}
