from flask import Blueprint, request, jsonify
import os
import io
import re
from PyPDF2 import PdfReader
from docx import Document
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import google.generativeai as genai
from dotenv import load_dotenv

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
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""

def extract_text_from_docx(file_bytes):
    try:
        doc = Document(io.BytesIO(file_bytes))
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text.strip()
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return ""

def analyze_ai_content(text):
    if not api_key:
        # Fallback simulation if no API key
        return {
            "ai_percentage": 15,
            "human_percentage": 85,
            "analysis": "Gemini API key not found. Simulated results show low AI probability.",
            "sources": ["Simulated Web Source A", "Simulated Web Source B"]
        }
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        Analyze the following text for AI-generated content and potential plagiarism.
        Text: {text[:4000]} 
        
        Provide a JSON response with:
        1. ai_percentage (integer 0-100 indicating probability of AI generation)
        2. human_percentage (integer 0-100 indicating probability of human writing)
        3. analysis (short string summarizing tone, style, and why it appears AI or human)
        4. ai_model_prediction (string naming likely model like 'ChatGPT', 'Claude', or 'None')
        5. web_sources (list of strings representing likely web URLs or domains if it looks copied from internet, or [] if original)
        """
        response = model.generate_content(prompt)
        # Simple extraction of JSON from response text
        match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if match:
            import json
            data = json.loads(match.group())
            # Map 'sources' back if the model uses the old name or provide web_sources
            if "sources" in data and "web_sources" not in data:
                data["web_sources"] = data["sources"]
            return data
        return {"ai_percentage": 0, "human_percentage": 100, "analysis": "Could not parse AI analysis.", "web_sources": [], "ai_model_prediction": "None"}
    except Exception as e:
        print(f"AI Analysis error: {e}")
        return {"ai_percentage": 0, "human_percentage": 100, "analysis": f"API Error: {str(e)}", "web_sources": [], "ai_model_prediction": "None"}

@plagiarism_bp.route('/api/plagiarism/analyze', methods=['POST'])
def analyze_plagiarism():
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
        if filename.endswith('.pdf'):
            text = extract_text_from_pdf(content)
        elif filename.endswith('.docx') or filename.endswith('.doc'):
            text = extract_text_from_docx(content)
        elif filename.endswith('.txt'):
            text = content.decode('utf-8', errors='ignore')
        
        if text:
            documents.append({
                "filename": filename,
                "text": text
            })

    if len(documents) == 0:
        return jsonify({"error": "No readable text found in documents"}), 400

    results = []
    
    # 1. Individual AI Analysis
    for doc in documents:
        ai_res = analyze_ai_content(doc['text'])
        doc['ai_analysis'] = ai_res

    # 2. Cross-Document Similarity (Cosines Similarity)
    if len(documents) > 1:
        corpus = [doc['text'] for doc in documents]
        vectorizer = TfidfVectorizer().fit_transform(corpus)
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
