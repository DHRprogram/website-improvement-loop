"""Gateway middleware: X-Correlation-Id propagation and /metrics endpoint."""

import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
import prometheus_client

logger = logging.getLogger(__name__)

REQUEST_COUNT = prometheus_client.Counter(
    "gw_requests_total", "Total gateway requests", ["method", "path", "status"]
)
REQUEST_LATENCY = prometheus_client.Histogram(
    "gw_request_latency_seconds", "Request latency", ["method", "path"]
)


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        cid = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())[:8]
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = cid
        return response


async def metrics_endpoint():
    return Response(prometheus_client.generate_latest(), media_type="text/plain")
