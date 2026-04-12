from flask import Blueprint, request, jsonify
import os
import io
import re
import datetime
import json
from bson import ObjectId
from PyPDF2 import PdfReader
from docx import Document
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import google.generativeai as genai
from dotenv import load_dotenv
from db import plagiarism_reports_col
from config import TESSERACT_CMD
from ml.ai_detector import get_ai_prediction, get_sentence_similarity

#  OCR IMPORTS (NEW)
import pytesseract
from pdf2image import convert_from_bytes

# Set Tesseract CMD path if specified (Windows fallback or Env Var)
if TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

load_dotenv()

plagiarism_bp = Blueprint('plagiarism', __name__)

# Gemini config
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


# =========================
# TEXT EXTRACTION
# =========================

def extract_text_from_pdf(file_bytes):
    text = ""

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        for i, page in enumerate(reader.pages):
            try:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            except Exception as pe:
                print(f"PDF page error {i}: {pe}")

        #  If no text → fallback to OCR
        if len(text.strip()) < 20:
            print(" Scanned PDF detected -> using OCR...")
            text = extract_text_with_ocr(file_bytes)

        return text.strip()

    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


def extract_text_with_ocr(file_bytes):
    try:
        images = convert_from_bytes(file_bytes)
        text = ""

        for img in images:
            text += pytesseract.image_to_string(img)

        return text.strip()

    except Exception as e:
        print(f"OCR error: {e}")
        return ""


def extract_text_from_docx(file_bytes):
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs if para.text])
        return text.strip()
    except Exception as e:
        print(f"DOCX error: {e}")
        return ""


# =========================
#  AI ANALYSIS
# =========================

def analyze_ai_content(text):
    if not api_key:
        return {
            "ai_percentage": 10,
            "human_percentage": 90,
            "analysis": "Gemini API key not found (Simulated result).",
            "ai_model_prediction": "None",
            "web_sources": []
        }

    try:
        # ── 1. Discover Working Model ────────────────────────────────────
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        # Priority: flash-latest -> flash -> pro
        target_model = 'gemini-1.5-flash-latest'
        if 'models/gemini-1.5-flash-latest' not in available_models:
            if 'models/gemini-1.5-flash' in available_models:
                target_model = 'gemini-1.5-flash'
            elif 'models/gemini-pro' in available_models:
                target_model = 'gemini-pro'
        
        model = genai.GenerativeModel(target_model)
        prompt = f"""Analyze this text for AI patterns and return JSON: {{ai_percentage: number, human_percentage: number, analysis: string, prediction: string}}\n\nTEXT:\n{text[:2000]}"""
        
        response = model.generate_content(prompt)
        gemini_data = {}
        match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if match:
            gemini_data = json.loads(match.group())

        # ── 2. Get Granular ML Metrics (RoBERTa + GPT2) ─────────────────────
        ml_data = get_ai_prediction(text)

        # ── 3. Merge Results ───────────────────────────────────────────────
        # Priority: HF Forensics (if active) > Gemini (if successful)
        
        gemini_perc = gemini_data.get("ai_percentage", 0)
        ml_confidence = ml_data.get("confidence", 0)
        
        # Decide the final "AI Content" percentage
        # If forensics are active and showing signal, they take priority as they are specialized
        if ml_confidence > 0:
            combined_ai_perc = ml_confidence
        else:
            combined_ai_perc = gemini_perc
        
        return {
            "ai_percentage": round(combined_ai_perc, 2),
            "human_percentage": round(100 - combined_ai_perc, 2),
            "perplexity_score": round(ml_data["perplexity_score"], 2),
            "classifier_score": round(ml_data["classifier_score"], 2),
            "burstiness_score": round(ml_data.get("burstiness_score", 0), 2),
            "analysis": ml_data["analysis"],
            "ai_model_prediction": gemini_data.get("prediction", "Hybrid ML Model"),
            "web_sources": []
        }

    except Exception as e:
        print("AI error:", e)
        return {
            "ai_percentage": 0,
            "human_percentage": 100,
            "analysis": f"Error: {str(e)}",
            "ai_model_prediction": "Error",
            "web_sources": []
        }


# =========================
#  MAIN ANALYSIS API
# =========================

