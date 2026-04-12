from flask import Blueprint, request, jsonify
import jwt
import datetime
import requests
from config import SECRET_KEY
from db import users_col
from bson import ObjectId
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os
import json
from werkzeug.security import generate_password_hash, check_password_hash

students_bp = Blueprint("students", __name__)

def trigger_favorite_push(class_id, classroom_name, action):
    """Trigger Push notifications to all students who favorited this class"""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("[!] pywebpush not installed. Skipping push notifications.")
        return

    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@findmyclass.com")

    if not VAPID_PRIVATE_KEY:
        print("[!] No VAPID_PRIVATE_KEY found. Skipping push notifications.")
        return

    # Find all students who favorited this classroom
    students = users_col.find({"role": "student", "favorites": class_id})
    message = f"🌟 Your favorite class {classroom_name} is now {'starting' if action == 'start' else 'free'}!"
    
    payload = json.dumps({
        "title": "Class Alert",
        "body": message
    })

    for student in students:
        subs = student.get("push_subscriptions", [])
        for sub in subs:
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_SUBJECT}
                )
            except WebPushException as ex:
                if ex.response and ex.response.status_code in [404, 410]:
                    # Subscription expired or invalid
                    users_col.update_one(
                        {"_id": student["_id"]},
                        {"$pull": {"push_subscriptions": sub}}
                    )
                else:
                    print(f"Web Push Error: {repr(ex)}")

def trigger_user_push(user_id, title, body):
    """Generic helper to push notification to any user by ID"""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError: return

    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
    VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@findmyclass.com")
    if not VAPID_PRIVATE_KEY: return

    user = users_col.find_one({"_id": ObjectId(user_id)})
    if not user: return

    payload = json.dumps({"title": title, "body": body})
    subs = user.get("push_subscriptions", [])
    
    for sub in subs:
        try:
            webpush(
                subscription_info=sub, data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT}
            )
        except WebPushException as ex:
            if ex.response and ex.response.status_code in [404, 410]:
                users_col.update_one({"_id": user["_id"]}, {"$pull": {"push_subscriptions": sub}})

# NOTE: In production, you would verify against your actual GOOGLE_CLIENT_ID 
# However, you can also extract the info without verification if purely relying on Google's signed token
# But verification is highly recommended.

@students_bp.route("/api/students/google-auth", methods=["POST"])
def google_auth():
    data = request.get_json()
    token = data.get("token")
    if not token:
        return jsonify({"error": "No token provided"}), 400

    try:
        # Decode without verification for development if client ID is missing,
        # but robust implementation uses id_token.verify_oauth2_token
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        email = decoded.get("email")
        name = decoded.get("name")
        picture = decoded.get("picture")

        if not email:
            return jsonify({"error": "Invalid Google token"}), 400

        user = users_col.find_one({"email": email, "role": "student"})
        
        # If user exists and has a USN, they are fully registered
        if user and user.get("usn"):
            auth_token = jwt.encode(
                {
                    "user_id": str(user["_id"]),
                    "username": email,
                    "role": "student",
                    "name": user.get("name", name),
                    "profile_image": user.get("profile_image", picture),
                    # Persistent login (10 years)
                    "exp": datetime.datetime.utcnow() + datetime.timedelta(days=3650),
                },
                SECRET_KEY,
                algorithm="HS256",
            )
            return jsonify({
                "token": auth_token,
                "role": "student",
                "name": user.get("name", name),
                "user_id": str(user["_id"]),
                "profile_image": user.get("profile_image", picture)
            })
            
        else:
            # Send partial info to complete registration
            return jsonify({
                "status": "needs_details",
                "google_data": {
                    "email": email,
                    "name": name,
                    "picture": picture
                }
            }), 206
            
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@students_bp.route("/api/students/complete-signup", methods=["POST"])
def complete_signup():
    data = request.get_json()
    google_data = data.get("google_data", {})
    
    email = google_data.get("email")
    if not email:
        return jsonify({"error": "Missing Google authorization data"}), 400
        
    # Check if already exists
    user = users_col.find_one({"email": email, "role": "student"})
    if user:
        return jsonify({"error": "Student already registered."}), 400

    new_student = {
        "email": email,
        "name": google_data.get("name", data.get("name")),
        "profile_image": google_data.get("picture", ""),
        "role": "student",
        "username": email, # Fallback
        "password": generate_password_hash(data.get("password")) if data.get("password") else "", 
        "usn": data.get("usn"),
        "mobile": data.get("mobile"),
        "university": data.get("university"),
        "dept": data.get("dept"),
        "semester": data.get("semester"),
        "favorites": [],
        "push_subscriptions": []
    }
    
    result = users_col.insert_one(new_student)
    
    auth_token = jwt.encode(
        {
            "user_id": str(result.inserted_id),
            "username": email,
            "role": "student",
            "name": new_student["name"],
            "profile_image": new_student["profile_image"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=3650),
        },
        SECRET_KEY,
        algorithm="HS256",
    )
    
    return jsonify({
        "token": auth_token,
        "role": "student",
        "name": new_student["name"],
        "user_id": str(result.inserted_id),
        "profile_image": new_student["profile_image"]
    })


