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

load_dotenv()

plagiarism_bp = Blueprint('plagiarism', __name__)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

def extract_text_from_pdf(file_bytes):
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for i, page in enumerate(reader.pages):
            try:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            except Exception as pe:
                print(f"Error on page {i}: {pe}")
        return text.strip()
    except Exception as e:
        print(f"Critical PDF extraction error: {e}")
        return ""

def extract_text_from_docx(file_bytes):
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs if para.text])
        return text.strip()
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return ""

def analyze_ai_content(text):
    if not api_key:
        return {
            "ai_percentage": 10,
            "human_percentage": 90,
            "analysis": "Gemini API key not found. Using simulated local analysis (Simulated low AI probability).",
            "ai_model_prediction": "None",
            "web_sources": ["Simulated Web Reference A", "Simulated Web Reference B"]
        }
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        # Cleaner, deeper prompt
        prompt = f"""
        TASK: Perform a DEEP forensic analysis of the text below to detect AI generation and plagiarism.
        TEXT TO ANALYZE:
        {text[:5000]}
        
        REQUIRED JSON OUTPUT FORMAT:
        {{
            "ai_percentage": <int 0-100>,
            "human_percentage": <int 0-100>,
            "analysis": "<detailed 2-3 sentence forensic breakdown of style, tone, and signature pattern detection>",
            "ai_model_prediction": "<string: e.g. 'ChatGPT-4', 'Claude-3', 'Llama-3', or 'None'>",
            "web_sources": ["<url or domain>", "..."]
        }}
        """
        response = model.generate_content(prompt)
        
        # Robust JSON cleaning
        clean_text = response.text
        if "```json" in clean_text:
            clean_text = clean_text.split("```json")[1].split("```")[0]
        elif "```" in clean_text:
            clean_text = clean_text.split("```")[1].split("```")[0]
            
        match = re.search(r'\{.*\}', clean_text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            # Ensure percentages add to 100
            if "ai_percentage" in data and "human_percentage" not in data:
                data["human_percentage"] = 100 - data["ai_percentage"]
            return data
            
        return {"ai_percentage": 0, "human_percentage": 100, "analysis": "Analysis completed but JSON parsing failed.", "ai_model_prediction": "Unknown", "web_sources": []}
    except Exception as e:
        print(f"Deep AI Analysis error: {e}")
        return {"ai_percentage": 0, "human_percentage": 100, "analysis": f"Forensic Engine Error: {str(e)}", "ai_model_prediction": "Error", "web_sources": []}

@plagiarism_bp.route('/api/plagiarism/analyze', methods=['POST'])
def analyze_plagiarism():
    try:
        if 'files' not in request.files:
            return jsonify({"error": "No files uploaded"}), 400
        
        files = request.files.getlist('files')
        if not files:
            return jsonify({"error": "Empty file list"}), 400

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
            
            if text and len(text.strip()) > 10:
                documents.append({
                    "filename": filename,
                    "text": text
                })

        if not documents:
            return jsonify({"error": "No valid text could be extracted from the uploaded documents (content might be too short or encrypted)"}), 400

        # 1. Individual Deep AI Analysis
        for doc in documents:
            doc['ai_analysis'] = analyze_ai_content(doc['text'])

        # 2. Cross-Document Similarity
        if len(documents) > 1:
            corpus = [doc['text'] for doc in documents]
            vectorizer = TfidfVectorizer(stop_words='english').fit_transform(corpus)
            vectors = vectorizer.toarray()
            cosine_matrix = cosine_similarity(vectors)
            
            for i, doc in enumerate(documents):
                similar_to = []
                for j, score in enumerate(cosine_matrix[i]):
                    if i != j:
                        similar_to.append({
                            "filename": documents[j]['filename'],
                            "percentage": round(score * 100, 2)
                        })
                doc['similarity'] = sorted(similar_to, key=lambda x: x['percentage'], reverse=True)
        else:
            for doc in documents:
                doc['similarity'] = []

        return jsonify({"results": documents})
    except Exception as e:
        print(f"Fatal Plagiarism Analyze Error: {e}")
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500

@plagiarism_bp.route('/api/plagiarism/save', methods=['POST'])
def save_report():
    data = request.json
    if not data or 'results' not in data:
        return jsonify({"error": "No data to save"}), 400
    
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
    return jsonify({"success": True, "report_id": str(result.inserted_id)})

@plagiarism_bp.route('/api/plagiarism/history', methods=['GET'])
def get_history():
    teacher_id = request.args.get('teacher_id')
    if not teacher_id:
        return jsonify({"error": "Teacher ID required"}), 400
    
    reports = list(plagiarism_reports_col.find({"teacher_id": teacher_id}).sort("created_at", -1))
    for r in reports:
        r['_id'] = str(r['_id'])
        
    return jsonify({"reports": reports})
