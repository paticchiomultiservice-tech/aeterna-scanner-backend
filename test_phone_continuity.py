"""Synthetic continuity contract checks. No accounts, providers or network."""
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
BASE=Path(__file__).resolve().parent
CODE=BASE if (BASE/"phone_continuity.py").exists() else BASE/"productionroot"
sys.path.insert(0,str(CODE))
from phone_continuity import validate_continuity,route_basis,route_digest,evaluate_states,assert_transition
from passport_model import validate_passport,PassportSchemaUnsupported
FIX=BASE/"phone-fixtures.json"
if not FIX.exists(): FIX=BASE/"tests"/"phone-fixtures.json"
F=json.loads(FIX.read_text(encoding="utf-8"))
NOW=F["now"]
SECONDS=int(datetime.fromisoformat(NOW.replace("Z","+00:00")).timestamp())
def passport(f=None):
    f=f or F["canonical"][0]
    p=deepcopy(F["passportBase"])
    p.update(schema="aeterna.passport.v4",inventory=deepcopy(f["inventory"]),continuity=deepcopy(f["continuity"]))
    return p
def claim(p):
    f=F["canonical"][0]
    return {"inventoryId":f["targetInventoryId"],"status":"declared_success","declaredAt":NOW,"reviewAfterDays":90,"basisDigest":route_digest(p,f["targetInventoryId"],f["methodIds"]),"methodIds":deepcopy(f["methodIds"])}
class PhoneContractTests(unittest.TestCase):
    def setUp(self):
        clock=patch("passport_model.time.time",return_value=SECONDS);clock.start();self.addCleanup(clock.stop)
    def test_shared_scenarios(self):
        for fixture in F["scenarios"]:
            with self.subTest(fixture=fixture["name"]):
                p=passport(fixture);self.assertEqual(validate_passport(p),p)
                states=evaluate_states(p["continuity"])
                self.assertEqual([states[k] for k in p["continuity"]["targetInventoryIds"]],fixture["expectedStates"])
    def test_exact_canonical_bytes_and_digest(self):
        for f in F["canonical"]:
            p=passport(f)
            self.assertEqual(route_basis(p,f["targetInventoryId"],f["methodIds"]),f["basis"])
            self.assertEqual(route_digest(p,f["targetInventoryId"],f["methodIds"]),f["digest"])
    def test_valid_claim(self):
        p=passport();p["continuity"]["checks"]=[claim(p)];self.assertEqual(validate_passport(p),p)
    def test_unknown_fields_and_external_verification_rejected(self):
        for changes in [{"verified":True},{"email":"synthetic@example.invalid"}]:
            p=passport();p["continuity"].update(changes)
            with self.assertRaises(Exception): validate_passport(p)
    def test_map_and_first_claim_are_separate_transitions(self):
        p=passport();q=deepcopy(p);q["continuity"]["checks"]=[claim(q)]
        assert_transition(p,q)
        with self.assertRaises(Exception): assert_transition(None,q)
    def test_downgrade_refused(self):
        p=passport();q=deepcopy(F["passportBase"])
        with self.assertRaises(Exception): assert_transition(p,q)
    def test_v3_read_stays_v3(self):
        p=deepcopy(F["passportBase"]);self.assertEqual(validate_passport(p),p);self.assertNotIn("continuity",p)
if __name__=="__main__": unittest.main()