@students_bp.route("/api/students/profile", methods=["GET", "PUT"])
def profile():
    # Helper to decode token since we don't have the decorator directly here 
    # without circular imports sometimes, but assuming we can read auth header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"error": "No auth token"}), 401
    token = auth_header.split(" ")[1]
    
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = decoded.get("user_id")
    except Exception as e:
        return jsonify({"error": "Invalid token"}), 401
        
    if request.method == "GET":
        user = users_col.find_one({"_id": ObjectId(user_id)})
        if not user: return jsonify({"error": "Not found"}), 404
        user["_id"] = str(user["_id"])
        user.pop("password", None)
        return jsonify(user)
        
    if request.method == "PUT":
        data = request.get_json()
        new_semester = data.get("semester")
        if not new_semester:
            return jsonify({"error": "Semester required"}), 400
            
        users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"semester": new_semester}}
        )
        return jsonify({"success": True, "semester": new_semester})


@students_bp.route("/api/students/favorites/<class_id>", methods=["POST", "DELETE"])
def toggle_favorite(class_id):
    auth_header = request.headers.get("Authorization")
    if not auth_header: return jsonify({"error": "No auth token"}), 401
    try:
        user_id = jwt.decode(auth_header.split(" ")[1], SECRET_KEY, algorithms=["HS256"]).get("user_id")
    except:
        return jsonify({"error": "Invalid token"}), 401

    if request.method == "POST":
        users_col.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {"favorites": class_id}})
        return jsonify({"success": True, "action": "added"})
    elif request.method == "DELETE":
        users_col.update_one({"_id": ObjectId(user_id)}, {"$pull": {"favorites": class_id}})
        return jsonify({"success": True, "action": "removed"})


@students_bp.route("/api/students/push-subscribe", methods=["POST"])
def push_subscribe():
    auth_header = request.headers.get("Authorization")
    if not auth_header: return jsonify({"error": "No auth token"}), 401
    try:
        user_id = jwt.decode(auth_header.split(" ")[1], SECRET_KEY, algorithms=["HS256"]).get("user_id")
    except:
        return jsonify({"error": "Invalid token"}), 401

    sub_info = request.get_json()
    if not sub_info or "endpoint" not in sub_info:
        return jsonify({"error": "Invalid subscription object"}), 400

    # Add to subscriptions if not already there
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"push_subscriptions": sub_info}}
    )
    return jsonify({"success": True})


@students_bp.route("/api/students/login", methods=["POST"])
def manual_login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_col.find_one({"email": email, "role": "student"})
    if not user or not user.get("password"):
        return jsonify({"error": "Invalid credentials or account uses Google Login"}), 401

    if not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode(
        {
            "user_id": str(user["_id"]),
            "username": user["email"],
            "role": "student",
            "name": user.get("name"),
            "profile_image": user.get("profile_image", ""),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=3650),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    return jsonify({
        "token": token,
        "role": "student",
        "name": user.get("name"),
        "user_id": str(user["_id"]),
        "profile_image": user.get("profile_image", "")
    })


@students_bp.route("/api/students/signup", methods=["POST"])
def manual_signup():
    data = request.get_json()
    email = data.get("email")
    if not email: return jsonify({"error": "Email required"}), 400

    # Check if already exists
    if users_col.find_one({"email": email, "role": "student"}):
        return jsonify({"error": "Student already registered."}), 400

    new_student = {
        "email": email,
        "name": data.get("name"),
        "role": "student",
        "username": email,
        "password": generate_password_hash(data.get("password")),
        "usn": data.get("usn"),
        "mobile": data.get("mobile"),
        "university": data.get("university"),
        "dept": data.get("dept"),
        "semester": data.get("semester"),
        "profile_image": "",
        "favorites": [],
        "push_subscriptions": []
    }
    
    result = users_col.insert_one(new_student)
    token = jwt.encode(
        {
            "user_id": str(result.inserted_id),
            "username": email,
            "role": "student",
            "name": new_student["name"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=3650),
        },
        SECRET_KEY,
        algorithm="HS256",
    )
    
    return jsonify({
        "token": token,
        "role": "student",
        "name": new_student["name"],
        "user_id": str(result.inserted_id)
    })

