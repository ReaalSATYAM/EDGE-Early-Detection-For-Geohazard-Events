
import unittest
import json
import sys
import os

# Ensure we can import app from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app_fastapi import app

class TestLandslideAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    # 1. ROUTING VERIFICATION
    def test_routing_ui(self):
        """Verify that / correctly serves the UI"""
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Landslide Risk API Tester", response.data)

    def test_routing_health(self):
        """Verify /api/health returns system status"""
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'OK')

    def test_routing_simulate_method(self):
        """Verify /api/simulate accepts POST requests only"""
        response = self.app.get('/api/simulate')
        self.assertEqual(response.status_code, 405) # Method Not Allowed

    def test_routing_404(self):
        """Verify invalid routes return proper 404 responses"""
        response = self.app.get('/api/invalid_route')
        self.assertEqual(response.status_code, 404)

    # 2 & 3. API FLOW & INPUT LIMITS
    def test_simulate_valid(self):
        """Test valid simulation flow"""
        payload = {"rainfall_intensity": 50, "rainfall_duration": 24}
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("outputs", data)
        self.assertIn("max_risk_score", data["outputs"])

    def test_simulate_zero_rainfall(self):
        """Test zero rainfall (Edge Case)"""
        payload = {"rainfall_intensity": 0, "rainfall_duration": 24}
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        # Expect very low or zero risk
        self.assertTrue(data["outputs"]["max_risk_score"] < 0.1)

    def test_simulate_high_rainfall(self):
        """Test high rainfall"""
        payload = {"rainfall_intensity": 250, "rainfall_duration": 24}
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)

    def test_simulate_extreme_rainfall_fail(self):
        """Test extremely high rainfall (Limit Check)"""
        payload = {"rainfall_intensity": 1000, "rainfall_duration": 24} # Limit is 500
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"Invalid rainfall intensity", response.data)

    def test_simulate_negative_input(self):
        """Test negative values"""
        payload = {"rainfall_intensity": -10, "rainfall_duration": 24}
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_simulate_missing_fields(self):
        """Test missing fields"""
        payload = {"rainfall_duration": 24} # Missing intensity
        response = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn(b"Missing field", response.data)

    def test_simulate_invalid_json(self):
        """Test invalid JSON"""
        response = self.app.post('/api/simulate', data="Not JSON", content_type='application/json')
        self.assertEqual(response.status_code, 400)

    # 4. DETERMINISM
    def test_determinism(self):
        """Verify: Same input -> same output"""
        payload = {"rainfall_intensity": 100, "rainfall_duration": 12}
        resp1 = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        resp2 = self.app.post('/api/simulate', data=json.dumps(payload), content_type='application/json')
        
        data1 = json.loads(resp1.data)
        data2 = json.loads(resp2.data)
        
        self.assertEqual(data1["outputs"]["max_risk_score"], data2["outputs"]["max_risk_score"])

    # 5. STABILITY
    def test_stability_empty_body(self):
        response = self.app.post('/api/simulate', data="", content_type='application/json')
        self.assertEqual(response.status_code, 400)

if __name__ == '__main__':
    unittest.main()
