"""Agent runtime middleware: correlation-id, metrics, error handling."""

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
import prometheus_client

logger = logging.getLogger(__name__)

AGENT_REQUEST_COUNT = prometheus_client.Counter(
    "agent_runtime_requests_total", "Requests to agent runtime", ["method", "status"]
)


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        cid = request.headers.get("X-Correlation-Id") or ""
        response = await call_next(request)
        if cid:
            response.headers["X-Correlation-Id"] = cid
        return response


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        AGENT_REQUEST_COUNT.labels(method=request.method, status=response.status_code).inc()
        elapsed = time.monotonic() - start
        logger.debug("[%s] %s %s %.3fs", request.headers.get("X-Correlation-Id"),
                     request.method, request.url.path, elapsed)
        return response


async def health_check():
    return {"status": "ok", "service": "agent-runtime"}
