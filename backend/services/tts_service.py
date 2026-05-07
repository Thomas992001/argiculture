"""
Google Cloud Text-to-Speech service.
Uses the same Firebase service account for authentication.
"""

import json
import os
import tempfile
from google.cloud import texttospeech
from google.oauth2 import service_account
from backend.config import settings

# Voice mapping per language code
VOICE_MAP = {
    "ta": {"language_code": "ta-IN", "name": "ta-IN-Standard-D", "ssml_gender": texttospeech.SsmlVoiceGender.MALE},
    "en": {"language_code": "en-US", "name": "en-US-Neural2-D", "ssml_gender": texttospeech.SsmlVoiceGender.MALE},
    "zh": {"language_code": "cmn-CN", "name": "cmn-CN-Standard-C", "ssml_gender": texttospeech.SsmlVoiceGender.MALE},
    "ms": {"language_code": "ms-MY", "name": "ms-MY-Standard-D", "ssml_gender": texttospeech.SsmlVoiceGender.MALE},
}

_client = None


def _get_client():
    """Lazy-init the TTS client using Firebase service account credentials."""
    global _client
    if _client is not None:
        return _client

    creds_json = settings.firebase_credentials
    if not creds_json:
        raise RuntimeError("FIREBASE_CREDENTIALS not set — cannot init Cloud TTS")

    creds_dict = json.loads(creds_json)
    credentials = service_account.Credentials.from_service_account_info(
        creds_dict,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    _client = texttospeech.TextToSpeechClient(credentials=credentials)
    return _client


def synthesize_speech(text: str, lang: str = "ta") -> bytes:
    """
    Synthesize text to MP3 audio bytes.
    
    Args:
        text: Text to speak (max ~5000 chars for API limit)
        lang: Language code ('ta', 'en', 'zh', 'ms')
    
    Returns:
        MP3 audio bytes
    """
    client = _get_client()

    # Clean markdown artifacts from text
    clean = text.replace("**", "").replace("*", "").replace("`", "").replace("#", "").replace(">", "")
    # Truncate to API limit
    if len(clean) > 4800:
        clean = clean[:4800]

    voice_cfg = VOICE_MAP.get(lang, VOICE_MAP["ta"])

    synthesis_input = texttospeech.SynthesisInput(text=clean)

    voice = texttospeech.VoiceSelectionParams(
        language_code=voice_cfg["language_code"],
        name=voice_cfg["name"],
        ssml_gender=voice_cfg["ssml_gender"],
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=1.25,
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )

    return response.audio_content
