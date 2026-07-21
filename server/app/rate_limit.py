from collections import defaultdict, deque
from time import monotonic


class InMemoryRateLimiter:
    """Small demo-only limiter. Use a shared store before a multi-instance release."""

    def __init__(self, limit: int = 6, window_seconds: int = 3600) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, identifier: str) -> bool:
        now = monotonic()
        recent = self.requests[identifier]
        while recent and recent[0] <= now - self.window_seconds:
            recent.popleft()
        if len(recent) >= self.limit:
            return False
        recent.append(now)
        return True
