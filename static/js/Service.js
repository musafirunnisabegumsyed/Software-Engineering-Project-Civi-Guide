const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

let routingControl = null;
let serviceMarkers = [];
let userMarker = null;
let arrowLayer = null;
let currentStepIndex = 0;

const serviceTypes = ["police","hospital","fire_station","pharmacy","ambulance","shelter","rescue"];
const serviceIcons = {
  police: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/police-badge.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  hospital: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/hospital-room.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  fire_station: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/fire-station.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  pharmacy: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/pill.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  ambulance: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/ambulance.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  shelter: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/home.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  rescue: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/lifebuoy.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]}),
  user: L.icon({iconUrl:'https://img.icons8.com/color/48/000000/marker.png', iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32]})
};

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById("mySidebar");
  sidebar.style.width = sidebar.style.width === "250px" ? "0" : "250px";
}

// Clear previous markers and route
function clearMarkers() {
  serviceMarkers.forEach(m => map.removeLayer(m));
  serviceMarkers = [];
  if (routingControl) { map.removeControl(routingControl); routingControl = null; }
  if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  if (arrowLayer) { map.removeLayer(arrowLayer); arrowLayer = null; }
}

// Fallback contact
function getFallbackContact(type) {
  switch(type) {
    case "police": return "100 / 112";
    case "hospital": return "102 / 108";
    case "fire_station": return "101";
    case "ambulance": return "108";
    default: return "N/A";
  }
}

// Get coordinates
async function getCoords(location) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
  const data = await res.json();
  if (data.length === 0) throw new Error("Location not found: " + location);
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

// Fetch nearby services
async function fetchServices(lat, lon, type) {
  let query = type === 'all' ?
    `[out:json][timeout:25];
      (node(around:2000,${lat},${lon})[amenity~"police|hospital|fire_station|pharmacy|ambulance|shelter|rescue"];
       way(around:2000,${lat},${lon})[amenity~"police|hospital|fire_station|pharmacy|ambulance|shelter|rescue"];);
      out center tags;`
    :
    `[out:json][timeout:25];
      (node(around:2000,${lat},${lon})[amenity=${type}];
       way(around:2000,${lat},${lon})[amenity=${type}];);
      out center tags;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: query
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return []; }
    return data.elements.map(el => {
      if (el.type === 'node') return {lat: el.lat, lon: el.lon, tags: el.tags || {}};
      if (el.type === 'way' && el.center) return {lat: el.center.lat, lon: el.center.lon, tags: el.tags || {}};
      return null;
    }).filter(el => el !== null);
  } catch { return []; }
}

// Add marker
function addMarker(lat, lon, name, contact, type) {
  const icon = serviceIcons[type] || serviceIcons['police'];
  const m = L.marker([lat, lon], {icon}).addTo(map).bindPopup(`${name} - ${contact}`);
  serviceMarkers.push(m);
}

// Sample points
function sampleRouteCoordinates(routeCoordinates, step = 5) {
  const sampled = [];
  for (let i = 0; i < routeCoordinates.length; i += step) sampled.push(routeCoordinates[i]);
  return sampled;
}

// Show route and services
async function showRouteServices() {
  clearMarkers();
  const source = document.getElementById('source').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const via = document.getElementById('via').value.trim();
  const serviceType = document.getElementById('serviceType').value;
  if (!source || !destination) { alert("Enter both source and destination"); return; }

  try {
    const srcCoords = await getCoords(source);
    const destCoords = await getCoords(destination);
    let waypoints = [L.latLng(srcCoords[0], srcCoords[1])];
    if (via) {
      const viaCoords = await getCoords(via);
      waypoints.push(L.latLng(viaCoords[0], viaCoords[1]));
    }
    waypoints.push(L.latLng(destCoords[0], destCoords[1]));

    routingControl = L.Routing.control({
      waypoints: waypoints,
      lineOptions: {styles:[{color:'red',weight:5}]},
      router: L.Routing.osrmv1({serviceUrl:'https://router.project-osrm.org/route/v1'}),
      show: false,
      addWaypoints: false
    }).addTo(map);

    routingControl.on('routesfound', async function(e) {
      const route = e.routes[0];
      const distanceKm = (route.summary.totalDistance/1000).toFixed(2);
      const durationMin = Math.round(route.summary.totalTime/60);
      document.getElementById('distanceBox').innerText = `Distance: ${distanceKm} km | ETA: ${durationMin} min`;

      const routeCoords = route.coordinates.map(pt => ({lat: pt.lat || pt[1], lng: pt.lng || pt[0]}));
      arrowLayer = L.polylineDecorator(L.polyline(routeCoords.map(p => [p.lat, p.lng])), {
        patterns: [{offset:25, repeat:50, symbol:L.Symbol.arrowHead({pixelSize:8, polygon:false, pathOptions:{color:'red',weight:2}})}]
      }).addTo(map);

      const sampledPoints = sampleRouteCoordinates(routeCoords, 10);
      for (const pt of sampledPoints) {
        const typesToFetch = serviceType === 'all' ? serviceTypes : [serviceType];
        for (const type of typesToFetch) {
          const services = await fetchServices(pt.lat, pt.lng, type);
          services.forEach(s => {
            const name = s.tags.name || type.charAt(0).toUpperCase() + type.slice(1);
            const contact = s.tags.phone || getFallbackContact(type);
            addMarker(s.lat, s.lon, name, contact, type);
          });
        }
      }
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        userMarker = L.marker([lat, lon], {icon: serviceIcons.user}).addTo(map).bindPopup("You are here").openPopup();
        map.setView([lat, lon], 13);
      });
    }
  } catch(err) { alert(err.message); }
}

// Voice directions
function speak(text) {
  let utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

document.getElementById('micButton').onclick = function() {
  if (!routingControl) { alert("No route loaded."); return; }
  currentStepIndex = 0;
  speak("Starting navigation. Follow the instructions.");

  let steps = routingControl.getRoutes()[0].instructions || [];
  let interval = setInterval(() => {
    if (currentStepIndex < steps.length) {
      speak(steps[currentStepIndex].text);
      currentStepIndex++;
    } else {
      speak("You have arrived at your destination.");
      clearInterval(interval);
    }
  }, 8000);
};
