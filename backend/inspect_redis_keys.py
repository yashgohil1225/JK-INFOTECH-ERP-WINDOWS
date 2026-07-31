import asyncio
import json
import redis.asyncio as aioredis
from app.core.config import settings

async def main():
    try:
        r = aioredis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, decode_responses=True)
        await r.ping()
        print("Connected to Redis successfully!")
        keys = await r.keys("*")
        print(f"Found {len(keys)} keys in Redis:")
        for k in keys:
            val = await r.get(k)
            print(f"  KEY: '{k}' -> VALUE: {val}")
        
        # Flush all keys to guarantee a clean slate
        await r.flushall()
        print("\nFLUSHED ALL REDIS KEYS TO ENSURE CLEAN SLATE!")
        await r.aclose()
    except Exception as e:
        print(f"Redis check error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
