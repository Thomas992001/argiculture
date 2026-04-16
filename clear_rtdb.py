"""Clear RTDB users/{uid}/live/ (latest + history)."""
import firebase_admin
from firebase_admin import credentials, db
import sys, os

sys.stdout.reconfigure(encoding='utf-8')

SERVICE_ACCOUNT = os.path.join(
    os.path.dirname(__file__), "backend",
    "agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json"
)
DATABASE_URL = "https://agritwin-mrv-default-rtdb.firebaseio.com/"
UIDS = [
    "ZLwjf4x1vBPkcEHc015OhelwwHo1",
    "N8HUYS5jzCdVEh32vZEnagneGnP2",
    "85wVjbhGknTxyokTYZxViXSZciu1",
    "0Lx2UnHudiYBprfk1PtzT0DP5VL2",
]

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})

for uid in UIDS:
    live_ref = db.reference(f"users/{uid}/live")
    print(f"\n{'='*50}")
    print(f"UID: {uid}")
    current = live_ref.get(shallow=True)
    if not current:
        print("  Already empty, skipping.")
        continue
    print(f"  Found top-level keys: {list(current.keys())}")

    for child_key in list(current.keys()):
        child_ref = live_ref.child(child_key)
        # For history, delete each zone individually
        child_data = child_ref.get(shallow=True)
        if isinstance(child_data, dict) and len(child_data) > 5:
            print(f"  Deleting {child_key}/ sub-keys individually...")
            for sub_key in list(child_data.keys()):
                child_ref.child(sub_key).delete()
                print(f"    [DEL] {child_key}/{sub_key}")
        else:
            child_ref.delete()
            print(f"  [DEL] {child_key}")

    check = live_ref.get(shallow=True)
    if not check:
        print(f"  ✅ Cleared!")
    else:
        print(f"  ❌ Still has: {list(check.keys())}")
