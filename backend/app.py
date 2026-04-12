from flask import Flask
from flask_cors import CORS

from routes.auth import auth_bp
from routes.classrooms import classrooms_bp
from routes.departments import departments_bp
from routes.teachers import teachers_bp
from routes.timetable import timetable_bp
from routes.chatbot import chatbot_bp
from routes.predict import predict_bp
from routes.notifications import notifications_bp
from routes.plagiarism import plagiarism_bp
from routes.students import students_bp
import threading
import time
import datetime
from db import timetable_col, users_col, classrooms_col
from routes.students import trigger_user_push
import re

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "https://find-my-class.vercel.app"]}})

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(classrooms_bp)
app.register_blueprint(departments_bp)
app.register_blueprint(teachers_bp)
app.register_blueprint(timetable_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(predict_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(plagiarism_bp)
app.register_blueprint(students_bp)

# ─── Background Notification Monitor ──────────────────────────────────────────
# Keeps track of which users have already been pushed for a specific slot today
# to avoid duplicate alerts.
last_pushed_slots = set() 

def push_monitor_loop():
    """Background task to push '5-minute warnings' to teachers even if app is closed"""
    while True:
        try:
            with app.app_context():
                from routes.timetable import DEFAULT_SLOTS
                now = datetime.datetime.now()
                current_day = now.strftime("%A")
                current_time = now.strftime("%H:%M")
                
                # Check Scheduled Classes
                entries = list(timetable_col.find({"day": {"$regex": f"^{current_day}$", "$options": "i"}}))
                for e in entries:
                    slot_num = e.get("slot", 0)
                    span = e.get("span", 1)
                    end_slot_num = slot_num + span - 1
                    end_meta = next((s for s in DEFAULT_SLOTS if s["slot"] == end_slot_num), None)
                    
                    if end_meta:
                        end_t = end_meta["end"]
                        # Calculate minutes to end
                        end_h, end_m = map(int, end_t.split(":"))
                        cur_h, cur_m = map(int, now.strftime("%H:%M").split(":"))
                        mins_to_end = (end_h * 60 + end_m) - (cur_h * 60 + cur_m)
                        
                        if 0 < mins_to_end <= 5:
                            push_id = f"{e['_id']}-{now.date()}"
                            if push_id not in last_pushed_slots:
                                # Find user (teacher) to get their push subscription
                                teacher_user = users_col.find_one({
                                    "role": "teacher",
                                    "$or": [
                                        {"name": e.get("teacher")},
                                        {"username": e.get("teacher")}
                                    ]
                                })
                                if teacher_user:
                                    trigger_user_push(
                                        str(teacher_user["_id"]), 
                                        "⚠️ Class Ending Soon", 
                                        f"Your class in {e.get('classroom')} ends in {mins_to_end} minutes."
                                    )
                                    last_pushed_slots.add(push_id)
                
                # Check Manual Sessions
                manual_rooms = list(classrooms_col.find({"status": "occupied", "occupied_at": {"$ne": None}}))
                for room in manual_rooms:
                    free_at = room["occupied_at"] + datetime.timedelta(hours=1)
                    remaining = (free_at - now).total_seconds() / 60
                    if 0 < remaining <= 5:
                        push_id = f"manual-{room['_id']}-{now.date()}"
                        if push_id not in last_pushed_slots:
                            trigger_user_push(
                                str(room["current_teacher_id"]), 
                                "⏰ Session Ending", 
                                f"Your manual session in {room['name']} ends in {round(remaining)} minutes."
                            )
                            last_pushed_slots.add(push_id)

                # Clear old cache every day
                if now.hour == 0 and now.minute == 0:
                    last_pushed_slots.clear()

        except Exception as err:
            print(f"[!] Push Monitor Error: {err}")
            
        time.sleep(60) # Check every minute

# Start the background thread
monitor_thread = threading.Thread(target=push_monitor_loop, daemon=True)
monitor_thread.start()



@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "message": "Find My Class API is running"}


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
