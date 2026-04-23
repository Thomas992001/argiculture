import firebase_admin
from firebase_admin import credentials, db, firestore
from datetime import datetime, timezone, timedelta
import os
import json
from backend.config import settings

def initialize_firebase():
    """Initializes the Firebase Admin SDK using settings."""
    if not firebase_admin._apps:
        # Priority: Settings (Environment variable FIREBASE_CREDENTIALS)
        cred_json = settings.firebase_credentials
        
        if cred_json:
            try:
                cred_dict = json.loads(cred_json)
                cred = credentials.Certificate(cred_dict)
            except Exception as e:
                print(f"Error parsing FIREBASE_CREDENTIALS: {e}")
                raise
        else:
            print("WARNING: FIREBASE_CREDENTIALS not found in environment. Firebase features will be disabled.")
            return None, None

        firebase_admin.initialize_app(cred, {
            'databaseURL': settings.firebase_database_url
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

