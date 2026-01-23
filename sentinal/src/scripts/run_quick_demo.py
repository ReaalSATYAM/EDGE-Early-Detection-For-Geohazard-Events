import sys
import os
import time
import io
import base64
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


from sentinal.src.ingestion.loader import load_shimla_data
from sentinal.src.preprocess.soil_props import estimate_soil_parameters
from sentinal.src.models.fisical_fos import compute_fos_vectorized
try:
    from sentinal.src.models.ml_residual import MLResidual
except ImportError:
    class MLResidual:
        def predict_residual(self, feats): return np.zeros(len(feats))
import sentinal.src.config as config

def fos_to_risk(fos):
    """
    Conservative risk mapping:
    FoS < 0.9 → High risk
    FoS ~1.0 → Medium
    FoS >1.2 → Safe
    """
    return 1.0 / (1.0 + np.exp(10.0 * (fos - 1.0)))

def generate_sms(lat: float, lon: float, risk: float, fos: float) -> str:
    """
    Generate <160 char SMS alert.
    """
    return f"ALERT: High Landslide Risk ({risk:.2f}). Loc:{lat:.4f},{lon:.4f} FoS:{fos:.2f}. AC:Immediate"

def run_demo_event(csv_path=None, web_mode=False):
    captured_output = io.StringIO()
    if web_mode:
        sys.stdout = captured_output

    heatmap_base64 = None

    try:
        start_time = time.time()
        print("=== Sentinel-LEWS Edge Pipeline ===")
        
        # 1. Load Data
        if not csv_path or not os.path.exists(csv_path):
            print(f"Error: Dataset not found at {csv_path}")
            if web_mode:
                return {"status": "Error", "logs": captured_output.getvalue()}
            return

        df = load_shimla_data(csv_path)
        
        # 2. Preprocess / Feature Engineering
        df = estimate_soil_parameters(df)
        
        print(f"Data Stats:")
        print(f"  Slope: Min {df['slope'].min():.1f}, Max {df['slope'].max():.1f}, Mean {df['slope'].mean():.1f}")
        print(f"  Elev:  Min {df['elevation'].min():.1f}, Max {df['elevation'].max():.1f}")
        
        # 3. Physics Model Inference
        soil_params = {
            'c': df['c'].values,
            'phi': df['phi'].values,
            'gamma': df['gamma'].values,
            'depth': df['depth'].values,
            'ksat': df['ksat'].values
        }
        
        # Simple approx for demo
        initial_sat = np.full(len(df), 0.5)
        if 'R_30d' in df.columns:
            initial_sat = np.clip(df['R_30d'] / 500.0, 0.0, 0.9)
        
        # Extreme event stress test
        design_rain_mmph = 50.0
        design_duration_h = 12.0
        
        fos_values = compute_fos_vectorized(
            slope_deg=df['slope'].values,
            elevation=df['elevation'].values,
            soil_params=soil_params,
            current_saturation=initial_sat,
            rainfall_intensity_mmph=design_rain_mmph,
            duration_hours=design_duration_h
        )

        # 4. ML Residual
        ml_model = MLResidual()
        ml_feats = df[['lat', 'lon', 'elevation', 'slope']].values
        if 'R_7d' in df.columns:
            r7 = df['R_7d'].values[:, None]
            ml_feats = np.hstack([ml_feats, r7])
            
        residual = ml_model.predict_residual(ml_feats)
        
        # 5. Risk Calculation
        fos_final = fos_values + residual
        risk_probs = fos_to_risk(fos_final)
        
        df['fos'] = fos_final
        df['risk'] = risk_probs
        
        # 6. Top Hotspots
        threshold = getattr(config, 'RISK_THRESHOLD', 0.75)
        hotspots = df[df['risk'] > threshold].copy()
        hotspots = hotspots.sort_values('risk', ascending=False).head(10)
        
        # 7. Generate Alerts
        alerts = []
        print("\n[HOTSPOTS DETECTED]")
        for idx, row in hotspots.iterrows():
            msg = generate_sms(row['lat'], row['lon'], row['risk'], row['fos'])
            alerts.append(msg)
            print(msg)
            
        if len(alerts) == 0:
            print(f"No hotspots found > {threshold} risk.")
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n[METRICS]")
        print(f"Total time: {duration:.4f}s")
        print(f"Peak Risk: {df['risk'].max():.4f}")
        print(f"Min FoS: {df['fos'].min():.4f}")
        
        if duration > 15.0:
            print("WARNING: Performance constraint violated (>15s)")
        else:
            print("SUCCESS: Performance constraint met (<15s)")

        # 8. Smoothed Heatmap (Grid + imshow)
        print("\n[HEATMAP] Generating smoothed 2D risk heatmap...")
        
        lat_min, lat_max = df['lat'].min(), df['lat'].max()
        lon_min, lon_max = df['lon'].min(), df['lon'].max()
        grid_size = 400

        lat_grid = np.linspace(lat_min, lat_max, grid_size)
        lon_grid = np.linspace(lon_min, lon_max, grid_size)

        risk_grid = np.zeros((grid_size, grid_size))
        count_grid = np.zeros((grid_size, grid_size))

        lat_idx = np.searchsorted(lat_grid, df['lat'].values) - 1
        lon_idx = np.searchsorted(lon_grid, df['lon'].values) - 1
        lat_idx = np.clip(lat_idx, 0, grid_size-1)
        lon_idx = np.clip(lon_idx, 0, grid_size-1)

        for i, j, r in zip(lat_idx, lon_idx, df['risk'].values):
            risk_grid[i, j] += r
            count_grid[i, j] += 1

        count_grid[count_grid == 0] = 1
        risk_grid /= count_grid

        plt.figure(figsize=(10, 6))
        plt.imshow(
            risk_grid,
            origin='lower',
            extent=[lon_min, lon_max, lat_min, lat_max],
            cmap='hot',
            vmin=0.0,
            vmax=1.0,
            aspect='auto'
        )
        plt.colorbar(label='Landslide Risk Probability')
        plt.xlabel('Longitude')
        plt.ylabel('Latitude')
        plt.title('Shimla Landslide Risk Heatmap')

        if not hotspots.empty:
            plt.scatter(hotspots['lon'], hotspots['lat'], color='blue', edgecolor='white', s=50, label='Top Hotspots')
            plt.legend()

        plt.tight_layout()
        
        if web_mode:
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150)
            buf.seek(0)
            heatmap_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            plt.close()
            print("Heatmap generated in memory.")
        else:
            plt.savefig('shimla_risk_heatmap.png', dpi=300)
            print("Saved shimla_risk_heatmap.png")

    except Exception as e:
        print(f"Execution Error: {e}")
        return {"status": "Error", "logs": captured_output.getvalue() if 'captured_output' in locals() else str(e)}

    finally:
        if web_mode:
            sys.stdout = sys.__stdout__

    if web_mode:
        return {
            "status": "Success",
            "logs": captured_output.getvalue(),
            "image": heatmap_base64
        }
        
def main():
    # CLI Stub
    run_demo_event(csv_path="shimla_final_grid.csv", web_mode=False)

if __name__ == "__main__":
    main()
