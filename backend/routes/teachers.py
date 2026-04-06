from flask import Blueprint, request, jsonify
from bson import ObjectId
from db import teachers_col, users_col
from routes.auth import token_required, admin_required

teachers_bp = Blueprint("teachers", __name__)


def serialize_teacher(t):
    t["_id"] = str(t["_id"])
    return t


@teachers_bp.route("/api/teachers", methods=["GET"])
def get_teachers():
    department = request.args.get("department")
    query = {}
    if department:
        query["department"] = {"$regex": department, "$options": "i"}
    teachers = list(teachers_col.find(query))
    return jsonify([serialize_teacher(t) for t in teachers])


@teachers_bp.route("/api/teachers", methods=["POST"])
@token_required
@admin_required
def add_teacher():
    data = request.get_json()
    required = ["name", "department", "username", "password"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    teacher = {
        "name": data["name"],
        "department": data["department"],
        "subjects": data.get("subjects", []),
        "assigned_classrooms": data.get("assigned_classrooms", []),
        "username": data["username"],
    }
    result = teachers_col.insert_one(teacher)
    teacher["_id"] = str(result.inserted_id)

    # Also create a user account for login
    users_col.insert_one({
        "username": data["username"],
        "password": data["password"],
        "role": "teacher",
        "name": data["name"],
        "teacher_id": str(result.inserted_id),
    })

    return jsonify(teacher), 201


@teachers_bp.route("/api/teachers/<id>", methods=["PUT"])
@token_required
@admin_required
def update_teacher(id):
    data = request.get_json()
    update_fields = {}
    allowed = ["name", "department", "subjects", "assigned_classrooms"]
    for field in allowed:
        if field in data:
            update_fields[field] = data[field]

    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400

    teachers_col.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
    teacher = teachers_col.find_one({"_id": ObjectId(id)})
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404
    return jsonify(serialize_teacher(teacher))


@teachers_bp.route("/api/teachers/<id>", methods=["DELETE"])
@token_required
@admin_required
def delete_teacher(id):
    teacher = teachers_col.find_one({"_id": ObjectId(id)})
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    # Also remove the user account
    users_col.delete_one({"username": teacher.get("username")})
    teachers_col.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Teacher deleted"})
