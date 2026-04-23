import sys
import os

# Add the current directory to sys.path to allow importing backend
sys.path.append(os.getcwd())

try:
    from backend.firebase_admin_config import root_ref, db_fs
    if root_ref is not None:
        print("SUCCESS: Firebase initialized correctly via .env")
    else:
        print("FAILURE: Firebase failed to initialize")
except Exception as e:
    print(f"EXCEPTION: {e}")
