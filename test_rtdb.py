"""
Test script: Clean old RTDB keys and write correct zone_bed_a/b/c data.
"""
import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime, timezone, timedelta
import sys
import os

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

KL_TZ = timezone(timedelta(hours=8))

SERVICE_ACCOUNT = os.path.join(
    os.path.dirname(__file__), "backend",
    "agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json"
)
DATABASE_URL = "https://agritwin-mrv-default-rtdb.firebaseio.com/"
UID = "ZLwjf4x1vBPkcEHc015OhelwwHo1"

# Initialize
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})

root = db.reference("/")
latest_path = f"users/{UID}/live/latest"

# ─── 1. Read current RTDB ───
print("=" * 60)
print(f"Reading: {latest_path}")
print("=" * 60)
latest = root.child(latest_path).get()

if latest is None:
    print(">>> RTDB latest is EMPTY")
else:
    print(f"Found {len(latest)} keys:")
    for key in sorted(latest.keys()):
        val = latest[key]
        if isinstance(val, dict):
            print(f"  {key}: value={val.get('value')}, unit={val.get('unit')}")
        else:
            print(f"  {key}: {val}")

# ─── 2. Delete old keys that don't match frontend expectations ───
old_keys_to_remove = [
    "zone_bed:ec", "zone_bed:soil_moisture", "zone_bed:temperature",
    "zone_nft:ec", "zone_nft:ph", "zone_nft:water_temperature",
    "zone_reservoir:ec", "zone_reservoir:ph", "zone_reservoir:water_level",
    "zone_reservoir:water_temperature",
]

print(f"\n{'=' * 60}")
print("Cleaning old keys...")
remove_payload = {}
if latest:
    for key in old_keys_to_remove:
        if key in latest:
            remove_payload[key] = None  # Setting to None deletes in Firebase
            print(f"  [DEL] {key}")

if remove_payload:
    root.child(latest_path).update(remove_payload)
    print(f"Deleted {len(remove_payload)} old keys")
else:
    print("No old keys to delete")

# ─── 3. Write correct bed data (zone_bed_a/b/c) ───
now = datetime.now(KL_TZ).isoformat()

bed_data = {
    # Substrate Bed A
    "zone_bed_a:soil_temperature": {
        "sensor_id": "bed_a_temp", "sensor_type": "soil_temperature",
        "zone_id": "zone_bed_a", "value": 22.3, "unit": "°C",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_a:soil_ph": {
        "sensor_id": "bed_a_ph", "sensor_type": "soil_ph",
        "zone_id": "zone_bed_a", "value": 6.2, "unit": "pH",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_a:soil_moisture": {
        "sensor_id": "bed_a_moisture", "sensor_type": "soil_moisture",
        "zone_id": "zone_bed_a", "value": 45.0, "unit": "%",
        "timestamp": now, "quality": 1.0
    },
    # Substrate Bed B
    "zone_bed_b:soil_temperature": {
        "sensor_id": "bed_b_temp", "sensor_type": "soil_temperature",
        "zone_id": "zone_bed_b", "value": 23.1, "unit": "°C",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_b:soil_ph": {
        "sensor_id": "bed_b_ph", "sensor_type": "soil_ph",
        "zone_id": "zone_bed_b", "value": 6.0, "unit": "pH",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_b:soil_moisture": {
        "sensor_id": "bed_b_moisture", "sensor_type": "soil_moisture",
        "zone_id": "zone_bed_b", "value": 48.0, "unit": "%",
        "timestamp": now, "quality": 1.0
    },
    # Substrate Bed C
    "zone_bed_c:soil_temperature": {
        "sensor_id": "bed_c_temp", "sensor_type": "soil_temperature",
        "zone_id": "zone_bed_c", "value": 21.5, "unit": "°C",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_c:soil_ph": {
        "sensor_id": "bed_c_ph", "sensor_type": "soil_ph",
        "zone_id": "zone_bed_c", "value": 5.9, "unit": "pH",
        "timestamp": now, "quality": 1.0
    },
    "zone_bed_c:soil_moisture": {
        "sensor_id": "bed_c_moisture", "sensor_type": "soil_moisture",
        "zone_id": "zone_bed_c", "value": 42.0, "unit": "%",
        "timestamp": now, "quality": 1.0
    },
}

print(f"\n{'=' * 60}")
print("Writing bed data (zone_bed_a/b/c)...")
root.child(latest_path).update(bed_data)
print(f"Wrote {len(bed_data)} keys")

# ─── 4. Verify final state ───
print(f"\n{'=' * 60}")
print("Final RTDB state:")
print("=" * 60)
final = root.child(latest_path).get()
if final:
    print(f"Total keys: {len(final)}")
    for key in sorted(final.keys()):
        val = final[key]
        if isinstance(val, dict):
            status = "OK" if val.get("value") is not None else "EMPTY"
            print(f"  [{status}] {key}: value={val.get('value')}, unit={val.get('unit')}")
else:
    print("ERROR: RTDB still empty!")
