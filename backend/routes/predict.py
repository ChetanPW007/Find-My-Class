from flask import Blueprint, request, jsonify
from routes.auth import token_required, admin_required
from ml.predictor import OccupancyPredictor
from db import timetable_col

predict_bp = Blueprint("predict", __name__)

predictor = None


def get_predictor():
    global predictor
    if predictor is None:
        predictor = OccupancyPredictor()
        predictor.train()
    return predictor


@predict_bp.route("/api/predict", methods=["POST"])
def predict_occupancy():
    data = request.get_json()
    day = data.get("day", "")
    time_slot = data.get("time_slot", "")
    classroom = data.get("classroom", "")
    department = data.get("department", "")

    if not day or not time_slot:
        return jsonify({"error": "day and time_slot are required"}), 400

    pred = get_predictor()
    result = pred.predict(day, time_slot, classroom, department)

    return jsonify({
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "details": {
            "day": day,
            "time_slot": time_slot,
            "classroom": classroom,
            "department": department,
        },
    })


@predict_bp.route("/api/predict/train", methods=["POST"])
@token_required
@admin_required
def retrain_model():
    global predictor
    predictor = OccupancyPredictor()
    result = predictor.train()
    return jsonify(result)


@predict_bp.route("/api/predict/stats", methods=["GET"])
def get_stats():
    total = timetable_col.count_documents({})
    days = timetable_col.distinct("day")
    departments = timetable_col.distinct("department")
    classrooms = timetable_col.distinct("classroom")

    return jsonify({
        "total_entries": total,
        "days": days,
        "departments": departments,
        "classrooms": classrooms,
    })
