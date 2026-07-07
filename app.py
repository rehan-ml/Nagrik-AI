import os
import json
import traceback
import itertools
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types

app = Flask(__name__)

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

SYSTEM_PROMPT = """You are Nagrik AI, an intelligent civic companion for Indian
citizens. You help people understand and access government services, get
answers to civic questions, find relevant public schemes, learn what
documents they need, and file public issue complaints.

Rules:
- First classify the citizen's message into exactly one intent: "query",
  "service_recommendation", "document_help", or "complaint".
- Respond in the language given in "response_language". If it is "Auto",
  detect the language the citizen wrote in and reply in that same language.
  All natural-language fields (plain_explanation, next_steps, etc.) must be
  written in that language.
- Explain government processes and terminology in simple, plain language a
  layperson can understand. Avoid bureaucratic jargon.
- For service_recommendation intent, suggest real, plausible Indian
  government schemes/services relevant to the request (e.g. Ayushman Bharat,
  PDS ration card, RTI, Aadhaar services, PM Awas Yojana, municipal
  grievance redressal). If unsure of an exact scheme name, describe the
  general category of service clearly rather than inventing a fake one.
- For complaint intent, write a concise, neutral complaint_summary suitable
  for a civic authority to act on, and assess its priority honestly.
- Leave recommended_services / required_documents empty arrays and
  complaint_summary as an empty string when they don't apply to the intent.
- Always return valid JSON matching the schema exactly.
"""

FEW_SHOT_EXAMPLES = [
    {
        "input": {
            "citizen_message": "How do I get a new ration card, what documents do I need?",
            "response_language": "English",
        },
        "output": {
            "intent": "document_help",
            "plain_explanation": "A ration card lets your household buy subsidized food grains under the Public Distribution System. You apply through your state's Food & Civil Supplies Department, usually online or at your local ration office.",
            "recommended_services": [
                {"name": "Public Distribution System (Ration Card)", "department": "State Food & Civil Supplies Department", "how_to_apply": "Apply online via your state's food portal or visit the local ration office with your documents."}
            ],
            "required_documents": ["Aadhaar card", "Address proof", "Passport-size photo", "Income certificate", "Bank account details"],
            "complaint_summary": "",
            "priority": "not_applicable",
            "next_steps": ["Gather the listed documents", "Visit your state food portal or local ration office", "Submit the application and note your reference number"],
        },
    },
    {
        "input": {
            "citizen_message": "There has been uncollected garbage on MG Road for 5 days, it's causing a bad smell and attracting stray animals.",
            "response_language": "English",
        },
        "output": {
            "intent": "complaint",
            "plain_explanation": "Thank you for reporting this. Uncollected waste is a sanitation issue that your local municipal body is responsible for clearing promptly.",
            "recommended_services": [],
            "required_documents": [],
            "complaint_summary": "Garbage left uncollected for 5 days on MG Road, causing odor and attracting stray animals. Requires urgent sanitation department action.",
            "priority": "high",
            "next_steps": ["Complaint logged for civic authority review", "You can also call your municipal helpline for faster escalation", "Attach a photo next time for quicker verification"],
        },
    },
]

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": ["query", "service_recommendation", "document_help", "complaint"],
            "description": "What the citizen actually needs.",
        },
        "plain_explanation": {
            "type": "string",
            "description": "Simple, jargon-free answer or explanation, in response_language.",
        },
        "recommended_services": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "department": {"type": "string"},
                    "how_to_apply": {"type": "string"},
                },
                "required": ["name", "department", "how_to_apply"],
            },
            "description": "0-3 relevant government services/schemes. Empty array if not applicable.",
        },
        "required_documents": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Documents the citizen needs. Empty array if not applicable.",
        },
        "complaint_summary": {
            "type": "string",
            "description": "Neutral summary for civic authorities. Empty string if intent isn't complaint.",
        },
        "priority": {
            "type": "string",
            "enum": ["low", "medium", "high", "not_applicable"],
        },
        "next_steps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "2-4 clear, actionable next steps for the citizen.",
        },
    },
    "required": [
        "intent", "plain_explanation", "recommended_services",
        "required_documents", "complaint_summary", "priority", "next_steps",
    ],
}

LANGUAGES = ["Auto", "English", "Hindi", "Tamil", "Bengali", "Marathi", "Telugu"]

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to .env locally, or set it "
                "as an environment variable / secret when deploying."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def build_prompt(citizen_message: str, response_language: str) -> str:
    lines = ["## Reference examples (format + tone to imitate)", ""]
    for ex in FEW_SHOT_EXAMPLES:
        lines.append(f"Input: {json.dumps(ex['input'])}")
        lines.append(f"Expected output: {json.dumps(ex['output'])}")
        lines.append("")

    lines.append("## Actual citizen message to handle now")
    lines.append(f"citizen_message: {citizen_message}")
    lines.append(f"response_language: {response_language}")
    return "\n".join(lines)

_complaints = []
_complaint_ids = itertools.count(1)


@app.route("/")
def index():
    return render_template("index.html", languages=LANGUAGES)


@app.route("/health")
def health():
    return jsonify({"ok": True, "model": MODEL_NAME})


@app.route("/process", methods=["POST"])
def process():
    try:
        body = request.get_json(silent=True) or request.form.to_dict()
        citizen_message = (body.get("citizen_message") or "").strip()
        response_language = body.get("response_language") or "Auto"

        if not citizen_message:
            return jsonify({"ok": False, "error": "Please type a message first."}), 400

        client = get_client()
        prompt = build_prompt(citizen_message, response_language)

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_json_schema=RESPONSE_SCHEMA,
                temperature=0.4,
            ),
        )

        raw_text = response.text
        parsed = json.loads(raw_text)

        if parsed.get("intent") == "complaint" and parsed.get("complaint_summary"):
            entry = {
                "id": next(_complaint_ids),
                "summary": parsed["complaint_summary"],
                "priority": parsed.get("priority", "medium"),
                "timestamp": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
            }
            _complaints.insert(0, entry)
            parsed["complaint_id"] = entry["id"]

        return jsonify({"ok": True, "data": parsed, "raw": raw_text})

    except RuntimeError as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    except json.JSONDecodeError:
        return jsonify({
            "ok": False,
            "error": "Model returned malformed JSON. Please try again.",
        }), 502
    except Exception as e:  # noqa: BLE001 - hackathon-grade catch-all, keep it clean for demo
        traceback.print_exc()
        return jsonify({"ok": False, "error": f"Unexpected error: {str(e)}"}), 500


@app.route("/complaints", methods=["GET"])
def list_complaints():
    return jsonify({"ok": True, "complaints": _complaints})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)