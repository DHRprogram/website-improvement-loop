"""Git Bridge middleware."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
import prometheus_client

logger = logging.getLogger(__name__)

GIT_REQUEST_COUNT = prometheus_client.Counter(
    "git_bridge_requests_total", "Git bridge requests", ["method", "status"]
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
        GIT_REQUEST_COUNT.labels(method=request.method, status=response.status_code).inc()
        logger.debug("[%s] %.3fs %s %s",
                     request.headers.get("X-Correlation-Id"),
                     time.monotonic() - start, request.method, request.url.path)
        return response
