var map = L.map('map').setView([22.57, 88.36], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

var hazardZone = L.circle([22.57, 88.36], {
  radius: 20000,
  color: "red",
  fillColor: "#f03",
  fillOpacity: 0.4
}).addTo(map).bindPopup("⚠️ Hazard Area (Flood)");

var control = null;

function showPopup(message, type) {
  const popup = document.getElementById('popup');
  popup.innerHTML = message;
  popup.className = `popup show ${type}`;
  setTimeout(() => { popup.className = 'popup'; }, 5000);
}

async function findRoute() {
  let src = document.getElementById("source").value.trim();
  let dest = document.getElementById("destination").value.trim();

  if (!src || !dest) {
    showPopup("Please enter both Source and Destination.", "warning");
    return;
  }

  try {
    let [srcData, destData] = await Promise.all([
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(src)}`).then(res => res.json()),
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dest)}`).then(res => res.json())
    ]);

    if (!Array.isArray(srcData) || !srcData.length) {
      showPopup("Invalid Source! Place not found.", "warning");
      return;
    }
    if (!Array.isArray(destData) || !destData.length) {
      showPopup("Invalid Destination! Place not found.", "warning");
      return;
    }

    let srcCoords = [parseFloat(srcData[0].lat), parseFloat(srcData[0].lon)];
    let destCoords = [parseFloat(destData[0].lat), parseFloat(destData[0].lon)];

    if (control) map.removeControl(control);

    let distanceFromHazard = map.distance(srcCoords, hazardZone.getLatLng());
    let routeOptions = {
      waypoints: [L.latLng(srcCoords[0], srcCoords[1]), L.latLng(destCoords[0], destCoords[1])],
      routeWhileDragging: true,
      show: true
    };

    if (distanceFromHazard < hazardZone.getRadius()) {
      if (confirm("⚠️ Hazard detected on this route! Do you want an alternate route?")) {
        window.location.href = `alternate.html?srcLat=${srcCoords[0]}&srcLng=${srcCoords[1]}&destLat=${destCoords[0]}&destLng=${destCoords[1]}`;
        return;
      } else {
        showPopup("⚠️ Hazard detected! Proceed with caution.", "warning");
      }
    } else {
      showPopup("✅ Safe journey! Have a good trip.", "success");
    }

    control = L.Routing.control(routeOptions).addTo(map);

  } catch (error) {
    showPopup("Network or API error!", "warning");
    console.error(error);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("mySidebar");
  sidebar.style.width = (sidebar.style.width === "250px") ? "0" : "250px";
}
