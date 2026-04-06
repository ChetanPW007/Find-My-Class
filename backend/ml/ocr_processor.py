import re
import os
import json
import logging
import tempfile

try:
    import pytesseract
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    from config import TESSERACT_CMD
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    OCR_AVAILABLE = True
except ImportError:
    try:
        from PIL import Image, ImageEnhance, ImageFilter, ImageOps
    except ImportError:
        pass
    OCR_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def _preprocess_image_for_ocr(filepath):
    """
    Preprocess a timetable image before sending to Gemini or Tesseract.
    - Auto-orient (fix EXIF rotation from phone cameras)
    - Upscale to at least 2400px on the longer side
    - Convert to RGB
    - Boost contrast and sharpness so text is crisp
    Returns path to preprocessed PNG temp file, or None on failure.
    """
    try:
        img = Image.open(filepath)
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        w, h = img.size
        long_side = max(w, h)
        if long_side < 2400:
            scale = 2400 / long_side
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        img = ImageEnhance.Contrast(img).enhance(1.6)
        img = ImageEnhance.Sharpness(img).enhance(2.0)
        img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        img.save(tmp.name, format="PNG", optimize=False)
        tmp.close()
        return tmp.name
    except Exception as e:
        logging.warning(f"Image preprocessing failed (using original): {e}")
        return None


def process_timetable_file(filepath):
    """
    Process a GM University timetable image/pdf/doc.
    Tries Gemini AI first (most accurate), falls back to Tesseract OCR parser.
    """
    ext = filepath.lower().split('.')[-1]
    is_image = ext in ("jpg", "jpeg", "png", "bmp", "tiff", "tif", "webp", "gif")

    preprocessed_path = None
    upload_path = filepath

    try:
        # Preprocess images (upscale/contrast/sharpen) to heavily improve OCR accuracy
        if is_image:
            preprocessed_path = _preprocess_image_for_ocr(filepath)
            if preprocessed_path:
                upload_path = preprocessed_path
                logging.info(f"Created preprocessed image: {preprocessed_path}")

        # ── 1. Try Gemini AI (primary, most accurate) ──────────────────────────────
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key and GEMINI_AVAILABLE:
            try:
                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel("gemini-1.5-pro")

                prompt = """You are analyzing a GM University class timetable image/document.

EXACT DOCUMENT STRUCTURE (GM University format):

SECTION 1 - HEADER METADATA (top of page):
  University name, Semester, Section (e.g. CY3A), Room No (e.g. CR-06),
  Department/Program (e.g. B.Tech CS Cyber Security), Class Teacher.

SECTION 2 - TIMETABLE GRID:
  - Column headers = TIME SLOTS: 8:00am-9:00am, 9:00am-10:00am, 10:00am-10:30am (BREAK),
    10:30am-11:30am, 11:30am-12:30pm, 12:30pm-1:30pm (LUNCH), 1:30pm-2:30pm,
    2:30pm-3:30pm, 3:30pm-5:00pm
  - Row labels = DAYS: MON, TUE, WED, THU, FRI, SAT
  - Each cell has a SHORT SUBJECT CODE (AIML, DSC, ATC, SDM, UDNT) or blank/Break.

SECTION 3 - ALLOCATION OF COURSES TABLE (below the grid):
  Columns: Course Title | Course Code (2-5 letter abbreviation) | UE24CS... | Credits | L | T | P | Teacher
  Example: "Artificial Intelligence and Machine Learning | AIML | UE24CS2401 | 3 | 1 | 2 | 2 | Bhumika B"
  STOP extracting at the PBL row (inclusive). Do NOT extract SDTCD, CASP, CIBI, SA etc.

YOUR TASK:
  1. Build a map: short_code -> {full_name, teacher} from the Allocation table (up to PBL).
  2. For each day x time_slot cell that has a code, create one JSON entry.
  3. Skip: blank cells, Break, Lunch, dashes, SDTCD, PBL, CIBI, SA, CASP.

OUTPUT: Return ONLY a raw JSON array (no markdown, no explanation):
[
  {
    "day": "Monday",
    "time_slot": "8:00am To 9:00am",
    "subject": "Artificial Intelligence and Machine Learning",
    "teacher": "Bhumika B",
    "classroom": "CR-06",
    "department": "CS - Cyber Security"
  }
]

Rules:
- day: Full name (Monday/Tuesday/Wednesday/Thursday/Friday/Saturday)
- time_slot: match column header format exactly
- subject: full name from Allocation table; if not found use the short code
- teacher: from Allocation table; if not found use "TBD"
- classroom: Room No from header
- department: Program/Department from header
"""
                uploaded_file = genai.upload_file(upload_path)
                response = model.generate_content(
                    [prompt, uploaded_file],
                    generation_config={"temperature": 0},
                )
                try:
                    genai.delete_file(uploaded_file.name)
                except Exception:
                    pass

                res_text = response.text.strip()
                try:
                    with open("logs.txt", "a", encoding="utf-8") as _f:
                        _f.write("\n--- GEMINI RESPONSE START ---\n" + res_text[:4000] + "\n--- GEMINI RESPONSE END ---\n")
                except Exception:
                    pass

                if "```" in res_text:
                    res_text = re.sub(r'^```(json)?', '', res_text.strip(), flags=re.MULTILINE)
                    res_text = re.sub(r'```$', '', res_text.strip(), flags=re.MULTILINE)
                    res_text = res_text.strip()

                entries = json.loads(res_text)
                if isinstance(entries, list) and len(entries) > 0:
                    logging.info(f"Gemini extracted {len(entries)} timetable entries.")
                    return entries
                else:
                    logging.warning("Gemini returned empty list — falling back to raw OCR.")

            except Exception as e:
                err_msg = f"Gemini failed ({type(e).__name__}): {e}"
                logging.error(err_msg)
                try:
                    with open("logs.txt", "a", encoding="utf-8") as _f:
                        _f.write(f"\n--- GEMINI ERROR ---\n{err_msg}\n")
                except Exception:
                    pass

        # ── 2. Extract raw text for fallback parsing ───────────────────────────────
        raw_text = ""
        if ext == "pdf":
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(filepath)
                for page in reader.pages:
                    raw_text += (page.extract_text() or "") + "\n"
            except ImportError:
                raise RuntimeError("PyPDF2 not installed. Run: pip install PyPDF2")
        elif ext in ["doc", "docx"]:
            try:
                from docx import Document
                doc = Document(filepath)
                for para in doc.paragraphs:
                    raw_text += para.text + "\n"
            except ImportError:
                raise RuntimeError("python-docx not installed. Run: pip install python-docx")
        else:
            if not OCR_AVAILABLE:
                raise RuntimeError("Tesseract OCR not available. Install pytesseract and tesseract.")
            # Use preprocessed, enhanced image if available, else fallback to raw filepath
            img = Image.open(upload_path)
            # PSM 6 = Assume a single uniform block of text (often works well for structured docs like tables)
            raw_text = pytesseract.image_to_string(img, config='--psm 6')

        return parse_gm_timetable(raw_text)

    finally:
        # Guarantee cleanup of temporary enhanced image file
        if preprocessed_path and os.path.exists(preprocessed_path):
            try:
                os.remove(preprocessed_path)
            except Exception:
                pass