@plagiarism_bp.route('/api/plagiarism/analyze', methods=['POST'])
def analyze_plagiarism():
    try:
        if 'files' not in request.files:
            return jsonify({"error": "No files uploaded"}), 400

        files = request.files.getlist('files')
        documents = []

        for file in files:
            filename = file.filename
            content = file.read()

            text = ""

            if filename.lower().endswith('.pdf'):
                text = extract_text_from_pdf(content)

            elif filename.lower().endswith(('.docx', '.doc')):
                text = extract_text_from_docx(content)

            elif filename.lower().endswith('.txt'):
                text = content.decode('utf-8', errors='ignore')

            print(f"{filename} -> Extracted length:", len(text))

            if text and len(text.strip()) > 20:
                documents.append({
                    "filename": filename,
                    "text": text
                })

        # No readable text
        if not documents:
            return jsonify({
                "error": "Text extraction failed. The document may be scanned or empty. Try DOCX or proper PDF."
            }), 400

        # =========================
        # AI Analysis
        # =========================
        for doc in documents:
            doc['ai_analysis'] = analyze_ai_content(doc['text'])

        # =========================
        #  PLAGIARISM CHECK
        # =========================
        if len(documents) > 1:
            corpus = [doc['text'] for doc in documents]

            vectorizer = TfidfVectorizer(stop_words='english')
            vectors = vectorizer.fit_transform(corpus)
            cosine_matrix = cosine_similarity(vectors)

            for i, doc in enumerate(documents):
                similar_to = []

                for j, score in enumerate(cosine_matrix[i]):
                    if i != j:
                        # ── Refined Semantic Scan ──
                        # If TF-IDF detects > 10% similarity, refine with SBERT for precision
                        final_score = score * 100
                        if final_score > 10:
                            semantic_score = get_sentence_similarity(documents[i]['text'], documents[j]['text'])
                            if semantic_score > 0:
                                final_score = (final_score + semantic_score) / 2

                        similar_to.append({
                            "filename": documents[j]['filename'],
                            "percentage": round(final_score, 2)
                        })

                doc['similarity'] = sorted(
                    similar_to,
                    key=lambda x: x['percentage'],
                    reverse=True
                )
        else:
            for doc in documents:
                doc['similarity'] = []

        return jsonify({"results": documents})

    except Exception as e:
        print("Fatal error:", e)
        return jsonify({"error": str(e)}), 500


# =========================
# === SAVE REPORT ===
# =========================

@plagiarism_bp.route('/api/plagiarism/save', methods=['POST'])
def save_report():
    data = request.json

    if not data or 'results' not in data:
        return jsonify({"error": "No data"}), 400

    report = {
        "teacher_id": data.get("teacher_id"),
        "department": data.get("department", "Unspecified"),
        "section": data.get("section", "N/A"),
        "description": data.get("description", ""),
        "results": data.get("results"),
        "created_at": datetime.datetime.utcnow().isoformat(),
        "total_docs": len(data.get("results", []))
    }

    result = plagiarism_reports_col.insert_one(report)

    return jsonify({
        "success": True,
        "report_id": str(result.inserted_id)
    })


# =========================
#  HISTORY
# =========================

@plagiarism_bp.route('/api/plagiarism/history', methods=['GET'])
def get_history():
    teacher_id = request.args.get('teacher_id')

    if not teacher_id:
        return jsonify({"error": "Teacher ID required"}), 400

    reports = list(
        plagiarism_reports_col.find({"teacher_id": teacher_id})
        .sort("created_at", -1)
    )

    for r in reports:
        r['_id'] = str(r['_id'])

    return jsonify(reports)

@plagiarism_bp.route('/api/plagiarism/health', methods=['GET'])
def ocr_health():
    import subprocess
    tesseract_ok = False
    poppler_ok = False
    
    try:
        subprocess.run(['tesseract', '--version'], capture_output=True, check=True)
        tesseract_ok = True
    except:
        pass
        
    try:
        subprocess.run(['pdfinfo', '-v'], capture_output=True, check=True)
        poppler_ok = True
    except:
        pass
        
    return jsonify({
        "status": "ok" if tesseract_ok and poppler_ok else "degraded",
        "tesseract": tesseract_ok,
        "poppler": poppler_ok,
        "env": os.name,
        "tesseract_cmd_set": bool(TESSERACT_CMD)
    })

@plagiarism_bp.route('/api/plagiarism/forensic-status', methods=['GET'])
def forensic_status():
    from ml.ai_detector import HF_TOKEN, USE_HF_API
    from routes.plagiarism import api_key as gemini_key
    
    return jsonify({
        "forensic_active": bool(HF_TOKEN and USE_HF_API),
        "gemini_active": bool(gemini_key),
        "api_configured": bool(HF_TOKEN),
        "provider": "Hugging Face (RoBERTa) + Gemini" if HF_TOKEN else "Gemini (Backup Mode)",
        "deep_analysis_ready": True
    })
