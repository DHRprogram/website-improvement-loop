"""Memory service middleware."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
import prometheus_client

MEM_REQUEST_COUNT = prometheus_client.Counter(
    "memory_requests_total", "Memory service requests", ["method", "status"]
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
        MEM_REQUEST_COUNT.labels(method=request.method, status=response.status_code).inc()
        return response
