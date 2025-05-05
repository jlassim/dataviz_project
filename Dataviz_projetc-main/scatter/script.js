// Chargement du fichier CSV
d3.csv("startup_growth_investment_data.csv").then(function(data) {
    
    // Conversion des champs numériques
    data.forEach(function(d) {
        d.InvestmentAmount = +d["Investment Amount (USD)"];
        d.GrowthRate = +d["Growth Rate (%)"];
        d.StartupName = d["Startup Name"];
    });

    // Filtrage des données valides (log scale ne supporte pas 0 ou négatif)
    data = data.filter(d => d.InvestmentAmount > 0 && d.GrowthRate >= 0);

    // Dimensions du graphique
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Création du conteneur SVG
    const svg = d3.select("#scatterplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Échelles
    const xScale = d3.scaleLog()
        .domain([d3.min(data, d => d.InvestmentAmount), d3.max(data, d => d.InvestmentAmount)])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.GrowthRate)])
        .range([height, 0]);

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5, "~s");
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .append("text")
        .attr("x", width / 2)
        .attr("y", 35)
        .attr("fill", "#000")
        .style("text-anchor", "middle")
        .text("Investment Amount (USD)");

    svg.append("g")
        .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("fill", "#000")
        .style("text-anchor", "middle")
        .text("Growth Rate (%)");

    // Points du scatter plot
    svg.selectAll("circle")
        .data(data)
      .enter().append("circle")
        .attr("cx", d => xScale(d.InvestmentAmount))
        .attr("cy", d => yScale(d.GrowthRate))
        .attr("r", 8)
        .style("fill", "steelblue")
        .style("opacity", 0.7);

    // Labels des startups
    svg.selectAll(".label")
        .data(data)
      .enter().append("text")
        .attr("x", d => xScale(d.InvestmentAmount))
        .attr("y", d => yScale(d.GrowthRate) - 12)
        .attr("text-anchor", "middle")
        .attr("class", "label")
        .text(d => d.StartupName)
        .style("font-size", "11px")
        .style("fill", "#333");

}).catch(function(error) {
    console.error("Erreur de chargement du CSV :", error);
});
