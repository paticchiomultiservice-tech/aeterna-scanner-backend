"""Pure, closed phone-continuity graph and exact declaration basis.

No network, storage, provider identity, credentials or entitlement data. The
gateway also checks transitions while holding its existing ScriptLock.
"""
from copy import deepcopy
from datetime import datetime
import hashlib
import json
import re

SCHEMA = "aeterna.phone-continuity.v1"
GUARD = "aeterna.phone-loss.v1"
PASSPORT_SCHEMAS = ("aeterna.passport.v3", "aeterna.passport.v4")
ACTIVE = ("declared_success", "declared_failure")
EPOCH = "1970-01-01T00:00:00.000Z"


def invalid():
    raise ValueError("INVALID_ORGANISATIONAL_DATA")


def exact(value, keys):
    if type(value) is not dict or set(value) != set(keys):
        invalid()
    return value


def choice(value, allowed):
    if type(value) is not str or value not in allowed:
        invalid()
    return value


def identifier(value, prefix):
    if type(value) is not str or re.fullmatch(prefix + r"_[a-z0-9-]{8,40}", value) is None:
        invalid()
    return value


def array(value, limit):
    if type(value) is not list or len(value) > limit:
        invalid()
    return value


def unique(values):
    if len(set(values)) != len(values):
        invalid()
    return values


def iso(value, upper):
    if type(value) is not str or re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", value) is None:
        invalid()
    try:
        normalized = datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except ValueError:
        invalid()
    if value != normalized or not EPOCH <= value <= upper:
        invalid()
    return value


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _graph(value, inventory, upper):
    c = exact(value, ("schema", "primaryPhoneId", "targetInventoryIds", "resources", "methods", "checks"))
    choice(c["schema"], (SCHEMA,))
    inv = {item["id"]: item for item in inventory}
    targets = unique([identifier(x, "item") for x in array(c["targetInventoryIds"], 5)])
    if any(x not in inv for x in targets):
        invalid()
    resources, account_ids = [], []
    for item in array(c["resources"], 24):
        r = exact(item, ("id", "kind", "inventoryId", "readiness", "mode", "methodsComplete"))
        identifier(r["id"], "resource")
        choice(r["kind"], ("account", "device", "cloud", "offline", "person"))
        choice(r["readiness"], ("declared_ready", "unknown", "unavailable"))
        choice(r["mode"], ("independent", "unknown", "methods"))
        if type(r["methodsComplete"]) is not bool:
            invalid()
        if r["kind"] == "account":
            identifier(r["inventoryId"], "item")
            if r["inventoryId"] not in inv or r["mode"] == "independent":
                invalid()
            account_ids.append(r["inventoryId"])
        elif r["inventoryId"] is not None:
            invalid()
        if r["mode"] == "independent" and r["methodsComplete"] is not True:
            invalid()
        if r["mode"] == "unknown" and r["methodsComplete"] is not False:
            invalid()
        resources.append(deepcopy(r))
    unique([r["id"] for r in resources])
    unique(account_ids)
    by_id = {r["id"]: r for r in resources}
    if c["primaryPhoneId"] is not None:
        identifier(c["primaryPhoneId"], "resource")
        if c["primaryPhoneId"] not in by_id or by_id[c["primaryPhoneId"]]["kind"] != "device":
            invalid()
    methods = []
    for item in array(c["methods"], 48):
        m = exact(item, ("id", "targetId", "purpose", "readiness", "requires"))
        identifier(m["id"], "method")
        identifier(m["targetId"], "resource")
        if m["targetId"] not in by_id or by_id[m["targetId"]]["mode"] != "methods":
            invalid()
        choice(m["purpose"], ("access", "recovery"))
        choice(m["readiness"], ("declared_ready", "unknown", "planned"))
        requires = unique([identifier(x, "resource") for x in array(m["requires"], 24)])
        if not requires or any(x not in by_id for x in requires):
            invalid()
        methods.append(deepcopy(m))
    unique([m["id"] for m in methods])
    checks = []
    for item in array(c["checks"], 12):
        row = exact(item, ("inventoryId", "status", "declaredAt", "reviewAfterDays", "basisDigest", "methodIds"))
        identifier(row["inventoryId"], "item")
        if row["inventoryId"] not in inv:
            invalid()
        choice(row["status"], ("unrecorded", "needs_review") + ACTIVE)
        mids = unique([identifier(x, "method") for x in array(row["methodIds"], 48)])
        if any(x not in {m["id"] for m in methods} for x in mids):
            invalid()
        if row["status"] in ACTIVE:
            iso(row["declaredAt"], upper)
            if type(row["reviewAfterDays"]) is not int or row["reviewAfterDays"] not in (30, 90, 180, 365):
                invalid()
            if type(row["basisDigest"]) is not str or re.fullmatch(r"[a-f0-9]{64}", row["basisDigest"]) is None or not mids:
                invalid()
        elif row["declaredAt"] is not None or row["reviewAfterDays"] is not None or row["basisDigest"] is not None or mids:
            invalid()
        checks.append(deepcopy(row))
    unique([r["inventoryId"] for r in checks])
    return {"schema": SCHEMA, "primaryPhoneId": c["primaryPhoneId"], "targetInventoryIds": targets,
            "resources": resources, "methods": methods, "checks": checks}


