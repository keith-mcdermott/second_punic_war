window.onload = init;

async function init() {
  const mapElement = document.getElementById("map");

  const Esri_WorldStreetMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri; Source: Esri",
    }
  );

  const Esri_NatGeoWorldMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy;  National Geographic, Esri",
      maxZoom: 20,
    }
  );

  const Stadia_AlidadeSmooth = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}",
    {
      minZoom: 0,
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ext: "png",
    }
  );

  const map = L.map(mapElement, {
    center: [39.7, 1],
    zoom: 5,
    zoomControl: false,
    layers: [Stadia_AlidadeSmooth],
  });

  var zoomHome = L.Control.zoomHome({position: 'topright'});
  zoomHome.addTo(map);

  const baseMaps = {
    "<b>Gray Scale</b>": Stadia_AlidadeSmooth,
    Streets: Esri_WorldStreetMap,
    "National Geo": Esri_NatGeoWorldMap,
  };

  const overlayLayers = {};
  const layerControl = L.control.layers(baseMaps, overlayLayers, {
    collapsed: false,
  }).addTo(map);

  // Sidebar
   var sidebar = L.control.sidebar('sidebar').addTo(map);
   L.control.scale({position:'bottomright', metric: false}).addTo(map);

  // Async function to fetch GeoJSON and add to map
  async function fetchGeoJSON(dataUrl, legendName, addTo = "No") {
    try {
      const response = await fetch(dataUrl);
      const geojson = await response.json();
      return addGeoJSONData(geojson, legendName, addTo);
    } catch (error) {
      console.error(`Error loading GeoJSON: ${error}`);
      return null;
    }
  }

  // Add GeoJSON to map and layer control, return created layer
  function addGeoJSONData(geojson, legendName, addTo) {
    let geoJSONData = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, stylePoints(feature));
      },
      style: (feature) => {
        if (
          feature.geometry.type == "MultiPolygon" ||
          feature.geometry.type == "Polygon"
        ) {
          return stylePolys(feature);
        }
      },
      onEachFeature: (feature, layer) => {
        if (
          feature.geometry.type == "Point" ||
          feature.geometry.type == "MultiPoint"
        ) {
          layer.bindPopup(
            `<b><u>${feature.properties.TITLE}</u></b><br><b>Roman Strength:</b> ${feature.properties.Roman_Strength.toLocaleString()}<br><b>Carthaginian Strength:</b> ${feature.properties.Carthaginian_Strength.toLocaleString()}<br><b>Date:</b> ${feature.properties.Date}<br><b>Result: ${feature.properties.Result}</b><br><b>Description:</b> ${feature.properties.Description}`
          );
          layer.on("mouseover", function (e) {
            layer.setStyle(hoverStyle);
          });
          layer.on("mouseout", function (e) {
            layer.setStyle(stylePoints(feature));
          });
          layer
            .bindTooltip(feature.properties.TITLE, {
              permanent: true,
              direction: "top",
              className: "my-labels",
            })
            .openTooltip();
        }
      },
    });

    layerControl.addOverlay(geoJSONData, legendName);
    if (addTo === "Yes") {
      geoJSONData.addTo(map);
    }

    return geoJSONData;
  }

  // Styles
  const stylePoints = (feature) => {
    let result = feature.properties.Result;
    switch (result) {
      case "Roman victory":
        return {
          radius: 7,
          color: "darkred",
          weight: 2,
          fillColor: "darkred",
          fillOpacity: 0.5,
        };

      default:
        return {
          radius: 7,
          color: "blue",
          weight: 2,
          fillColor: "blue",
          fillOpacity: 0.5,
        };
    }
  };

  const stylePolys = (feature) => {
    let territory = feature.properties.Territory;
    switch (territory) {
      case "Rome":
        return {
          color: "darkred",
          weight: 2,
          fillColor: "darkred",
          fillOpacity: 0.1,
        };
      default:
        return {
          color: "blue",
          weight: 2,
          fillColor: "blue",
          fillOpacity: 0.1,
        };
    }
  };

  const hoverStyle = {
    radius: 7,
    color: "yellow",
    weight: 2,
    fillColor: "yellow",
    fillOpacity: 0.5,
  };

  // Data paths
  const territories_pre = await fetchGeoJSON("./data/territories_pre.json", "Pre-War Territory", "Yes");
  const battles = await fetchGeoJSON("./data/battles.json", "Battles", "Yes");
  const territoriesPostLayer = await fetchGeoJSON("./data/territories_post.json","Post-War Territory","No");

  // Keep point layer in front 
  map.on("overlayadd", function (e) {
    if (battles) {
      battles.bringToFront();
    }
  });
  
  // Safety call on load
  battles.bringToFront();

  // Button navigation to each point feature
  document.querySelectorAll('.battle-btn').forEach((button) => {
    button.addEventListener('click', () => {
      // Only proceed if the battles layer is currently visible on the map
      if (!map.hasLayer(battles)) {
        alert('Battles layer is not visible on the map.');
        return;
      }

      const battleTitle = button.getAttribute('data-battle');
      let found = false;

      battles.eachLayer((layer) => {
        if (
          layer.feature &&
          layer.feature.properties &&
          layer.feature.properties.TITLE === battleTitle
        ) {
          const latlng = layer.getLatLng();
          map.setView(latlng, 8); // Adjust zoom as needed

          // Open popup reliably with slight delay
          setTimeout(() => {
            layer.openPopup();
          }, 300);

          found = true;
        }
      });

      if (!found) {
        alert(`${battleTitle} not found in GeoJSON.`);
      }
    });
  });

  // Legend
  const legend = L.control.Legend({
      position: "bottomright",
      collapsed: false,
      symbolWidth: 20,
      opacity: 1,
      column: 2,
      legends: [{
          label: "Roman Territory",
          type: "polygon",
          sides: 4,
          color: "darkred",
          fillColor: "darkred",
          fillOpacity: 0.1,
          weight: 1
      },{
          label: "Roman Victory",
          type: "circle",
          radius: 6,
          color: "darkred",
          fillColor: "darkred",
          fillOpacity: 0.5,
          weight: 2,
      },
      {
          label: "Carthaginian Territory",
          type: "polygon",
          sides: 4,
          color: "blue",
          fillColor: "blue",
          fillOpacity: 0.1,
          weight: 1
      },{
          label: "Carthaginian Victory",
          type: "circle",
          radius: 6,
          color: "blue",
          fillColor: "blue",
          fillOpacity: 0.5,
          weight: 2,
      }
    ]
  })
  .addTo(map);


}
