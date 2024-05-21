import logging
# import uvicorn
from fastapi import FastAPI
from titiler.core.factory import TilerFactory
from titiler.core.factory import ColorMapFactory

from mangum import Mangum

#from titiler.application.main import app
# from titiler.application.settings import ApiSettings

app = FastAPI(title="cogtiler")

cog = TilerFactory()
app.include_router(cog.router)

colormaps = ColorMapFactory()

app.include_router(colormaps.router)

@app.get("/ping")
def ping():
    """Health check."""
    return {"ping": "pong!"}

logging.getLogger("mangum.lifespan").setLevel(logging.ERROR)
logging.getLogger("mangum.http").setLevel(logging.ERROR)

# api_settings = ApiSettings(debug=True)

def handler(event, context):
    logging.info(f"Event: {event}")
    logging.info(f"Context: {context}")
    # asgi_handler = Mangum(app, api_gateway_base_path=api_settings.root_path, lifespan="auto")
    asgi_handler = Mangum(app, lifespan="auto")
    response = asgi_handler(event, context)
    
    return response

# if __name__ == '__main__':
#     uvicorn.run(app=app, host="0.0.0.0", port=8080, log_level="debug")