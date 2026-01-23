function runTest() {
  const rainfall = document.getElementById("rainfall").value;
  const duration = document.getElementById("duration").value;

  fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rainfall_intensity: Number(rainfall),
      rainfall_duration: Number(duration)
    })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById("output").textContent =
      JSON.stringify(data, null, 2);
  })
  .catch(err => {
    document.getElementById("output").textContent = err;
  });
}
