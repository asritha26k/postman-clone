# main.py
# Import necessary libraries
import time
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Initialize the FastAPI app
app = FastAPI(
    title="Postman Clone Backend",
    description="A proxy API to make HTTP requests on behalf of the frontend.",
    version="1.0.0"
)
app.mount("/static", StaticFiles(directory="static"), name="static")
@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")


# --- CORS Middleware ---
# This allows the frontend (running on a different origin) to communicate with this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for simplicity. For production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods.
    allow_headers=["*"],  # Allows all headers.
)

# --- Pydantic Models ---
# Define the structure of the incoming request data from the frontend.
# This provides automatic data validation.
class APIRequest(BaseModel):
    method: str = Field(..., description="HTTP method (e.g., GET, POST)")
    url: str = Field(..., description="The URL to send the request to.")
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, str]] = None
    body: Optional[Any] = None

# --- API Endpoint ---
@app.post("/proxy")
async def proxy_request(request_data: APIRequest):
    """
    This endpoint acts as a proxy. It receives request details from the frontend,
    executes the request using httpx, and returns the response.
    """
    try:
        # Use an async HTTP client to make the request
        async with httpx.AsyncClient() as client:
            start_time = time.time()

            # Prepare the request arguments
            request_args = {
                "method": request_data.method.upper(),
                "url": request_data.url,
                "headers": request_data.headers,
                "params": request_data.params,
            }

            # Add JSON body only for relevant methods and if body is not empty
            if request_data.method.upper() in ["POST", "PUT", "PATCH"] and request_data.body:
                request_args["json"] = request_data.body

            # Make the actual HTTP request
            response = await client.request(**request_args)

            end_time = time.time()
            duration = round((end_time - start_time) * 1000)  # in milliseconds

            # --- Prepare the response to send back to the frontend ---
            response_body = ""
            try:
                # Try to parse response as JSON for pretty printing
                response_body = response.json()
            except (ValueError, TypeError):
                # Fallback to text if it's not valid JSON
                response_body = response.text

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
                "duration": duration,
            }

    except httpx.RequestError as e:
        # Handle exceptions during the request (e.g., network error, invalid URL)
        return {
            "status_code": 500,
            "headers": {},
            "body": f"An error occurred: {str(e)}",
            "duration": 0,
        }
    except Exception as e:
        # Handle any other unexpected errors
        return {
            "status_code": 500,
            "headers": {},
            "body": f"An unexpected server error occurred: {str(e)}",
            "duration": 0,
        }

# --- Root Endpoint ---
# To run this server:
# 1. Install dependencies: pip install "fastapi[all]" httpx
# 2. Run the server: uvicorn main:app --reload
