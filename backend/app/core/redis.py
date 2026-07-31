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

def get_system_total_ram_bytes() -> int:
    """Detects total physical hardware RAM on host machine in bytes."""
    try:
        import ctypes
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
            return int(stat.ullTotalPhys)
    except Exception as e:
        logger.debug(f"Native RAM detection fallback: {e}")
    # Default fallback: 8 GB
    return 8 * 1024 * 1024 * 1024

def get_optimal_redis_maxmemory() -> tuple[str, float]:
    """Calculates optimal Redis memory allocation based on host PC's RAM capacity."""
    total_bytes = get_system_total_ram_bytes()
    total_gb = total_bytes / (1024 * 1024 * 1024)

    if total_gb >= 32:
        return "4gb", total_gb
    elif total_gb >= 16:
        return "2gb", total_gb
    elif total_gb >= 8:
        return "1gb", total_gb
    else:
        return "512mb", total_gb

class RedisCacheManager:
    def __init__(self):
        self._redis_client: Optional[aioredis.Redis] = None
        self._configured_memory: bool = False

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

                if not self._configured_memory:
                    maxmem, total_gb = get_optimal_redis_maxmemory()
                    try:
                        await self._redis_client.config_set("maxmemory", maxmem)
                        await self._redis_client.config_set("maxmemory-policy", "allkeys-lru")
                        logger.info(f"Redis memory dynamically scaled for client hardware ({total_gb:.1f} GB RAM detected): maxmemory={maxmem}, policy=allkeys-lru")
                        self._configured_memory = True
                    except Exception as cfg_err:
                        logger.debug(f"Redis memory config tune info: {cfg_err}")
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

    async def get_bytes(self, key: str) -> Optional[bytes]:
        import base64
        try:
            val = await self.get(key)
            if val and isinstance(val, str):
                return base64.b64decode(val.encode('ascii'))
        except Exception as e:
            logger.warning(f"Redis GET bytes failed for key '{key}': {e}")
        return None

    async def set_bytes(self, key: str, value: bytes, ttl_seconds: int = 300) -> bool:
        import base64
        try:
            b64_str = base64.b64encode(value).decode('ascii')
            return await self.set(key, b64_str, ttl_seconds=ttl_seconds)
        except Exception as e:
            logger.warning(f"Redis SET bytes failed for key '{key}': {e}")
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

    async def close(self):
        if self._redis_client:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass
            self._redis_client = None

cache_manager = RedisCacheManager()