def _route_basis(passport, inventory_id, method_ids):
    c = passport["continuity"]
    inv = {r["id"]: r for r in passport["inventory"]}
    resources = {r["id"]: r for r in c["resources"]}
    methods = {m["id"]: m for m in c["methods"]}
    selected = set(method_ids)
    if len(selected) != len(method_ids) or not selected or c["primaryPhoneId"] is None or inventory_id not in inv:
        invalid()
    roots = [r["id"] for r in resources.values() if r["kind"] == "account" and r["inventoryId"] == inventory_id]
    if len(roots) != 1:
        invalid()
    used_resources, used_methods, visiting = set(), set(), set()

    def visit(resource_id):
        if resource_id in visiting or resource_id not in resources:
            invalid()
        if resource_id in used_resources:
            return
        r = resources[resource_id]
        if resource_id == c["primaryPhoneId"] or r["readiness"] != "declared_ready":
            invalid()
        visiting.add(resource_id)
        if r["mode"] == "independent":
            if r["kind"] == "account":
                invalid()
        elif r["mode"] == "methods":
            choices = [m for m in methods.values() if m["targetId"] == resource_id and m["id"] in selected]
            if len(choices) != 1 or choices[0]["readiness"] != "declared_ready":
                invalid()
            m = choices[0]
            used_methods.add(m["id"])
            for dependency in sorted(m["requires"]):
                visit(dependency)
        else:
            invalid()
        visiting.remove(resource_id)
        used_resources.add(resource_id)

    visit(roots[0])
    if used_methods != selected:
        invalid()
    accounts = sorted({resources[r]["inventoryId"] for r in used_resources if resources[r]["kind"] == "account"})
    account_tuples = [[key, inv[key]["service"], inv[key]["access"], inv[key]["recovery"]] for key in accounts]
    resource_tuples = [[r["id"], r["kind"], r["inventoryId"], r["readiness"], r["mode"], r["methodsComplete"]]
                       for r in sorted((resources[key] for key in used_resources), key=lambda x: x["id"])]
    method_tuples = [[m["id"], m["targetId"], m["purpose"], m["readiness"], sorted(m["requires"])]
                     for m in sorted((methods[key] for key in used_methods), key=lambda x: x["id"])]
    return compact(["aeterna.phone-loss-basis.v1", "phone_unavailable", c["primaryPhoneId"], inventory_id,
                    account_tuples, resource_tuples, method_tuples])


def route_basis(passport, inventory_id, method_ids):
    return _route_basis(passport, inventory_id, method_ids)


def route_digest(passport, inventory_id, method_ids):
    return hashlib.sha256(route_basis(passport, inventory_id, method_ids).encode("utf-8")).hexdigest()


def validate_continuity(value, inventory, updated_at):
    c = _graph(value, inventory, updated_at)
    p = {"inventory": inventory, "continuity": c}
    for check in c["checks"]:
        if check["status"] in ACTIVE and route_digest(p, check["inventoryId"], check["methodIds"]) != check["basisDigest"]:
            invalid()
    return c


def configuration_basis(passport):
    if passport.get("schema") != "aeterna.passport.v4":
        return None
    c = passport["continuity"]
    inventory = sorted([[r["id"], r["service"], r["access"], r["recovery"]] for r in passport["inventory"]])
    resources = sorted([[r["id"], r["kind"], r["inventoryId"], r["readiness"], r["mode"], r["methodsComplete"]] for r in c["resources"]])
    methods = sorted([[m["id"], m["targetId"], m["purpose"], m["readiness"], sorted(m["requires"])] for m in c["methods"]])
    return compact([c["primaryPhoneId"], c["targetInventoryIds"], resources, methods, inventory])


