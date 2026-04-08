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

app = Flask(__name__)
CORS(app)

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


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "message": "Find My Class API is running"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
