"""
Write test data to RTDB: latest + history.
Key format: zone_id:sensor_id  (matches backend simulator + ControlPage)

HOW TO RUN:
  1. 确保你在项目根目录 (argiculture/)
  2. 激活虚拟环境后运行：
     .\.venv\Scripts\python.exe test_rtdb.py
  3. 如果要清空 RTDB 数据再重新写入，先跑：
     .\.venv\Scripts\python.exe clear_rtdb.py
"""
import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime, timezone, timedelta
import sys, os, random

sys.stdout.reconfigure(encoding='utf-8')

KL_TZ = timezone(timedelta(hours=8))
SERVICE_ACCOUNT = os.path.join(
    os.path.dirname(__file__), "backend",
    "agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json"
)
DATABASE_URL = "https://agritwin-mrv-default-rtdb.firebaseio.com/"
UID = "N8HUYS5jzCdVEh32vZEnagneGnP2"

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})

root = db.reference("/")
now = datetime.now(KL_TZ)

# ─── Sensor definitions (matches SENSOR_DEVICE_DEFS in frontend) ──────────
SENSORS = [
    # zone_air
    {"sensor_id": "air_rh_1",      "sensor_type": "humidity",         "zone_id": "zone_air",   "unit": "%",   "base": 65.0},
    {"sensor_id": "air_rh_2",      "sensor_type": "humidity",         "zone_id": "zone_air",   "unit": "%",   "base": 63.0},
    {"sensor_id": "air_temp_1",    "sensor_type": "temperature",      "zone_id": "zone_air",   "unit": "°C",  "base": 28.0},
    {"sensor_id": "air_light_1",   "sensor_type": "light_intensity",  "zone_id": "zone_air",   "unit": "lux", "base": 18000.0},
    # zone_bed_a
    {"sensor_id": "bed_a_temp",     "sensor_type": "soil_temperature", "zone_id": "zone_bed_a", "unit": "°C",  "base": 22.0},
    {"sensor_id": "bed_a_ph",       "sensor_type": "soil_ph",          "zone_id": "zone_bed_a", "unit": "pH",  "base": 6.2},
    {"sensor_id": "bed_a_moisture", "sensor_type": "soil_moisture",    "zone_id": "zone_bed_a", "unit": "%",   "base": 45.0},
    # zone_bed_b
    {"sensor_id": "bed_b_temp",     "sensor_type": "soil_temperature", "zone_id": "zone_bed_b", "unit": "°C",  "base": 23.0},
    {"sensor_id": "bed_b_ph",       "sensor_type": "soil_ph",          "zone_id": "zone_bed_b", "unit": "pH",  "base": 6.0},
    {"sensor_id": "bed_b_moisture", "sensor_type": "soil_moisture",    "zone_id": "zone_bed_b", "unit": "%",   "base": 48.0},
    # zone_bed_c
    {"sensor_id": "bed_c_temp",     "sensor_type": "soil_temperature", "zone_id": "zone_bed_c", "unit": "°C",  "base": 21.5},
    {"sensor_id": "bed_c_ph",       "sensor_type": "soil_ph",          "zone_id": "zone_bed_c", "unit": "pH",  "base": 5.9},
    {"sensor_id": "bed_c_moisture", "sensor_type": "soil_moisture",    "zone_id": "zone_bed_c", "unit": "%",   "base": 42.0},
]

def make_reading(sensor, ts, noise=True):
    """Generate a single reading dict with optional noise."""
    value = sensor["base"]
    if noise:
        value += random.gauss(0, sensor["base"] * 0.02)
        value = round(value, 2)
    return {
        "sensor_id": sensor["sensor_id"],
        "sensor_type": sensor["sensor_type"],
        "zone_id": sensor["zone_id"],
        "value": value,
        "unit": sensor["unit"],
        "timestamp": ts.isoformat(),
        "quality": 1.0,
    }

# ─── 1. Write LATEST ─────────────────────────────────────────────────────
print("=" * 60)
print("Writing latest readings...")
latest_path = f"users/{UID}/live/latest"
latest_payload = {}
for s in SENSORS:
    key = f"{s['zone_id']}:{s['sensor_id']}"
    latest_payload[key] = make_reading(s, now, noise=False)
    print(f"  {key}: {s['base']} {s['unit']}")

root.child(latest_path).set(latest_payload)
print(f"✅ Wrote {len(latest_payload)} latest keys")

# ─── 2. Write HISTORY (30 min of data, 1 reading per minute) ─────────────
print(f"\n{'=' * 60}")
print("Writing history (30 data points per sensor, 1/min)...")
history_base = f"users/{UID}/live/history"
history_count = 0

for s in SENSORS:
    path = f"{history_base}/{s['zone_id']}/{s['sensor_id']}"
    history_ref = root.child(path)

    batch = {}
    for i in range(30):
        ts = now - timedelta(minutes=30 - i)
        reading = make_reading(s, ts, noise=True)
        # Use push-like key so Firebase sorts correctly
        push_key = f"t{i:04d}"
        batch[push_key] = reading
    
    history_ref.set(batch)
    history_count += 30
    print(f"  {s['zone_id']}/{s['sensor_id']}: 30 points")

print(f"✅ Wrote {history_count} history points total")

# ─── 3. Verify ────────────────────────────────────────────────────────────
print(f"\n{'=' * 60}")
print("Verifying...")
latest = root.child(latest_path).get()
if latest:
    print(f"  latest: {len(latest)} keys ✅")
else:
    print("  latest: EMPTY ❌")

history = root.child(history_base).get(shallow=True)
if history:
    print(f"  history zones: {list(history.keys())} ✅")
else:
    print("  history: EMPTY ❌")

print("\nDone! 🎉")