def _closure_basis(passport, inventory_id):
    c = passport["continuity"]
    resources = {r["id"]: r for r in c["resources"]}
    inventory = {r["id"]: r for r in passport["inventory"]}
    roots = [r["id"] for r in resources.values() if r["kind"] == "account" and r["inventoryId"] == inventory_id]
    if len(roots) != 1:
        return None
    reached, mids = set(), set()
    def visit(key):
        if key in reached or key not in resources:
            return
        reached.add(key)
        for method in c["methods"]:
            if method["targetId"] == key:
                mids.add(method["id"])
                for requirement in method["requires"]:
                    visit(requirement)
    visit(roots[0])
    accounts = sorted({resources[key]["inventoryId"] for key in reached if resources[key]["kind"] == "account"})
    return compact([c["primaryPhoneId"],
                    [[key, inventory[key]["service"], inventory[key]["access"], inventory[key]["recovery"]] for key in accounts],
                    [[r["id"], r["kind"], r["inventoryId"], r["readiness"], r["mode"], r["methodsComplete"]]
                     for r in sorted((resources[key] for key in reached), key=lambda x: x["id"])],
                    [[m["id"], m["targetId"], m["purpose"], m["readiness"], sorted(m["requires"])]
                     for m in sorted((m for m in c["methods"] if m["id"] in mids), key=lambda x: x["id"])]])


def invalidated_inventory_ids(previous, next_passport):
    if previous.get("schema") != "aeterna.passport.v4":
        return set()
    next_inventory = {r["id"]: r for r in next_passport["inventory"]}
    old_checks = {r["inventoryId"]: r for r in previous["continuity"]["checks"]}
    invalidated = set()
    for row in previous["inventory"]:
        if row["testedAt"] is None or row["id"] not in next_inventory:
            continue
        nxt = next_inventory[row["id"]]
        if any(row[key] != nxt[key] for key in ("service", "access", "recovery")):
            invalidated.add(row["id"])
            continue
        old_check = old_checks.get(row["id"])
        try:
            if old_check and old_check["status"] in ACTIVE:
                before = route_basis(previous, row["id"], old_check["methodIds"])
                after = route_basis(next_passport, row["id"], old_check["methodIds"])
            else:
                before = _closure_basis(previous, row["id"])
                after = _closure_basis(next_passport, row["id"])
            if before != after:
                invalidated.add(row["id"])
        except (ValueError, KeyError):
            invalidated.add(row["id"])
    return invalidated


def assert_transition(previous, next_passport):
    """The durable gateway applies the equivalent check under its CAS lock."""
    if previous and previous["schema"] == "aeterna.passport.v4" and next_passport["schema"] != "aeterna.passport.v4":
        raise ValueError("WORKSPACE_SCHEMA_UNSUPPORTED")
    if next_passport["schema"] != "aeterna.passport.v4":
        return
    if previous and next_passport["updatedAt"] < previous["updatedAt"]:
        raise ValueError("WORKSPACE_INVALID_TRANSITION")
    old = {r["inventoryId"]: r for r in previous["continuity"]["checks"]} if previous and previous["schema"] == "aeterna.passport.v4" else {}
    stable = previous is not None and configuration_basis(previous) == configuration_basis(next_passport)
    for row in next_passport["continuity"]["checks"]:
        if row["status"] not in ACTIVE:
            continue
        prior = old.get(row["inventoryId"])
        same = prior and {**prior, "methodIds": sorted(prior["methodIds"])} == {**row, "methodIds": sorted(row["methodIds"])}
        if not same and not stable:
            raise ValueError("WORKSPACE_INVALID_TRANSITION")
        if not same and previous and row["declaredAt"] < previous["updatedAt"]:
            raise ValueError("WORKSPACE_INVALID_TRANSITION")
    if previous:
        affected = invalidated_inventory_ids(previous, next_passport)
        if any(r["id"] in affected and r["testedAt"] is not None for r in next_passport["inventory"]):
            raise ValueError("WORKSPACE_INVALID_TRANSITION")


def evaluate_states(continuity):
    """Cross-language fixture oracle for the K/P fixed points."""
    resources = {r["id"]: r for r in continuity["resources"]}
    unavailable = {r["id"] for r in resources.values() if r["readiness"] == "unavailable"} | {continuity["primaryPhoneId"]}
    known = {r["id"] for r in resources.values() if r["id"] not in unavailable and r["mode"] == "independent" and r["readiness"] == "declared_ready"}
    potential = {r["id"] for r in resources.values() if r["id"] not in unavailable and (r["mode"] in ("independent", "unknown") or not r["methodsComplete"])}
    for target, is_known in ((known, True), (potential, False)):
        while True:
            before = len(target)
            for resource in resources.values():
                if resource["id"] in unavailable or is_known and resource["readiness"] != "declared_ready":
                    continue
                for method in continuity["methods"]:
                    if method["targetId"] == resource["id"] and method["readiness"] in (("declared_ready",) if is_known else ("declared_ready", "unknown")) and all(key in target for key in method["requires"]):
                        target.add(resource["id"])
            if len(target) == before:
                break
    result = {}
    for key in continuity["targetInventoryIds"]:
        account = next((r for r in resources.values() if r["kind"] == "account" and r["inventoryId"] == key), None)
        result[key] = ("unknown" if continuity["primaryPhoneId"] is None or account is None else
                       "path_declared" if account["id"] in known else "unknown" if account["id"] in potential else "blocked_in_model")
    return result