# ── GM University Timetable Fallback OCR Parser ───────────────────────────────

def parse_gm_timetable(raw_text):
    """
    Parse a GM University timetable from Tesseract OCR text.

    KEY QUIRKS FOUND IN REAL LOGS:
    1. Subject codes are MIXED CASE in OCR output:
         "Dsc" instead of "DSC", "sDM" instead of "SDM"
       -> All codes must be normalized to UPPERCASE.

    2. Day rows WRAP across multiple consecutive lines:
         "WED   SDM - Practice"
         "UDNT  AIML  Break  Dsc  ATC  UDNT (1-3 GMU LAB)"
         "Session"
       -> Must collect ALL lines belonging to each day into one block.

    3. THU row may start with "i" (OCR misread) or contain "Mentor Mentee".

    4. Allocation table codes are also mixed-case:
         "Dsc", "CTJ", "sDM"
       -> Use the UE24CS course-code (e.g. UE24CS2401) as an anchor to find the
          short code that appears immediately BEFORE it.
    """
    # Normalize decimal times: 8.00am -> 8:00am
    raw_text = re.sub(r'(\d{1,2})\s*\.\s*(\d{2})\s*(am|pm)', r'\1:\2\3', raw_text, flags=re.IGNORECASE)

    # Log raw OCR
    try:
        with open("logs.txt", "a", encoding="utf-8") as f:
            f.write("\n--- OCR RAW START ---\n" + raw_text + "\n--- OCR RAW END ---\n")
    except Exception:
        pass

    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    # ── Step A: Metadata ────────────────────────────────────────────────────────
    default_classroom = "TBD"
    default_department = "CS - Cyber Security"

    for line in lines:
        # Room No (CR-06, R-14(C-025), CR-14(C-025))
        room_m = re.search(r'\b((?:CR-?|R-?)\d+(?:\([A-Z0-9\-]+\))?)', line, re.IGNORECASE)
        if room_m:
            default_classroom = room_m.group(1).upper()
        # Department
        prog_m = re.search(r'Program\s*[:\-]\s*(.+)', line, re.IGNORECASE)
        if prog_m:
            default_department = prog_m.group(1).strip().rstrip(',').strip()
        elif re.search(r'CYBER\s*SECURITY', line, re.IGNORECASE):
            default_department = "CS - Cyber Security"

    # ── Step B: Time slots ─────────────────────────────────────────────────────
    ts_pattern = re.compile(
        r'(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[Tt][Oo]\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)',
        re.IGNORECASE
    )
    seen_slots, time_slots_header = set(), []
    for start, end in ts_pattern.findall(raw_text):
        key = f"{start.strip().lower()}-{end.strip().lower()}"
        if key not in seen_slots:
            seen_slots.add(key)
            time_slots_header.append(f"{start.strip()} To {end.strip()}")

    if len(time_slots_header) < 4:
        time_slots_header = [
            "8:00am To 9:00am", "9:00am To 10:00am",
            "10:00am To 10:30am",       # Break
            "10:30am To 11:30am", "11:30am To 12:30pm",
            "12:30pm To 1:30pm",        # Lunch
            "1:30pm To 2:30pm", "2:30pm To 3:30pm", "3:30pm To 5:00pm",
        ]

    break_slot_indices = set()
    for i, slot in enumerate(time_slots_header):
        sl = slot.lower()
        if ("10:00" in sl and "10:30" in sl) or ("12:30" in sl and "1:30" in sl):
            break_slot_indices.add(i)

    # ── Step C: Allocation map (UPPERCASE_CODE -> full_name + teacher) ─────────
    # Uses the UE24CS-style course code as a reliable anchor to find the short code.
    allocation_map = {}
    in_allocation = False
    allocation_done = False

    for line in lines:
        if allocation_done:
            break
        line_up = line.upper()

        if not in_allocation:
            if re.search(r'ALLOCATION\s+OF\s+COURSES', line_up) or \
               ("COURSE TITLE" in line_up and "COURSE CODE" in line_up):
                in_allocation = True
            continue

        if re.search(r'\bPBL\b', line_up):
            _extract_alloc_line(line, allocation_map)
            allocation_done = True
            continue

        # Skip pure headers / noise / Faculty Mentors header
        if re.search(r'^(COURSE TITLE|COURSE CODE|CREDITS|FACULTY MENTOR|TOTAL|INTERNAL)', line_up):
            continue
        if re.search(r'^[\d\s\.\-\[\]\/]+$', line):
            continue

        _extract_alloc_line(line, allocation_map)

    # ── Step D: Parse grid rows (MON-SAT), collecting multi-line blocks ────────
    DAY_MAP = {
        "MON": "Monday", "TUE": "Tuesday", "WED": "Wednesday",
        "THU": "Thursday", "FRI": "Friday", "SAT": "Saturday",
    }
    DAY_RE = re.compile(r'^\s*(MON|TUE|WED|THU|FRI|SAT)\b', re.IGNORECASE)

    # Words that mean "skip this cell"
    SKIP_WORDS = {
        "BREAK", "LUNCH", "PBL", "SDTCD", "CIBI", "SA", "CASP",
        "MENTOR", "MENTEE", "LAB", "PRACTICE", "SESSION",
        "SPORTS", "CULTURAL", "CLUB", "ACTIVITIES", "GMU",
        "CODING", "ACTIVITY",
    }

    # Codes that should NEVER appear as grid entries (even if in allocation_map)
    GRID_SKIP_CODES = {"PBL", "SDTCD", "CASP", "CIBI", "SA"}

    # Collect all lines that belong to each day (stop at Allocation section)
    day_blocks = {}   # d_code -> [line, ...]
    current_day = None
    past_allocation = False

    for line in lines:
        if re.search(r'ALLOCATION\s+OF\s+COURSES', line.upper()):
            past_allocation = True
        if past_allocation:
            break
        m = DAY_RE.match(line)
        if m:
            current_day = m.group(1).upper()
            day_blocks[current_day] = [line]
        elif current_day:
            day_blocks[current_day].append(line)

    entries = []
    for d_code in ["MON", "TUE", "WED", "THU", "FRI", "SAT"]:
        if d_code not in day_blocks:
            continue

        # Merge all lines for this day, strip the leading day label
        merged = " ".join(day_blocks[d_code])
        merged = re.sub(r'^\s*(MON|TUE|WED|THU|FRI|SAT)\b', '', merged, flags=re.IGNORECASE).strip()

        # Tokenize: first try 2+ spaces or pipe
        tokens = [t.strip() for t in re.split(r'\s{2,}|\|', merged) if t.strip()]
        # If all day content collapsed into 1 token (multi-line merge), also split on spaces
        if len(tokens) <= 2:
            tokens = [t.strip() for t in merged.split() if t.strip()]

        slot_subjects = []
        for token in tokens:
            token_up = token.upper()
            token_clean = re.sub(r'[^A-Z0-9]', '', token_up)

            matched_code = None
            # 1. Exact match in allocation map
            if token_up in allocation_map:
                matched_code = token_up
            elif token_clean in allocation_map:
                matched_code = token_clean
            else:
                # 2. Any known code appearing as a whole word within the token
                for code in allocation_map:
                    if re.search(r'\b' + re.escape(code) + r'\b', token_up):
                        matched_code = code
                        break

            if matched_code:
                if matched_code in GRID_SKIP_CODES:
                    slot_subjects.append("__SKIP__")
                else:
                    slot_subjects.append(matched_code)
            elif any(sw in token_up for sw in SKIP_WORDS):
                slot_subjects.append("__SKIP__")
            elif re.match(r'^[-—]+$', token):
                slot_subjects.append("__SKIP__")
            elif len(token_clean) >= 2 and not re.match(r'^\d+$', token_clean):
                # Unknown but non-empty token — count as a slot placeholder so
                # subsequent codes align to the right time slots
                slot_subjects.append("__UNKNOWN__")

        # Map subject list to time slots
        slot_idx = 0
        for t_idx, time_slot in enumerate(time_slots_header):
            if slot_idx >= len(slot_subjects):
                break
            if t_idx in break_slot_indices:
                continue
            subj = slot_subjects[slot_idx]
            slot_idx += 1

            if subj in ("__SKIP__", "__UNKNOWN__") or not subj:
                continue

            info = allocation_map.get(subj, {})
            entries.append({
                "day": DAY_MAP[d_code],
                "time_slot": time_slot,
                "subject": info.get("full_name", subj),
                "teacher": info.get("teacher", "TBD"),
                "classroom": default_classroom,
                "department": default_department,
            })

    return entries


