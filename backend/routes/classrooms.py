from flask import Blueprint, request, jsonify
from bson import ObjectId
from routes.auth import token_required, admin_required
import re
import datetime
from db import classrooms_col

classrooms_bp = Blueprint("classrooms", __name__)


def serialize_classroom(c):
    c["_id"] = str(c["_id"])
    return c


def auto_free_classrooms():
    """Lazily mark classrooms as free if occupied for more than 1 hour"""
    now = datetime.datetime.now()
    one_hour_ago = now - datetime.timedelta(hours=1)
    
    # Find occupied classrooms with occupied_at before one_hour_ago
    # Or classrooms that are occupied but don't have occupied_at (legacy or manual start)
    # If they don't have occupied_at, we can't be sure, but let's assume if we just added the feature,
    # we only track new ones. Or we can set a default if missing.
    
    # Update classrooms where status is 'occupied' and occupied_at < one_hour_ago
    # Note: we store occupied_at as ISO string or datetime object? Let's use ISO strings for simplicity with JSON, 
    # but datetime objects are better for MongoDB queries. I'll use datetime objects.
    
    query = {
        "status": "occupied",
        "occupied_at": {"$lt": one_hour_ago}
    }
    
    update = {
        "$set": {
            "status": "free",
            "current_teacher": "",
            "current_teacher_id": "",
            "current_subject": "",
            "current_semester": "",
            "current_section": "",
            "occupied_at": None
        }
    }
    
    classrooms_col.update_many(query, update)


@classrooms_bp.route("/api/classrooms", methods=["GET"])
def get_classrooms():
    auto_free_classrooms()
    department = request.args.get("department")
    building = request.args.get("building")
    status = request.args.get("status")

    query = {}
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    if building:
        query["building"] = {"$regex": building, "$options": "i"}
    if status:
        query["status"] = status

    classrooms = list(classrooms_col.find(query))
    return jsonify([serialize_classroom(c) for c in classrooms])


@classrooms_bp.route("/api/classrooms/search", methods=["GET"])
def search_classrooms():
    auto_free_classrooms()
    q = request.args.get("q", "").strip()
    if not q:
        classrooms = list(classrooms_col.find())
        return jsonify([serialize_classroom(c) for c in classrooms])

    regex = {"$regex": re.escape(q), "$options": "i"}
    query = {
        "$or": [
            {"name": regex},
            {"department": regex},
            {"building": regex},
            {"floor": regex},
            {"room_number": regex},
            {"current_subject": regex},
            {"current_teacher": regex},
            {"current_section": regex},
            {"landmark": regex},
            {"type": regex},
        ]
    }
    classrooms = list(classrooms_col.find(query))
    return jsonify([serialize_classroom(c) for c in classrooms])


