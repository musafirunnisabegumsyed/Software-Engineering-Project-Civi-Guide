var map = L.map('map').setView([22.0, 78.0], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

let routingControl = null;
let routeInstructions = [];
let currentStepIndex = 0;

function reverseLocations() {
  let s = document.getElementById('source'), d = document.getElementById('destination');
  [s.value, d.value] = [d.value, s.value];
}

function searchRoute() {
  const src = document.getElementById('source').value.trim();
  const dest = document.getElementById('destination').value.trim();
  if (!src || !dest) { alert("Enter both source and destination"); return; }

  const nominatimURL = place =>
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`;

  Promise.all([fetch(nominatimURL(src)).then(r => r.json()), fetch(nominatimURL(dest)).then(r => r.json())])
    .then(([srcData, destData]) => {
      if (!srcData.length) { alert("Source not found"); return; }
      if (!destData.length) { alert("Destination not found"); return; }

      const srcLatLng = L.latLng(srcData[0].lat, srcData[0].lon);
      const destLatLng = L.latLng(destData[0].lat, destData[0].lon);

      if (routingControl) map.removeControl(routingControl);
      routingControl = L.Routing.control({
        waypoints: [srcLatLng, destLatLng],
        lineOptions: { styles: [{ color: 'red', opacity: 0.8, weight: 5 }] },
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        show: true
      }).addTo(map);

      routingControl.on('routesfound', function (e) {
        const route = e.routes[0];
        const distanceKm = (route.summary.totalDistance / 1000).toFixed(2);
        const durationMin = Math.round(route.summary.totalTime / 60);
        document.getElementById('distanceBox').innerText =
          `Distance: ${distanceKm} km | ETA: ${durationMin} min`;

        routeInstructions = route.instructions;
        currentStepIndex = 0;
      });
    });
}
document.getElementById('searchBtn').onclick = searchRoute;

/* ✅ Voice Step-by-Step Directions */
function speak(text) {
  let utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

document.getElementById('micButton').onclick = function () {
  if (routeInstructions.length === 0) {
    alert("No route loaded. Please search first.");
    return;
  }
  currentStepIndex = 0;
  speak("Starting navigation. Follow the instructions.");

  let interval = setInterval(() => {
    if (currentStepIndex < routeInstructions.length) {
      speak(routeInstructions[currentStepIndex].text);
      currentStepIndex++;
    } else {
      speak("You have arrived at your destination.");
      clearInterval(interval);
    }
  }, 8000);
};

/* Sidebar toggle */
function toggleSidebar() {
  const sidebar = document.getElementById("mySidebar");
  sidebar.style.width = sidebar.style.width === "250px" ? "0" : "250px";
}
