import os

try:
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid
except ImportError:
    print("Please ensure pywebpush is installed: pip install pywebpush")
    exit()

vapid = Vapid()
vapid.generate_keys()

private_key = vapid.private_key_pem()
public_key = vapid.public_key_pem()

print("\n--- VAPID KEYS GENERATED ---\n")
print(f"Update your backend/.env with:\n")
print(f"VAPID_PRIVATE_KEY='{vapid.private_pem()}'") # Just representation
# Note: VAPID standards usually require base64url encoded keys, not PEM for env.

# The proper way to generate base64url keys for Web Push:
import base64
import ecdsa

key = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
priv = base64.urlsafe_b64encode(key.to_string()).decode('utf-8').rstrip('=')
pub = base64.urlsafe_b64encode(b'\x04' + key.get_verifying_key().to_string()).decode('utf-8').rstrip('=')

print("\n--- Correct VAPID Base64URL Keys ---\n")
print("Add this to backend/.env:")
print(f"VAPID_PRIVATE_KEY={priv}")
print(f"VAPID_SUBJECT=mailto:admin@findmyclass.com")
print("\nAdd this to frontend/.env:")
print(f"VITE_VAPID_PUBLIC_KEY={pub}")
print("\nDone!")
