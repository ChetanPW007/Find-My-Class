import os
import math
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
HF_TOKEN = os.getenv("HF_TOKEN")
USE_HF_API = os.getenv("USE_HF_API", "true").lower() == "true"

# Model IDs
CLASSIFIER_MODEL = "openai-community/roberta-base-openai-detector"
PERPLEXITY_MODEL = "gpt2"

def query_hf_api(payload, model_id):
    """
    Sends a request to the Hugging Face Inference API.
    """
    if not HF_TOKEN:
        logging.warning("HF_TOKEN missing. Skipping HF API query.")
        return None
    
    api_url = f"https://api-inference.huggingface.co/models/{model_id}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        return response.json()
    except Exception as e:
        logging.error(f"HF API Error ({model_id}): {e}")
        return None

def get_ai_prediction(text):
    """
    DEEP ANALYSIS MODE: Performs sliding window scanning on the entire document.
    Categorizes the document into forensics by looking at multiple 1000-char chunks.
    """
    # ── 1. Create Chunks for Deep Analysis ──────────────────────────────────
    chunk_size = 1200
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size // 2)]
    
    # Cap at 5 chunks for performance on Free Tier, prioritizing the scan
    chunks = chunks[:5] if len(chunks) > 5 else chunks
    
    classifier_scores = []
    
    # Analyze each chunk individually
    if USE_HF_API and HF_TOKEN:
        for chunk in chunks:
            classifier_data = query_hf_api({"inputs": chunk}, CLASSIFIER_MODEL)
            if isinstance(classifier_data, list) and len(classifier_data) > 0:
                scores = {item['label']: item['score'] for item in classifier_data[0]}
                classifier_scores.append(scores.get('Fake', 0.0) * 100)
    
    # Calculate the average AI signal across the document
    final_classifier_score = (sum(classifier_scores) / len(classifier_scores)) if classifier_scores else 0.0
    
    results = {
        "classifier_score": round(final_classifier_score, 2),
        "perplexity_score": 0.0,
        "is_ai": False,
        "confidence": 0.0,
        "analysis": "Analysis pending."
    }

    # 2. Perplexity (Structural Predictability)
    results["perplexity_score"] = calculate_simulated_perplexity(text)

    # 3. Burstiness (Sentence Length Variation)
    results["burstiness_score"] = calculate_burstiness(text)

    # 4. Final Decision Logic (Weighted Ensemble)
    # Human text = High Perplexity, High Burstiness, Low Classifier Rank
    burstiness_signal = min(results["burstiness_score"] * 2, 100) 
    
    results["confidence"] = (
        (results["classifier_score"] * 0.5) + 
        ((100 - results["perplexity_score"]) * 0.25) + 
        ((100 - burstiness_signal) * 0.25)
    )
    
    results["is_ai"] = results["confidence"] > 65
    
    # Forensic Explanation
    status_msg = "Deep Scanning active." if len(chunks) > 1 else "Standard Scan active."
    results["analysis"] = (
        f"{status_msg} The model detected {('high' if results['is_ai'] else 'low')} stylistic alignment. "
        f"Analyzed {len(chunks)} sections of the document. "
        f"Forensic signals: {results['classifier_score']:.1f}% classifier match, "
        f"{results['perplexity_score']:.1f} perplexity, and "
        f"{results['burstiness_score']:.1f} sentence variation."
    )

    return results

def calculate_burstiness(text):
    """
    Calculates the standard deviation of sentence lengths.
    AI text is often uniform (low burstiness), human text is varied.
    """
    import statistics
    import re
    
    # Simple sentence splitting
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip().split()) > 2]
    
    if len(sentences) < 2:
        return 50.0 # Neutral if too short
    
    lens = [len(s.split()) for s in sentences]
    std_dev = statistics.stdev(lens)
    
    # Scale std_dev to a 0-100 score
    # Usually, a std_dev > 10 is quite human (varied)
    return min(std_dev * 5, 100.0)

def calculate_simulated_perplexity(text):
    """
    A lightweight fallback for perplexity on constrained environments.
    Calculates Type-Token Ratio and word length distribution.
    AI text often has lower lexical diversity.
    """
    words = text.lower().split()
    if not words: return 0.0
    
    unique_words = set(words)
    ttr = len(unique_words) / len(words) # Type-Token Ratio
    
    # Scale TTR to a 0-100 score where lower is more 'predictable' (AI-like)
    # Typical human TTR is 0.4-0.6 for medium text.
    perplexity_signal = ttr * 150 
    return min(max(perplexity_signal, 10.0), 100.0)

def get_sentence_similarity(text1, text2):
    """
    Uses Sentence-Transformers via HF API for precise semantic similarity.
    """
    if not HF_TOKEN or not USE_HF_API:
        return 0.0 # Fallback to TF-IDF (calculated in plagiarism.py)
        
    model_id = "sentence-transformers/all-MiniLM-L6-v2"
    payload = {
        "inputs": {
            "source_sentence": text1[:1000],
            "sentences": [text2[:1000]]
        }
    }
    
    data = query_hf_api(payload, model_id)
    if isinstance(data, list) and len(data) > 0:
        return float(data[0]) * 100
    return 0.0
