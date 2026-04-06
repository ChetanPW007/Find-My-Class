from flask import Blueprint, request, jsonify
from bson import ObjectId
from db import departments_col
from routes.auth import token_required, admin_required

departments_bp = Blueprint("departments", __name__)


def serialize_dept(d):
    d["_id"] = str(d["_id"])
    return d


@departments_bp.route("/api/departments", methods=["GET"])
def get_departments():
    departments = list(departments_col.find())
    return jsonify([serialize_dept(d) for d in departments])


@departments_bp.route("/api/departments", methods=["POST"])
@token_required
@admin_required
def add_department():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Department name is required"}), 400

    if departments_col.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}):
        return jsonify({"error": "Department already exists"}), 400

    dept = {
        "name": name,
        "building": data.get("building", ""),
        "hod": data.get("hod", ""),
    }
    result = departments_col.insert_one(dept)
    dept["_id"] = str(result.inserted_id)
    return jsonify(dept), 201


@departments_bp.route("/api/departments/<id>", methods=["DELETE"])
@token_required
@admin_required
def delete_department(id):
    result = departments_col.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        return jsonify({"error": "Department not found"}), 404
    return jsonify({"message": "Department deleted"})
