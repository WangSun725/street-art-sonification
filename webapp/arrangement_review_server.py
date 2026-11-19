"""Run the audition/review workspace without stopping the live music project."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from arrangement_review import router

WEB = Path(__file__).resolve().parent
app = FastAPI(title="Arrangement Listening Review")
app.mount("/static", StaticFiles(directory=WEB / "static"), name="static")
app.mount("/runtime", StaticFiles(directory=WEB / "runtime"), name="runtime")
app.include_router(router)


@app.get("/")
async def home():
    return RedirectResponse("/review")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8766)
