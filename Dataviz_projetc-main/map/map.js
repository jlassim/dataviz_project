const width = 960; 
const height = 600;

// Projection géographique
const projection = d3.geoNaturalEarth1()
  .scale(160)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// SVG principal
const svg = d3.select('#map')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// Tooltip
const tooltip = d3.select('#tooltip');

const industryList = ['Fintech', 'HealthTech', 'EdTech', 'E-commerce', 'AI', 'Biotech'];
const colorScale = d3.scaleOrdinal()
  .domain(industryList)
  .range(d3.schemeTableau10);

// Fonction de normalisation des noms de pays
function normalizeCountryName(name) {
  const mapping = {
    "USA": "United States of America",
    "United States": "United States of America",
    "UK": "United Kingdom",
    "Russia": "Russian Federation",
    "South Korea": "Korea, Republic of",
    "Iran": "Iran, Islamic Republic of",
    "Singapore": "Singapore", // Correction spécifique pour Singapore
    // Ajoute d'autres correspondances si nécessaire
  };
  return mapping[name] || name;
}

Promise.all([ 
  d3.json("countries-110m.json"), 
  d3.csv("startup_growth_investment_data.csv") 
]).then(([worldData, startupData]) => {
  const countries = topojson.feature(worldData, worldData.objects.countries).features;

  // Calcul du nombre de startups par pays
  const startupsByCountry = d3.rollup(startupData, v => v.length, d => normalizeCountryName(d.Country || "Unknown Country"));
  const startupCountExtent = d3.extent(Array.from(startupsByCountry.values()));
  
  // Ajustement de l'échelle d'intensité
  const colorDomainMin = 0;
  const colorDomainMax = startupCountExtent[1];
  const colorThreshold = colorDomainMax * 0.3;

  const countryFillScale = d3.scaleSequential()
    .domain([colorDomainMin, colorDomainMax])
    .interpolator(d3.interpolateYlGnBu);

  // Dessiner les pays avec couleur selon densité de startups
  svg.append("g")
    .selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("fill", d => {
      const count = startupsByCountry.get(d.properties.name) || 0;
      return count > colorThreshold ? countryFillScale(count) : "#f2f2f2";
    })
    .attr("stroke", "#999")
    .attr("d", path);

  // Échelle pour la taille des bulles
  const radius = d3.scaleSqrt()
    .domain([0, d3.max(startupData, d => +d["Investment Amount (USD)"])] )
    .range([1, 5]);

  // Grouper les startups par pays et industrie
  const startupsGrouped = d3.rollup(
    startupData,
    v => v,
    d => normalizeCountryName(d.Country || "Unknown Country"),
    d => d.Industry
  );

  // Dessiner les bulles avec positionnement concentrique
  startupsGrouped.forEach((industries, countryName) => {
    const country = countries.find(c => c.properties.name === countryName);
    let centroid;

    // Spécialement pour Singapour : forcée à une position spécifique
    if (countryName === "Singapore") {
      centroid = projection([103.8198, 1.3521]);  // Coordonnées spécifiques de Singapour
    } else {
      centroid = country ? path.centroid(country) : [width/2, height/2];
    }

    const [cx, cy] = centroid;
    const countryStartups = Array.from(industries.values()).flat();

    // Créer des positions concentriques pour chaque industrie
    const industryAngles = {};
    let angleStep = (2 * Math.PI) / industries.size;
    
    Array.from(industries.keys()).forEach((industry, i) => {
      industryAngles[industry] = i * angleStep;
    });

    // Positionner chaque startup
    countryStartups.forEach((startup, i) => {
      if (!industryList.includes(startup.Industry)) return;

      const industry = startup.Industry;
      const angle = industryAngles[industry];
      const r = 5 + (i % 3) * 3;
      
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);

      // Vérifier que le point est dans le pays (si le pays existe)
      let finalX = x;
      let finalY = y;
      if (country && !d3.geoContains(country, projection.invert([x, y]))) {
        finalX = cx;
        finalY = cy;
      }

      svg.append("circle")
        .attr("cx", finalX)
        .attr("cy", finalY)
        .attr("r", radius(+startup["Investment Amount (USD)"]))
        .attr("fill", colorScale(industry))
        .attr("opacity", 0.75)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event) {
          d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
          
          // Mettre en évidence la légende correspondante
          legend.selectAll("rect")
            .attr("stroke", (d) => d === industry ? "#000" : "none")
            .attr("stroke-width", (d) => d === industry ? 2 : 0);
          
          legend.selectAll("text")
            .style("font-weight", (d) => d === industry ? "bold" : "normal");
          
          // Afficher toujours un nom de pays valide
          const displayCountry = startup.Country || countryName ;
          const countryCount = startupsByCountry.get(displayCountry) || 1;
          
          tooltip.style("visibility", "visible")
            .html(`<strong>${(startup["Startup Name"])}</strong><br>
                   Industry: ${industry}<br>
                   Country: ${displayCountry}<br>
                   Startups in country: ${countryCount}<br>
                   Investment: $${(startup["Investment Amount (USD)"] / 1e6).toFixed(2)}M`);
        })
        .on("mousemove", (event) => {
          tooltip.style("top", (event.pageY + 10) + "px")
                 .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
          legend.selectAll("rect").attr("stroke", "none");
          legend.selectAll("text").style("font-weight", "normal");
          tooltip.style("visibility", "hidden");
        });

      // Ajuster légèrement l'angle pour la prochaine startup de la même industrie
      industryAngles[industry] += angleStep * 0.1;
    });
  });

  // Légende industries avec interaction
  const legend = svg.append("g")
    .attr("transform", "translate(20, 300)")
    .selectAll(".legend-item")
    .data(industryList)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
    .on("mouseover", function(event, industry) {
      svg.selectAll("circle")
        .attr("opacity", d => d.industry === industry ? 1 : 0.2);
    })
    .on("mouseout", function() {
      svg.selectAll("circle").attr("opacity", 0.75);
    });

  legend.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", colorScale);

  legend.append("text")
    .attr("x", 20)
    .attr("y", 12)
    .text(d => d)
    .attr("font-size", "12px")
    .attr("fill", "#333");

  // Légende de densité
  const densityLegend = svg.append("g").attr("transform", "translate(800, 20)");
  const legendScale = d3.scaleLinear().domain([colorDomainMin, colorDomainMax]).range([0, 100]);

  const defs = svg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "density-gradient")
    .attr("x1", "0%").attr("x2", "100%");

  linearGradient.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter()
    .append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => countryFillScale(colorDomainMin + d * (colorDomainMax - colorDomainMin)));

  densityLegend.append("text")
    .text("Startups Density")
    .attr("y", -10)
    .attr("fill", "#000")
    .attr("font-size", "14px");

  densityLegend.append("rect")
    .attr("width", 100)
    .attr("height", 10)
    .style("fill", "url(#density-gradient)");

  densityLegend.append("g")
    .attr("transform", "translate(0, 10)")
    .call(d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format("d")))
    .selectAll("text")
    .attr("font-size", "10px");

}).catch(error => {
  console.error("Erreur de chargement :", error);
});
