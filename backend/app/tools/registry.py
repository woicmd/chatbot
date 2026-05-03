TOOLS = {}

def register(name, fn):
    TOOLS[name] = fn

async def execute(name, args):
    if name not in TOOLS:
        return {"error": f"tool '{name}' not found"}
    return await TOOLS[name](**args)