def _extract_alloc_line(line, allocation_map):
    """
    Extract (UPPERCASE_code, full_name, teacher) from one Allocation of Courses row.

    REAL OCR examples (from logs.txt):
      "Artificial intelligence and Machine Learning AIML UE24CS2401 3 [al 2] 2 Bhumika B BL Bhumika"
      "'Software Development and Methodology 'SDM UE24CS2402 3 [2] 21/0 Shwetha DS 'SDS B2 'Swathi A"
      "Discrete Structures for Computing Dsc UE24¢S2403 3 | 2] 2] 0 Chaithra TJ au a Gas"
      "Project Based Learning /Mini Project PBL UE24CS2406 2 [ol ola Dr Rachana P G RPG"

    STRATEGY:
      PRIMARY: Find UE24CS-style course code (handles OCR variants like UE24¢S2403).
               The SHORT code is the LAST 2-6 letter word immediately BEFORE the course code.
      FALLBACK: Find the first standalone 2-6 letter ALL-CAPS or Title-case abbreviation.

      TEACHER: Proper-name pattern in text AFTER the course code.
    """
    line = line.strip()
    if not line or len(line) < 5:
        return

    NOISE = {
        "TO", "OF", "AND", "OR", "FOR", "THE", "IN", "ON", "AT",
        "WITH", "BY", "A", "IS", "BE", "NF", "GM", "CS", "FET",
        "B", "L", "T", "P", "IA", "SA", "HOD", "PHD",
        "DR", "MR", "MRS", "MS", "PROF",
        "TOTAL", "CREDITS", "COURSE", "TITLE", "CODE", "BATCH",
        "FACULTY", "MENTOR", "NAME", "INTERNAL", "ASSESSMENT", "DATE",
        "APRIL", "MARCH", "JUNE", "JANUARY", "FEBRUARY",
    }

    short_code = None
    teacher_search_start = 0

    # ── PRIMARY: anchor on UE\d\dXS\d\d\d\d (handles OCR chars like ¢) ────────
    # Pattern covers UE24CS2401, UEZ4CS2405, UE24¢S2403, etc.
    course_code_m = re.search(r'\b[A-Z]{2}\d{2}.{1,2}\d{4}\b', line, re.IGNORECASE)
    if course_code_m:
        teacher_search_start = course_code_m.end()
        before = line[:course_code_m.start()].strip()
        # Walk backward through words to find the short code
        for w in reversed(before.split()):
            clean_w = re.sub(r"[^A-Za-z]", "", w)
            if 2 <= len(clean_w) <= 6 and clean_w.upper() not in NOISE:
                short_code = clean_w.upper()
                break

    # ── FALLBACK: first distinctive abbreviation ───────────────────────────────
    if not short_code:
        for m in re.finditer(r'\b([A-Za-z]{2,6})\b', line):
            w = m.group(1)
            candidate = w.upper()
            if candidate in NOISE:
                continue
            # Must look like an abbreviation: ALL-CAPS or Title-cased short word
            if re.match(r'^[A-Z]{2,6}$', w) or re.match(r'^[A-Z][a-z]{1,5}$', w):
                short_code = candidate
                teacher_search_start = m.end()
                break

    if not short_code:
        return

    # ── Full name: text BEFORE short code (case-insensitive search) ───────────
    m2 = re.search(re.escape(short_code), line, re.IGNORECASE)
    code_pos = m2.start() if m2 else 0
    before_code = line[:code_pos].strip()
    full_name = re.sub(r"^['\";,\s]+|['\";,\s]+$", '', before_code).strip()
    full_name = re.sub(r'^[\d\.\s]+', '', full_name).strip()
    if not full_name or len(full_name) < 3:
        full_name = short_code

    # ── Teacher: proper name after the course code ─────────────────────────────
    after_raw = line[teacher_search_start:].strip()
    # Remove OCR noise tokens
    after_clean = re.sub(r'\b[A-Z]{2}\d{4,}\b', ' ', after_raw)          # course codes
    after_clean = re.sub(r'[\[\]\|]', ' ', after_clean)                   # brackets/pipes
    after_clean = re.sub(r'\b\d+\b', ' ', after_clean)                    # standalone digits
    after_clean = re.sub(r'\b[A-Z]{1,3}\d+\b', ' ', after_clean)         # B1, B2, NF
    after_clean = re.sub(r'\b(IA|SA|NF|RPG|SDS|CTJ|PNT|BL|SDS)\b', ' ', after_clean, flags=re.IGNORECASE)
    after_clean = re.sub(r'/.*', ' ', after_clean)                        # remove /Mini Project etc

    # Look for teacher name: allows initials like "Bhumika B", "Chaithra T J", "Pavan Kumar N T"
    teacher_m = re.search(
        r'\b([A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[A-Z]\.?))+)',
        after_clean
    )
    if not teacher_m:
        teacher_m = re.search(
            r'\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]*\.?){1,}(?:\s+[A-Z]\.?)*)\b',
            after_clean
        )
    teacher = "TBD"
    if teacher_m:
        raw_teacher = teacher_m.group(1).strip()
        # Remove any trailing repeated word (Faculty Name column artifact)
        # e.g. "Bhumika B Bhumika" -> "Bhumika B"
        words = raw_teacher.split()
        seen_w = []
        for w in words:
            if w in seen_w:
                break
            seen_w.append(w)
        teacher = " ".join(seen_w)

    allocation_map[short_code] = {"full_name": full_name, "teacher": teacher}


