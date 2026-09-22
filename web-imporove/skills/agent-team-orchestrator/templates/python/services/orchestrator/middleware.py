"""Middleware for orchestrator: correlation-id, metrics, error handling."""

import time
import uuid
import logging
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
import prometheus_client

logger = logging.getLogger(__name__)

REQUEST_COUNT = prometheus_client.Counter(
    "orchestrator_requests_total", "Total HTTP requests", ["method", "status"]
)
REQUEST_LATENCY = prometheus_client.Histogram(
    "orchestrator_request_latency_seconds", "Request latency", ["method"]
)


class CorrelationIdMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.correlation_id = (
            request.headers.get("X-Correlation-Id") or str(uuid.uuid4())[:8]
        )
        logger.info("[%s] %s %s", request.correlation_id, request.method, request.path)

    def process_response(self, request, response):
        response["X-Correlation-Id"] = getattr(request, "correlation_id", "")
        return response


class MetricsMiddleware(MiddlewareMixin):
    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        REQUEST_COUNT.labels(method=request.method, status=response.status_code).inc()
        elapsed = time.monotonic() - start
        REQUEST_LATENCY.labels(method=request.method).observe(elapsed)
        return response


def _json_error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)
