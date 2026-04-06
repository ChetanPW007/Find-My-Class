from flask import Blueprint, request, jsonify
from bson import ObjectId
from db import notifications_col
from routes.auth import token_required
import datetime

notifications_bp = Blueprint("notifications", __name__)


def serialize(n):
    n["_id"] = str(n["_id"])
    return n


@notifications_bp.route("/api/notifications", methods=["GET"])
@token_required
def get_notifications():
    """Get notifications for the logged-in teacher (from JWT)."""
    username = request.user.get("username")
    seen_filter = request.args.get("unseen_only", "false").lower() == "true"
    query = {"username": username}
    if seen_filter:
        query["seen"] = False
    notes = list(notifications_col.find(query).sort("created_at", -1).limit(50))
    return jsonify([serialize(n) for n in notes])


@notifications_bp.route("/api/notifications", methods=["POST"])
@token_required
def create_notification():
    """Save a notification (called by frontend schedule monitor)."""
    data = request.get_json()
    note = {
        "username": data.get("username"),
        "type": data.get("type", "info"),      # "warning" | "ended" | "info"
        "message": data.get("message", ""),
        "subject": data.get("subject", ""),
        "classroom": data.get("classroom", ""),
        "seen": False,
        "created_at": datetime.datetime.utcnow().isoformat(),
    }
    result = notifications_col.insert_one(note)
    note["_id"] = str(result.inserted_id)
    return jsonify(note), 201


@notifications_bp.route("/api/notifications/mark-seen", methods=["PUT"])
@token_required
def mark_seen():
    """Mark all notifications as seen for the logged-in user."""
    username = request.user.get("username")
    notifications_col.update_many({"username": username, "seen": False}, {"$set": {"seen": True}})
    return jsonify({"message": "Marked as seen"})


@notifications_bp.route("/api/notifications/<id>", methods=["DELETE"])
@token_required
def delete_notification(id):
    notifications_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Deleted"})
