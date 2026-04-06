from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
import numpy as np


class OccupancyPredictor:
    def __init__(self):
        self.model = DecisionTreeClassifier(random_state=42, max_depth=10)
        self.day_encoder = LabelEncoder()
        self.time_encoder = LabelEncoder()
        self.classroom_encoder = LabelEncoder()
        self.department_encoder = LabelEncoder()
        self.is_trained = False

    def train(self):
        """Train the Decision Tree model on timetable data."""
        from db import timetable_col

        entries = list(timetable_col.find())
        if len(entries) < 2:
            return {
                "message": "Not enough data to train. Need at least 2 timetable entries.",
                "trained": False,
            }

        days = [e.get("day", "Monday") for e in entries]
        times = [e.get("time_slot", "09:00-10:00") for e in entries]
        classrooms = [e.get("classroom", "Room 101") for e in entries]
        departments = [e.get("department", "General") for e in entries]

        # All timetable entries represent "occupied" slots
        # Generate "free" samples for balanced training
        all_days = list(set(days)) or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        all_times = list(set(times)) or ["09:00-10:00", "10:00-11:00", "11:00-12:00"]
        all_classrooms = list(set(classrooms))
        all_departments = list(set(departments))

        # Create feature arrays with both occupied and free slots
        train_days = list(days)
        train_times = list(times)
        train_classrooms = list(classrooms)
        train_departments = list(departments)
        labels = [1] * len(entries)  # occupied

        # Generate free samples
        occupied_set = set(zip(days, times, classrooms))
        for d in all_days:
            for t in all_times:
                for c in all_classrooms:
                    if (d, t, c) not in occupied_set:
                        train_days.append(d)
                        train_times.append(t)
                        train_classrooms.append(c)
                        train_departments.append(all_departments[0])
                        labels.append(0)  # free

        if len(set(labels)) < 2:
            # Add synthetic free data if needed
            train_days.append("Sunday")
            train_times.append("00:00-01:00")
            train_classrooms.append(all_classrooms[0])
            train_departments.append(all_departments[0])
            labels.append(0)

        # Encode features
        self.day_encoder.fit(list(set(train_days)))
        self.time_encoder.fit(list(set(train_times)))
        self.classroom_encoder.fit(list(set(train_classrooms)))
        self.department_encoder.fit(list(set(train_departments)))

        X = np.column_stack([
            self.day_encoder.transform(train_days),
            self.time_encoder.transform(train_times),
            self.classroom_encoder.transform(train_classrooms),
            self.department_encoder.transform(train_departments),
        ])
        y = np.array(labels)

        self.model.fit(X, y)
        self.is_trained = True

        accuracy = self.model.score(X, y)
        return {
            "message": f"Model trained on {len(entries)} timetable entries + generated free slots.",
            "accuracy": round(accuracy, 4),
            "total_samples": len(labels),
            "trained": True,
        }

    def predict(self, day, time_slot, classroom="", department=""):
        """Predict if a classroom is occupied."""
        if not self.is_trained:
            self.train()
            if not self.is_trained:
                return {"prediction": "unknown", "confidence": 0}

        try:
            d = self.day_encoder.transform([day])[0] if day in self.day_encoder.classes_ else 0
            t = self.time_encoder.transform([time_slot])[0] if time_slot in self.time_encoder.classes_ else 0
            c = self.classroom_encoder.transform([classroom])[0] if classroom in self.classroom_encoder.classes_ else 0
            dep = self.department_encoder.transform([department])[0] if department in self.department_encoder.classes_ else 0

            X = np.array([[d, t, c, dep]])
            prediction = self.model.predict(X)[0]
            probabilities = self.model.predict_proba(X)[0]
            confidence = float(max(probabilities))

            return {
                "prediction": "occupied" if prediction == 1 else "free",
                "confidence": round(confidence, 4),
            }
        except Exception as e:
            return {"prediction": "unknown", "confidence": 0, "error": str(e)}
