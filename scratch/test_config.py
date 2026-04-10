import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath('backend'))

from config import TESSERACT_CMD
print(f"Detected TESSERACT_CMD: {TESSERACT_CMD}")
print(f"OS Name: {os.name}")
