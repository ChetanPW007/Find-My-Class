from flask import Blueprint, request, jsonify
from bson import ObjectId
from db import timetable_col
from routes.auth import token_required, admin_required
import os
import datetime
import re

timetable_bp = Blueprint("timetable", __name__)


def serialize_entry(e):
    e["_id"] = str(e["_id"])
    return e


# ─── GM University default time slots ────────────────────────────────────────
DEFAULT_SLOTS = [
    {"slot": 1, "label": "8:00–9:00",   "start": "08:00", "end": "09:00", "is_break": False},
    {"slot": 2, "label": "9:00–10:00",  "start": "09:00", "end": "10:00", "is_break": False},
    {"slot": 3, "label": "10:00–10:30", "start": "10:00", "end": "10:30", "is_break": True,  "break_label": "Break"},
    {"slot": 4, "label": "10:30–11:30", "start": "10:30", "end": "11:30", "is_break": False},
    {"slot": 5, "label": "11:30–12:30", "start": "11:30", "end": "12:30", "is_break": False},
    {"slot": 6, "label": "12:30–1:30",  "start": "12:30", "end": "13:30", "is_break": True,  "break_label": "Lunch Break"},
    {"slot": 7, "label": "1:30–2:30",   "start": "13:30", "end": "14:30", "is_break": False},
    {"slot": 8, "label": "2:30–3:30",   "start": "14:30", "end": "15:30", "is_break": False},
    {"slot": 9, "label": "3:30–5:00",   "start": "15:30", "end": "17:00", "is_break": False},
]

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


