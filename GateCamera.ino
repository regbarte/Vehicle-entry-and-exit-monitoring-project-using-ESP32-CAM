import json,secrets,getpass
from pathlib import Path
from werkzeug.security import generate_password_hash
p=Path(__file__).resolve().parent/'config.json'
if p.exists():
    raise SystemExit('config.json already exists. Edit it with Notepad to change camera settings. Keep a backup before resetting credentials.')
pw=getpass.getpass('Choose dashboard/supervisor password (12+ characters): ')
if len(pw)<12: raise SystemExit('Use at least 12 characters.')
if pw!=getpass.getpass('Confirm password: '): raise SystemExit('Passwords do not match.')
url=input('Camera URL, e.g. http://192.168.1.50: ').strip() or 'http://192.168.1.50'
key=secrets.token_hex(24)
config=dict(secret_key=secrets.token_hex(32),password_hash=generate_password_hash(pw),camera_url=url,camera_key=key,tesseract_cmd=input(r'Tesseract path [C:\Program Files\Tesseract-OCR\tesseract.exe]: ').strip() or r'C:\Program Files\Tesseract-OCR\tesseract.exe')
p.write_text(json.dumps(config,indent=2))
print('Saved config.json. Copy its camera_key value into CAMERA_KEY in the Arduino sketch. Do not share config.json.')