# Backward-compat aliases
def _try_extract_allocation_line(line, allocation_map):
    _extract_alloc_line(line, allocation_map)


def _try_extract_subject_teacher_line(line, allocation_map):
    """Extract (code, teacher) from blank-template Subject|Teacher row."""
    line = line.strip()
    if not line or len(line) < 2:
        return
    NOISE = {
        "TO", "OF", "AND", "OR", "FOR", "THE", "IN", "ON", "AT",
        "WITH", "BY", "A", "IS", "BE", "GM", "CS", "B", "L", "T",
        "P", "IA", "SA", "FET", "HOD", "DR", "MR", "MRS", "MS",
        "PROF", "SUBJECT", "TEACHER", "TIME", "DAY", "TOTAL",
    }
    m = re.search(r'\b([A-Z]{2,6}(?:\(P\))?)\b', line)
    if not m:
        return
    code = re.sub(r'\(P\)$', '', m.group(1))
    if code in NOISE:
        return
    after = line[m.end():].strip()
    after = re.sub(r'\bTeacher\b', '', after, flags=re.IGNORECASE).strip()
    after = re.sub(r'^[\|\-\s:]+', '', after).strip()
    teacher = after if len(after) > 1 else "TBD"
    allocation_map[code] = {"full_name": code, "teacher": teacher}
