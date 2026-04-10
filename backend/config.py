import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.getenv("DB_NAME", "find_my_class")
SECRET_KEY = os.getenv("SECRET_KEY", "findmyclass_secret_key_2024")
# Tesseract Path Configuration
# On Render (Linux), we leave this empty so it uses the global 'tesseract' command
TESSERACT_CMD = os.getenv("TESSERACT_CMD")

# Fallback for local Windows development if environment variable is not set
if os.name == 'nt' and not TESSERACT_CMD:
    win_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(win_tesseract):
        TESSERACT_CMD = win_tesseract
