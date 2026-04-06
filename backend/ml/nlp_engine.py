from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import numpy as np


class NLPEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self.documents = []
        self.doc_data = []
        self.tfidf_matrix = None
        self.classifier = None
        self._build_classifier()

    def _build_classifier(self):
        """Build a Naive Bayes classifier for question types."""
        training_texts = [
            "where is", "location of", "which building", "which floor",
            "find room", "where can I find", "room number", "locate",
            "directions to", "building name", "which block",
            "when is", "what time", "schedule for", "timetable",
            "class timing", "lecture time", "what subject", "which period",
            "today schedule", "tomorrow class", "weekly schedule",
            "is occupied", "is free", "is available", "status of",
            "currently running", "is there class", "anyone in",
            "empty room", "vacant room", "occupied or free",
            "tell me about", "information about", "details of",
            "who teaches", "which department", "how many",
            "capacity of", "type of room", "lab or classroom",
        ]

        training_labels = [
            "location", "location", "location", "location",
            "location", "location", "location", "location",
            "location", "location", "location",
            "schedule", "schedule", "schedule", "schedule",
            "schedule", "schedule", "schedule", "schedule",
            "schedule", "schedule", "schedule",
            "status", "status", "status", "status",
            "status", "status", "status",
            "status", "status", "status",
            "info", "info", "info",
            "info", "info", "info",
            "info", "info", "info",
        ]

        self.classifier = Pipeline([
            ("tfidf", TfidfVectorizer(stop_words="english")),
            ("nb", MultinomialNB()),
        ])
        self.classifier.fit(training_texts, training_labels)

    def build_index(self):
        """Build the TF-IDF search index from MongoDB data."""
        from db import classrooms_col, timetable_col, teachers_col

        self.documents = []
        self.doc_data = []

        # Index classrooms
        for c in classrooms_col.find():
            text = (
                f"{c.get('name', '')} {c.get('department', '')} "
                f"{c.get('building', '')} {c.get('floor', '')} "
                f"{c.get('room_number', '')} {c.get('type', '')} "
                f"{c.get('current_subject', '')} {c.get('current_teacher', '')}"
            )
            self.documents.append(text)
            data = {k: v for k, v in c.items() if k != "_id"}
            data["_id"] = str(c["_id"])
            data["source"] = "classroom"
            self.doc_data.append(data)

        # Index timetable entries
        for t in timetable_col.find():
            text = (
                f"{t.get('subject', '')} {t.get('teacher', '')} "
                f"{t.get('classroom', '')} {t.get('department', '')} "
                f"{t.get('day', '')} {t.get('time_slot', '')}"
            )
            self.documents.append(text)
            data = {k: v for k, v in t.items() if k != "_id"}
            data["_id"] = str(t["_id"])
            data["source"] = "timetable"
            self.doc_data.append(data)

        # Index teachers
        for t in teachers_col.find():
            text = (
                f"{t.get('name', '')} {t.get('department', '')} "
                f"{' '.join(t.get('subjects', []))}"
            )
            self.documents.append(text)
            data = {k: v for k, v in t.items() if k != "_id"}
            data["_id"] = str(t["_id"])
            data["source"] = "teacher"
            self.doc_data.append(data)

        if self.documents:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.documents)

    def search(self, query, top_k=5):
        """Search using TF-IDF + Cosine Similarity."""
        if not self.documents or self.tfidf_matrix is None:
            return []

        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

        top_indices = similarities.argsort()[::-1][:top_k]
        results = []
        for idx in top_indices:
            if similarities[idx] > 0.05:
                result = dict(self.doc_data[idx])
                result["similarity"] = float(similarities[idx])
                results.append(result)

        return results

    def classify_question(self, query):
        """Classify question type using Naive Bayes."""
        if self.classifier is None:
            return "info"
        return self.classifier.predict([query])[0]
