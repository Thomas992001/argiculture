"""Quick test for the new Agentic AI endpoints."""
import urllib.request
import json
import sys

BASE = "http://localhost:8000/api/advisor"

def test_agent_chat(msg, lang="en"):
    print(f"\n--- Testing agent-chat: '{msg}' ---")
    req = urllib.request.Request(
        f"{BASE}/agent-chat",
        data=json.dumps({"message": msg, "language": lang}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=60)
        data = json.loads(r.read())
        print(f"  Status: {r.status}")
        print(f"  Intent: {data.get('intent')}")
        print(f"  Is Hello Twin: {data.get('is_hello_twin')}")
        actions = data.get("actions_taken", [])
        print(f"  Actions: {len(actions)}")
        for a in actions:
            print(f"    -> {a['actuator_id']} {a['command']} success={a['success']}")
        print(f"  Answer preview: {data.get('answer', '')[:100]}...")
        return data
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

def test_hello_twin(lang="en"):
    print(f"\n--- Testing hello-twin (lang={lang}) ---")
    try:
        r = urllib.request.urlopen(f"{BASE}/hello-twin?language={lang}", timeout=60)
        data = json.loads(r.read())
        print(f"  Status: {r.status}")
        print(f"  Is Hello Twin: {data.get('is_hello_twin')}")
        print(f"  Has warnings: {data.get('has_warnings')}")
        print(f"  Powered by: {data.get('powered_by')}")
        print(f"  Answer preview: {repr(data.get('answer', '')[:150])}...")
        return data
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

if __name__ == "__main__":
    # Test 1: Hello Twin
    test_hello_twin("en")
    
    # Test 2: Natural language control - water bed a
    test_agent_chat("water bed a", "en")
    
    # Test 3: General question (should NOT trigger control)
    test_agent_chat("how is my greenhouse?", "en")
    
    print("\n=== All tests complete ===")
