from app.tools.registry import register

async def add(a: int, b: int):
    return {"result": a + b}

register("add", add)

async def subtract(a: int, b: int):
    return {"result": a - b}

register("subtract", subtract)