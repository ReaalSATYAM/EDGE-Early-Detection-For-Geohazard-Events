import sys
import os
import time
import io
import random
import numpy as np
import pandas as pd

# Absolute imports for package structure
from sentinal.src.ingestion.loader import load_shimla_data
from sentinal.src.preprocess.soil_props import estimate_soil_parameters
# Assuming SensorFusionEngine exists, mocking if needed for robustness
try:
    from sentinal.src.core.fusion import SensorFusionEngine
except ImportError:
    class SensorFusionEngine:
        def filter_anomalies(self, readings): return readings 

from sentinal.src.models.fisical_fos import compute_fos_vectorized

def run_live_simulation(csv_path=None, max_cycles=5, web_mode=False):
    captured_output = io.StringIO()
    if web_mode:
        sys.stdout = captured_output

    try:
        print("=== Sentinel-LEWS LIVE SIMULATION ===")
        print("Mode: Rolling 6-Hour Forecast (10m x 10m)")
        print(f"Status: {'API DEMO RUN' if web_mode else 'OFFLINE MODE (Edge Local)'}")
        
        # 1. Load Data
        if not csv_path or not os.path.exists(csv_path):
            print("Dataset missing.")
            if web_mode:
                return {"status": "Error", "logs": captured_output.getvalue()}
            return

        df = load_shimla_data(csv_path)
        df = estimate_soil_parameters(df)

        # Static grids
        slope = df["slope"].values
        elevation = df["elevation"].values
        lat = df["lat"].values
        lon = df["lon"].values

        soil_params = {
            "c": df["c"].values,
            "phi": df["phi"].values,
            "gamma": df["gamma"].values,
            "depth": df["depth"].values,
            "ksat": df["ksat"].values,
        }

        # Fusion engine
        fusion = SensorFusionEngine()

        # Saturation memory (cell-wise)
        saturation = np.full(len(df), 0.2, dtype=np.float32)
        decay_rate = 0.985  # realistic drainage

        # Mock rain stations
        stations_meta = [
            {"id": "S1", "lat": 31.10, "lon": 77.10},
            {"id": "S2", "lat": 31.20, "lon": 77.20},
            {"id": "S3", "lat": 31.05, "lon": 77.15},
        ]

        cycle = 0

        while True:
            # Check Stop Condition for API
            if max_cycles is not None and cycle >= max_cycles:
                print(f"\n[STOP] Reached limit of {max_cycles} cycles.")
                break

            cycle += 1
            print(f"\n[CYCLE {cycle}]")

            # ---------------------------------
            # 1. Simulate station rainfall
            # ---------------------------------
            base_rain = max(0.0, 25.0 + 25.0 * np.sin(cycle * 0.4))
            readings = []

            for s in stations_meta:
                val = base_rain + random.uniform(-5, 5)
                if random.random() < 0.1:
                    val = 9999.0  # fault
                readings.append({**s, "val": max(val, 0.0)})

            clean = fusion.filter_anomalies(readings)
            print(f"  Sensors: {len(readings)} → {len(clean)} valid")

            if not clean:
                rain_grid = np.zeros(len(df))
            else:
                # ---------------------------------
                # 2. Spatial rainfall field (IDW)
                # ---------------------------------
                rain_grid = np.zeros(len(df))
                for s in clean:
                    d2 = (lat - s["lat"])**2 + (lon - s["lon"])**2
                    d2 = np.maximum(d2, 1e-6)
                    rain_grid += s["val"] / d2

                rain_grid /= np.max(rain_grid)
                rain_grid *= max(s["val"] for s in clean)

            print(f"  Max Rainfall: {rain_grid.max():.1f} mm/hr")

            # ---------------------------------
            # 3. Update saturation (cell-wise)
            # ---------------------------------
            added_sat = (rain_grid / 100.0) * 0.08
            saturation = saturation * decay_rate + added_sat
            saturation = np.clip(saturation, 0.05, 1.0)

            print(f"  Avg Saturation: {saturation.mean()*100:.1f}%")

            # ---------------------------------
            # 4. Compute FoS
            # ---------------------------------
            fos = compute_fos_vectorized(
                slope_deg=slope,
                elevation=elevation,
                soil_params=soil_params,
                current_saturation=saturation,
                rainfall_intensity_mmph=rain_grid.max(),
                duration_hours=6.0
            )

            # ---------------------------------
            # 5. Risk & Alerting
            # ---------------------------------
            risk = 1.0 / (1.0 + np.exp(10.0 * (fos - 1.0)))
            unstable_frac = np.mean(fos < 1.0)

            print(f"  Unstable Area: {unstable_frac*100:.2f}%")

            if unstable_frac > 0.05:
                print(" ALERT: Widespread slope instability detected")

            if not web_mode:
                time.sleep(1.0)
    
    except Exception as e:
         print(f"Error during simulation: {e}")
         return {"status": "Error", "logs": captured_output.getvalue() if 'captured_output' in locals() else str(e)}
         
    finally:
        if web_mode:
            sys.stdout = sys.__stdout__

    if web_mode:
        return {
            "status": "Success",
            "logs": captured_output.getvalue()
        }

def run_live_loop():
    # CLI Stub
    run_live_simulation(csv_path="shimla_final_grid.csv", max_cycles=None, web_mode=False)

if __name__ == "__main__":
    try:
        run_live_loop()
    except KeyboardInterrupt:
        print("Stopped.")