# ─── OCR Upload ───────────────────────────────────────────────────────────────
@timetable_bp.route("/api/timetable/upload", methods=["POST"])
@token_required
@admin_required
def upload_timetable():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, file.filename)
    file.save(filepath)

    try:
        from ml.ocr_processor import process_timetable_file
        entries = process_timetable_file(filepath)
        return jsonify({
            "message": f"Extracted {len(entries)} entries",
            "entries": entries,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


# ─── Get all (with optional filters) ─────────────────────────────────────────
@timetable_bp.route("/api/timetable", methods=["GET"])
def get_timetable():
    day = request.args.get("day")
    department = request.args.get("department")
    section = request.args.get("section")
    teacher = request.args.get("teacher")
    query = {}
    if day:
        query["day"] = {"$regex": day, "$options": "i"}
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if section:
        query["section"] = {"$regex": f"^{re.escape(section)}$", "$options": "i"}
    if teacher:
        query["teacher"] = {"$regex": teacher, "$options": "i"}
    entries = list(timetable_col.find(query))
    return jsonify([serialize_entry(e) for e in entries])


# ─── Get default time slots ───────────────────────────────────────────────────
@timetable_bp.route("/api/timetable/slots", methods=["GET"])
def get_slots():
    return jsonify(DEFAULT_SLOTS)


# ─── Save entire grid for a dept+section (replaces existing entries) ──────────
@timetable_bp.route("/api/timetable/save-grid", methods=["POST"])
@token_required
@admin_required
def save_grid():
    data = request.get_json()
    department = data.get("department")
    section = data.get("section", "").strip().upper()
    entries = data.get("entries", [])

    if not department:
        return jsonify({"error": "department is required"}), 400
    if not section:
        return jsonify({"error": "section is required"}), 400

    # Validate section format: 3-6 uppercase alphanumeric chars (e.g. CY2A, CS1B)
    if not re.match(r'^[A-Z0-9]{2,6}$', section):
        return jsonify({"error": "Section must be 2–6 alphanumeric characters (e.g. CY2A, CS1B)"}), 400

    # Delete existing entries for this dept+section grid
    timetable_col.delete_many({"department": department, "section": section})

    # Insert new entries (skip empty cells)
    valid_entries = []
    for e in entries:
        if e.get("subject", "").strip():
            entry = {
                "day": e.get("day", ""),
                "slot": e.get("slot", 1),
                "time_slot": e.get("time_slot", ""),
                "subject": e.get("subject", "").strip(),
                "teacher": e.get("teacher", "").strip(),
                "classroom": e.get("classroom", "").strip(),
                "department": department,
                "section": section,
                "span": int(e.get("span", 1)),   # 1 = normal, 2 = 2-hour lab
            }
            valid_entries.append(entry)

    if valid_entries:
        timetable_col.insert_many(valid_entries)

    return jsonify({"message": f"Saved {len(valid_entries)} entries for {department} — {section}"}), 200


# ─── Schedule check (for auto-free + notifications) ──────────────────────────
@timetable_bp.route("/api/timetable/schedule-check", methods=["GET"])
@token_required
def schedule_check():
    """
    Returns classes for the current teacher that are:
    - currently active (ongoing)
    - ending in ≤5 minutes (warning)
    - already ended (to auto-free)
    """
    username = request.user.get("username")
    teacher_name = request.user.get("name", username)

    now = datetime.datetime.now()
    current_day = now.strftime("%A")  # e.g. "Monday"
    current_time = now.strftime("%H:%M")

    # Find all entries for this teacher today
    entries = list(timetable_col.find({
        "day": {"$regex": f"^{current_day}$", "$options": "i"},
        "$or": [
            {"teacher": {"$regex": re.escape(teacher_name), "$options": "i"}},
            {"teacher": {"$regex": re.escape(username), "$options": "i"}},
        ]
    }))

    result = {
        "ongoing": [],
        "warning": [],   # ends in ≤5 min
        "ended": [],     # already passed end time
    }

    for e in entries:
        e["_id"] = str(e["_id"])
        # Find the slot metadata
        slot_num = e.get("slot", 0)
        span = e.get("span", 1)
        # Find end time from DEFAULT_SLOTS
        end_slot_num = slot_num + span - 1
        slot_meta = next((s for s in DEFAULT_SLOTS if s["slot"] == slot_num), None)
        end_meta = next((s for s in DEFAULT_SLOTS if s["slot"] == end_slot_num), slot_meta)

        if not slot_meta or not end_meta:
            continue

        start_t = slot_meta["start"]   # "08:00"
        end_t = end_meta["end"]         # "09:00"

        if current_time < start_t:
            pass  # Future class, ignore
        elif start_t <= current_time < end_t:
            # Calculate minutes to end
            end_h, end_m = map(int, end_t.split(":"))
            cur_h, cur_m = map(int, current_time.split(":"))
            mins_to_end = (end_h * 60 + end_m) - (cur_h * 60 + cur_m)
            e["mins_to_end"] = mins_to_end
            e["end_time"] = end_t
            e["start_time"] = start_t
            if mins_to_end <= 5:
                result["warning"].append(e)
            else:
                result["ongoing"].append(e)
        elif current_time >= end_t:
            e["end_time"] = end_t
            e["start_time"] = start_t
            result["ended"].append(e)

    return jsonify(result)


# ─── Single entry CRUD ────────────────────────────────────────────────────────
@timetable_bp.route("/api/timetable/batch", methods=["POST"])
@token_required
@admin_required
def add_batch_timetable():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of entries"}), 400
    if data:
        # add default span/section if missing
        for item in data:
            item.setdefault("span", 1)
            item.setdefault("section", "")
        timetable_col.insert_many(data)
    return jsonify({"message": f"Successfully added {len(data)} entries"}), 201


@timetable_bp.route("/api/timetable", methods=["POST"])
@token_required
@admin_required
def add_timetable_entry():
    data = request.get_json()
    required = ["day", "time_slot", "subject", "teacher", "classroom", "department"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    section = data.get("section", "").strip().upper()
    entry = {
        "day": data["day"],
        "slot": data.get("slot", 0),
        "time_slot": data["time_slot"],
        "subject": data["subject"],
        "teacher": data["teacher"],
        "classroom": data["classroom"],
        "department": data["department"],
        "section": section,
        "span": int(data.get("span", 1)),
    }
    result = timetable_col.insert_one(entry)
    entry["_id"] = str(result.inserted_id)
    return jsonify(entry), 201


@timetable_bp.route("/api/timetable/<id>", methods=["PUT"])
@token_required
@admin_required
def update_timetable_entry(id):
    data = request.get_json()
    update_fields = {}
    allowed = ["day", "slot", "time_slot", "subject", "teacher", "classroom", "department", "section", "span"]
    for field in allowed:
        if field in data:
            update_fields[field] = data[field]
    if "section" in update_fields:
        update_fields["section"] = update_fields["section"].strip().upper()
    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400

    timetable_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    entry = timetable_col.find_one({"_id": ObjectId(id)})
    if not entry:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(serialize_entry(entry))


@timetable_bp.route("/api/timetable/<id>", methods=["DELETE"])
@token_required
@admin_required
def delete_timetable_entry(id):
    result = timetable_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify({"message": "Entry deleted"})