@classrooms_bp.route("/api/classrooms", methods=["POST"])
@token_required
@admin_required
def add_classroom():
    data = request.get_json()
    required = ["name", "department", "building", "floor", "room_number", "type"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    classroom = {
        "name": data["name"],
        "department": data["department"],
        "building": data["building"],
        "floor": data["floor"],
        "room_number": data["room_number"],
        "type": data.get("type", "classroom"),
        "capacity": data.get("capacity", 0),
        "has_smartboard": data.get("has_smartboard", False),
        "landmark": data.get("landmark", ""),
        "status": "free",
        "current_subject": "",
        "current_teacher": "",
        "current_teacher_id": "",
        "current_semester": "",
        "current_section": "",
    }
    result = classrooms_col.insert_one(classroom)
    classroom["_id"] = str(result.inserted_id)
    return jsonify(classroom), 201


@classrooms_bp.route("/api/classrooms/<id>", methods=["PUT"])
@token_required
@admin_required
def update_classroom(id):
    data = request.get_json()
    update_fields = {}
    allowed = [
        "name", "department", "building", "floor",
        "room_number", "type", "capacity", "has_smartboard",
        "landmark"
    ]
    for field in allowed:
        if field in data:
            update_fields[field] = data[field]

    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400

    classrooms_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    classroom = classrooms_col.find_one({"_id": ObjectId(id)})
    if not classroom:
        return jsonify({"error": "Classroom not found"}), 404
    return jsonify(serialize_classroom(classroom))


@classrooms_bp.route("/api/classrooms/<id>", methods=["DELETE"])
@token_required
@admin_required
def delete_classroom(id):
    result = classrooms_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        return jsonify({"error": "Classroom not found"}), 404
    return jsonify({"message": "Classroom deleted"})


@classrooms_bp.route("/api/classrooms/<id>/status", methods=["PUT"])
@token_required
def update_status(id):
    data = request.get_json()
    action = data.get("action")

    if action not in ["start", "end"]:
        return jsonify({"error": "Action must be 'start' or 'end'"}), 400

    classroom = classrooms_col.find_one({"_id": ObjectId(id)})
    if not classroom:
        return jsonify({"error": "Classroom not found"}), 404

    if action == "start":
        update = {
            "status": "occupied",
            "current_teacher": request.user.get("name", ""),
            "current_teacher_id": request.user.get("user_id", ""),
            "current_subject": data.get("subject", ""),
            "current_semester": data.get("semester", ""),
            "current_section": data.get("section", ""),
            "occupied_at": datetime.datetime.now()
        }
    else:
        update = {
            "status": "free",
            "current_teacher": "",
            "current_teacher_id": "",
            "current_subject": "",
            "current_semester": "",
            "current_section": "",
            "occupied_at": None
        }

    classrooms_col.update_one({"_id": ObjectId(id)}, {"$set": update})
    classroom = classrooms_col.find_one({"_id": ObjectId(id)})
    return jsonify(serialize_classroom(classroom))


@classrooms_bp.route("/api/classrooms/<id>/upcoming", methods=["GET"])
def get_upcoming_classes(id):
    from db import timetable_col
    from datetime import datetime
    import re

    classroom = classrooms_col.find_one({"_id": ObjectId(id)})
    if not classroom:
        return jsonify({"error": "Classroom not found"}), 404

    # We use both name and room_number because different timetables might use either
    room_name = classroom.get("name")
    room_num = classroom.get("room_number")

    # Get current day
    now = datetime.now()
    current_day = now.strftime("%A") # e.g. "Monday"

    # Fetch all entries for this classroom for today
    query = {
        "day": {"$regex": f"^{current_day}$", "$options": "i"},
        "$or": [
            {"classroom": {"$regex": re.escape(room_name), "$options": "i"}},
            {"classroom": {"$regex": re.escape(room_num), "$options": "i"}},
        ]
    }
    
    entries = list(timetable_col.find(query).sort("time_slot", 1))
    
    # Simple time parsing to filter "upcoming"
    upcoming = []
    current_hour_min = now.strftime("%H:%M") # "HH:MM" 24h
    
    for e in entries:
        e["_id"] = str(e["_id"])
        # Attempt to extract start time from time_slot (e.g. "09:00-10:00" or "9.00 am To 10.00 am")
        time_str = e.get("time_slot", "").lower()
        
        # Match "9.00 am" or "09:00"
        time_match = re.search(r'(\d{1,2})[:.](\d{2})\s*(am|pm)?', time_str)
        if time_match:
            h = int(time_match.group(1))
            m = int(time_match.group(2))
            meridiem = time_match.group(3)
            
            if meridiem == "pm" and h < 12: h += 12
            if meridiem == "am" and h == 12: h = 0
            
            start_time_conv = f"{h:02d}:{m:02d}"
            
            # If start time is in the future
            if start_time_conv > current_hour_min:
                upcoming.append(e)
            elif is_currently_happening(time_str, current_hour_min):
                # Optionally mark as "Ongoing"
                e["is_ongoing"] = True
                upcoming.append(e)
        else:
            # Fallback for poorly formatted times
            upcoming.append(e)

    return jsonify(upcoming)


def is_currently_happening(time_slot, current_time_24h):
    """Simple check if current time falls within slot [Start - End]"""
    import re
    times = re.findall(r'(\d{1,2})[:.](\d{2})\s*(am|pm)?', time_slot.lower())
    if len(times) < 2: return False
    
    start_h, start_m, start_mer = times[0]
    end_h, end_m, end_mer = times[1]
    
    # Convert to 24h
    sh, sm = int(start_h), int(start_m)
    if start_mer == "pm" and sh < 12: sh += 12
    if start_mer == "am" and sh == 12: sh = 0
    
    eh, em = int(end_h), int(end_m)
    if end_mer == "pm" and eh < 12: eh += 12
    if end_mer == "am" and eh == 12: eh = 0
    
    start_24 = f"{sh:02d}:{sm:02d}"
    end_24 = f"{eh:02d}:{em:02d}"
    
    return start_24 <= current_time_24h <= end_24
