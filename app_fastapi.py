import os, sys
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from sentinal.src.scripts.run_backtest import backtest_event
from sentinal.src.scripts.run_live_sim import run_live_simulation
from sentinal.src.scripts.run_quick_demo import run_demo_event

UPLOAD_DIR = "api/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Sentinel-LEWS API")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/demo", StaticFiles(directory="demo", html=True), name="demo")

@app.get("/")
def home():
    return FileResponse("static/index.html")

@app.get("/api/health")
def health():
    return {"status": "OK"}

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename}

@app.post("/api/backtest")
def backtest(data: dict):
    return backtest_event(os.path.join(UPLOAD_DIR, data["dataset_file"]))

@app.post("/api/live_sim")
def live_sim(data: dict):
    return run_live_simulation(os.path.join(UPLOAD_DIR, data["dataset_file"]), web_mode=True)

@app.post("/api/quick_demo")
def quick_demo(data: dict):
    return run_demo_event(os.path.join(UPLOAD_DIR, data["dataset_file"]), web_mode=True)
