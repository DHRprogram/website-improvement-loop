"""Sandbox service middleware."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
import prometheus_client

SANDBOX_REQUEST_COUNT = prometheus_client.Counter(
    "sandbox_requests_total", "Sandbox requests", ["method", "status"]
)


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        cid = request.headers.get("X-Correlation-Id", "")
        if cid:
            response.headers["X-Correlation-Id"] = cid
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        SANDBOX_REQUEST_COUNT.labels(method=request.method, status=response.status_code).inc()
        logger.debug("[%s] %.3fs %s %s",
                     request.headers.get("X-Correlation-Id"),
                     time.monotonic() - start, request.method, request.url.path)
        return response
