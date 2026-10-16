"""Consistent JSON error responses for the whole API.

Every error comes back as:
    {"error": {"code": "...", "message": "...", "details": {...}}}
so the frontend never has to guess the shape, and unexpected errors
never leak a stack trace.
"""

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"error": {"code": "server_error", "message": "Something went wrong. Please try again."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = getattr(exc, "default_code", "error")
    detail = response.data
    if isinstance(detail, dict) and set(detail.keys()) == {"detail"}:
        message, details = str(detail["detail"]), None
    else:
        message, details = "Validation failed." if code == "invalid" else str(exc), detail

    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    response.data = body
    return response
