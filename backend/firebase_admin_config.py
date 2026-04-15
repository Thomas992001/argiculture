import firebase_admin
from firebase_admin import credentials, db, firestore
from datetime import datetime, timezone, timedelta
import os

# Service account key (committed with repo — same folder as this file)
SERVICE_ACCOUNT_PATH = os.path.join(
    os.path.dirname(__file__),
    "agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json",
)
DATABASE_URL = "https://agritwin-mrv-default-rtdb.firebaseio.com/"

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': DATABASE_URL
        })
    return db.reference('/'), firestore.client()

# Timezone Configuration (Kuala Lumpur UTC+8)
KL_TZ = timezone(timedelta(hours=8))

def get_kl_now():
    """Returns the current time in Kuala Lumpur (UTC+8)."""
    return datetime.now(KL_TZ)

# Initialize and export references
try:
    root_ref, db_fs = initialize_firebase()
    print("Firebase Admin (RTDB & Firestore) initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase Admin: {e}")
    root_ref = None
    db_fs = None

