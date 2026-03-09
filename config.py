import os

class Config:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

    MODEL = {
        "model_name": os.environ.get("MODEL_NAME", "gemini-1.5-flash"),
        "temperature": float(os.environ.get("TEMPERATURE", 0.6)),
        "top_p": float(os.environ.get("TOP_P", 0.8))
    }

    SYSTEM = {
        "role": "system",
        "instructions": os.environ.get("SYSTEM_INSTRUCTIONS", "")
    }

    ROUTES = {
        "home": "/",
        "generate": "/generate",
        "health_check": "/health",
    }

    DEBUG = os.environ.get("DEBUG", "False").lower() == "true"