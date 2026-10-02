"""Security Test Suite for JARVIS Phase 1 Part 1.

Validates path resolution, canonicalization, traversal rejections,
and prints the exact formatted outputs required.
"""

import sys
import shutil
from pathlib import Path

# Add laptop-agent to module path
agent_dir = Path(__file__).resolve().parent / "laptop-agent"
sys.path.insert(0, str(agent_dir))

from commands import execute_safe_command
from config import WORKSPACE_DIR

print("=" * 60)
print("     JARVIS Phase 1 Part 1 - Security Verification")
print("=" * 60)

# 1. Base Workspace Check
print(f"Safe Base Workspace: {WORKSPACE_DIR}")
assert WORKSPACE_DIR.is_absolute(), "Workspace base must be absolute!"

# 2. Legitimate Folder Creation (Projects, TestFolder, EduPrep)
res_create = execute_safe_command("create_folder", {"folder_name": "TestFolder"})
print(f"Create Folder Success: {res_create['success']}")

# 3. Path Traversal Rejection
res_traversal = execute_safe_command("create_folder", {"folder_name": "../../malicious"})
print(f"Path Traversal Rejected (Success should be False): {res_traversal['success']}")

# 4. Dangerous URL Rejection
res_file_url = execute_safe_command("open_url", {"url": "file:///etc/passwd"})
print(f"File URL Rejected (Success should be False): {res_file_url['success']}")

# 5. Non-whitelisted App Rejection
res_bad_app = execute_safe_command("open_app", {"app_name": "powershell"})
print(f"Non-whitelisted App Rejected (Success should be False): {res_bad_app['success']}")

# 6. Arbitrary Command Rejection
res_arbitrary = execute_safe_command("exec_shell", {"cmd": "dir"})
print(f"Arbitrary Command Rejected (Success should be False): {res_arbitrary['success']}")

# 7. Nested Legitimate Folders Testing
print("\n--- Testing Legitimate Nested Folders ---")
legit_nested = ["Projects/Test", "Projects/EduPrep", "Projects", "EduPrep"]
all_legit_ok = True
for fld in legit_nested:
    r = execute_safe_command("create_folder", {"folder_name": fld})
    is_ok = r["success"] and (WORKSPACE_DIR / Path(fld)).exists()
    all_legit_ok = all_legit_ok and is_ok
    status = "OK" if is_ok else f"FAILED: {r.get('error')}"
    print(f"  Folder '{fld}': {status}")

# 8. Rigorous Traversal Vectors Testing
print("\n--- Testing Path Traversal & Escape Vectors ---")
traversal_vectors = [
    "../",
    r"..\evil",
    "../../",
    r"..\..",
    "../../malicious",
    r"C:\Windows\System32",
    r"D:\evil",
    r"\\server\share\exploit",
    "/root_escape",
    r"\root_escape",
    "Projects/../../escaped",
    "Projects/../Test2/../../outside",
    ".",
    "..",
    "Projects/."
]

all_traversals_blocked = True
for vector in traversal_vectors:
    r = execute_safe_command("create_folder", {"folder_name": vector})
    is_blocked = (r["success"] is False)
    all_traversals_blocked = all_traversals_blocked and is_blocked
    print(f"  Vector '{vector}': {'BLOCKED' if is_blocked else 'UNEXPECTED SUCCESS (SECURITY LEAK)'}")

# Cleanup created test folders
for cleanup_name in ["TestFolder", "Projects", "EduPrep", "malicious", "evil", "escaped"]:
    target = WORKSPACE_DIR / cleanup_name
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)

print("\n" + "=" * 60)
print(f"All Legitimate Folders Passed: {all_legit_ok}")
print(f"All Traversal Vectors Blocked: {all_traversals_blocked}")
print("=" * 60)

if not (res_create['success'] and not res_traversal['success'] and not res_file_url['success']
        and not res_bad_app['success'] and not res_arbitrary['success'] and all_legit_ok and all_traversals_blocked):
    sys.exit(1)
