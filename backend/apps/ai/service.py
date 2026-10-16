"""LLM client wrapper. The rest of the app only calls triage_ticket() and draft_reply().

Design notes:
- The API key is read from settings (env var) only; it never reaches the frontend.
- Every call has a timeout. Any provider failure becomes AIUnavailable, which callers
  handle by degrading gracefully (rule-based triage / manual reply) instead of erroring.
- Triage uses structured JSON output with thinking disabled and a small token cap: it's cheap.
- Token usage is logged per call so cost can be monitored.
"""

import json
import logging
from functools import lru_cache
from typing import Literal

from django.conf import settings
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from . import prompts

logger = logging.getLogger(__name__)


class AIUnavailable(Exception):
    """The model couldn't be reached or returned something unusable."""


class TriageResult(BaseModel):
    category: Literal[
        "royalty_payments", "isbn_metadata", "printing_quality", "distribution", "production_status", "general"
    ]
    priority: Literal["critical", "high", "medium", "low"]
    reasoning: str


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise AIUnavailable("GEMINI_API_KEY is not configured")
    return genai.Client(
        api_key=settings.GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=settings.AI_TIMEOUT_SECONDS * 1000,
            # Transient overload / rate-limit errors are retried with exponential backoff
            # before we give up and fall back.
            retry_options=types.HttpRetryOptions(
                attempts=3, initial_delay=1, max_delay=6, http_status_codes=[429, 500, 503, 504]
            ),
        ),
    )


def _thinking() -> types.ThinkingConfig:
    # Triage and drafting don't need deep reasoning; minimal thinking keeps latency and cost low.
    return types.ThinkingConfig(thinking_level=settings.GEMINI_THINKING_LEVEL)


def _generate(purpose: str, system: str, user: str, **config) -> types.GenerateContentResponse:
    try:
        response = _client().models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=user,
            config=types.GenerateContentConfig(system_instruction=system, **config),
        )
    except AIUnavailable:
        raise
    except Exception as exc:  # network errors, timeouts, 429 rate limits, 5xx, auth errors
        logger.warning("AI %s call failed: %s", purpose, exc)
        raise AIUnavailable(str(exc)) from exc

    usage = response.usage_metadata
    if usage:
        logger.info(
            "AI %s tokens: prompt=%s output=%s total=%s",
            purpose,
            usage.prompt_token_count,
            usage.candidates_token_count,
            usage.total_token_count,
        )
    if not response.text:
        raise AIUnavailable(f"Empty {purpose} response (possibly blocked by safety filters)")
    return response


def triage_ticket(subject: str, description: str, book_line: str) -> TriageResult:
    response = _generate(
        "triage",
        prompts.TRIAGE_SYSTEM,
        prompts.triage_user_prompt(subject, description, book_line),
        response_mime_type="application/json",
        response_schema=TriageResult,
        temperature=0,
        max_output_tokens=200,
        thinking_config=_thinking(),
    )
    try:
        return TriageResult.model_validate(json.loads(response.text))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise AIUnavailable(f"Malformed triage output: {exc}") from exc


def draft_reply(**prompt_kwargs) -> str:
    response = _generate(
        "draft",
        prompts.DRAFT_SYSTEM,
        prompts.draft_user_prompt(**prompt_kwargs),
        temperature=0.4,
        max_output_tokens=600,
        thinking_config=_thinking(),
    )
    return response.text.strip()
