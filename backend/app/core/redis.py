# =============================================================
# JK INFOTECH ERP — High Performance Redis Caching Layer
# File : app/core/redis.py
# =============================================================

import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisCacheManager:
    def __init__(self):
        self._redis_client: Optional[aioredis.Redis] = None

    async def get_client(self) -> Optional[aioredis.Redis]:
        if self._redis_client is None:
            try:
                self._redis_client = aioredis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                await self._redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis connection unavailable: {e}. Falling back to direct database execution.")
                self._redis_client = None
        return self._redis_client

    async def get(self, key: str) -> Optional[Any]:
        try:
            client = await self.get_client()
            if not client:
                return None
            val = await client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis GET failed for key '{key}': {e}")
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        try:
            client = await self.get_client()
            if not client:
                return False
            serialized = json.dumps(value, default=str)
            await client.set(name=key, value=serialized, ex=ttl_seconds)
            return True
        except Exception as e:
            logger.warning(f"Redis SET failed for key '{key}': {e}")
            return False

    async def invalidate_prefix(self, prefix: str) -> int:
        try:
            client = await self.get_client()
            if not client:
                return 0
            keys = await client.keys(f"{prefix}*")
            if keys:
                return await client.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis invalidate failed for prefix '{prefix}': {e}")
        return 0

cache_manager = RedisCacheManager()
