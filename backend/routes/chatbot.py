from flask import Blueprint, request, jsonify
import os
import re
from werkzeug.utils import secure_filename
from db import classrooms_col, timetable_col, teachers_col
from ml.nlp_engine import NLPEngine
from ml.ocr_processor import process_timetable_file, OCR_AVAILABLE


chatbot_bp = Blueprint("chatbot", __name__)

nlp_engine = None


def get_nlp_engine():
    global nlp_engine
    if nlp_engine is None:
        nlp_engine = NLPEngine()
        nlp_engine.build_index()
    return nlp_engine


@chatbot_bp.route("/api/chatbot", methods=["POST"])
def chat():
    data = request.get_json()
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"response": "Please ask me something about classrooms, schedules, or locations."})

    engine = get_nlp_engine()

    # Classify the question type
    question_type = engine.classify_question(query)

    # Search for relevant information
    results = engine.search(query)

    if not results:
        return jsonify({
            "response": "I couldn't find relevant information. Try searching for a classroom name, subject, teacher, or department.",
            "type": question_type,
            "results": [],
        })

    # Format response based on question type
    response_text = format_response(question_type, results)

    return jsonify({
        "response": response_text,
        "type": question_type,
        "results": results[:5],
    })


def format_response(question_type, results):
    if not results:
        return "No information found."

    top = results[0]

    if question_type == "location":
        return (
            f"📍 **{top.get('name', 'N/A')}** is located in "
            f"**{top.get('building', 'N/A')}**, Floor {top.get('floor', 'N/A')}, "
            f"Room {top.get('room_number', 'N/A')}. "
            f"Department: {top.get('department', 'N/A')}."
        )
    elif question_type == "schedule":
        if "time_slot" in top:
            return (
                f"📅 **{top.get('subject', 'N/A')}** is scheduled on "
                f"**{top.get('day', 'N/A')}** at {top.get('time_slot', 'N/A')} "
                f"in {top.get('classroom', 'N/A')}. "
                f"Teacher: {top.get('teacher', 'N/A')}."
            )
        return (
            f"📍 **{top.get('name', 'N/A')}** — "
            f"Currently: {top.get('current_subject', 'No class')} | "
            f"Status: {top.get('status', 'unknown')}."
        )
    elif question_type == "status":
        status = top.get("status", "unknown")
        emoji = "🔴" if status == "occupied" else "🟢"
        return (
            f"{emoji} **{top.get('name', 'N/A')}** is currently **{status.upper()}**. "
            f"{'Subject: ' + top.get('current_subject', '') + ' | Teacher: ' + top.get('current_teacher', '') if status == 'occupied' else 'The room is available.'}"
        )
    else:
        return (
            f"ℹ️ **{top.get('name', top.get('subject', 'N/A'))}** — "
            f"Department: {top.get('department', 'N/A')} | "
            f"{'Building: ' + top.get('building', 'N/A') if 'building' in top else 'Classroom: ' + top.get('classroom', 'N/A')}"
        )


@chatbot_bp.route("/api/admin/chatbot", methods=["POST"])
def admin_chat():
    query = request.form.get("query", "").strip()
    image_file = request.files.get("image")

    # If image is uploaded, process via OCR
    if image_file and image_file.filename:
        if not OCR_AVAILABLE:
            return jsonify({"response": "OCR dependencies not available.", "type": "error", "results": []})
        
        filename = secure_filename(image_file.filename)
        upload_dir = os.path.join(os.getcwd(), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        image_file.save(filepath)

        try:
            entries = process_timetable_file(filepath)
            return jsonify({
                "response": "Here is the timetable extracted from the image. Please review before saving.",
                "type": "timetable_preview",
                "results": entries
            })
        except Exception as e:
            return jsonify({
                "response": f"Failed to process image: {str(e)}",
                "type": "error",
                "results": []
            })
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

    if not query:
        return jsonify({"response": "Please ask me something or upload a timetable image.", "type": "info", "results": []})

    # Regex for "add subject"
    match = re.search(r"(?i)add\s+subject\s+(.*?)\s+(?:by|for)\s+(.*?)\s+in\s+room\s+(.*?)\s+on\s+(.*?)\s+from\s+(.*)", query)
    if match:
        entry = {
            "subject": match.group(1).strip(),
            "teacher": match.group(2).strip(),
            "classroom": match.group(3).strip(),
            "day": match.group(4).strip(),
            "time_slot": match.group(5).strip(),
            "department": "Admin Added"
        }
        return jsonify({
            "response": "I parsed your request. Review the entry formatting below and click Save.",
            "type": "timetable_preview",
            "results": [entry]
        })
    elif query.lower().startswith("add subject"):
        return jsonify({
            "response": "To add a subject using text, please use this format: 'Add subject [Subject] by [Teacher] in room [Classroom] on [Day] from [Time]'",
            "type": "info",
            "results": []
        })

    # Fallback to normal chat for admin
    engine = get_nlp_engine()
    question_type = engine.classify_question(query)
    results = engine.search(query)

    if not results:
        return jsonify({
            "response": "I couldn't find relevant information.",
            "type": question_type,
            "results": [],
        })

    response_text = format_response(question_type, results)

    return jsonify({
        "response": response_text,
        "type": question_type,
        "results": results[:5],
    })

@chatbot_bp.route("/api/chatbot/rebuild", methods=["POST"])
def rebuild_index():
    """Rebuild the NLP index with current DB data."""
    global nlp_engine
    nlp_engine = NLPEngine()
    nlp_engine.build_index()
    return jsonify({"message": "Index rebuilt successfully"})
