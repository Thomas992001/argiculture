import firebase_admin
from firebase_admin import credentials, db, firestore
from datetime import datetime, timezone, timedelta # Added timezone and timedelta
import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env

# Path to the service account key provided by the user
SERVICE_ACCOUNT_PATH = r"C:\Users\User\Desktop\PropXpert\HTML-Project\algriculture-main\argiculture\backend\agritwin-mrv-firebase-adminsdk-fbsvc-cb08135bf7.json"
DATABASE_URL = "https://agritwin-mrv-default-rtdb.firebaseio.com/"

def initialize_firebase():
    """Initializes the Firebase Admin SDK."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': DATABASE_URL
        })
    return db.reference('/'), firestore.client() # Return both

# Timezone Configuration (Kuala Lumpur UTC+8)
KL_TZ = timezone(timedelta(hours=8))

def get_kl_now():
    """Returns the current time in Kuala Lumpur (UTC+8)."""
    return datetime.now(KL_TZ)

# Target user ID for all AgriMonitor data (loaded from environment)
DEFAULT_UID = os.getenv("FIREBASE_TARGET_UID", "ZLwjf4x1vBPkcEHc015OhelwwHo1")

if not os.getenv("FIREBASE_TARGET_UID"):
    print("Warning: FIREBASE_TARGET_UID not found in .env, using default fallback.")

# Initialize and export references
try:
    root_ref, db_fs = initialize_firebase()
    print("Firebase Admin (RTDB & Firestore) initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase Admin: {e}")
    root_ref = None
    db_fs = None
