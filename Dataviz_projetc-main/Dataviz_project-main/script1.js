// Configuration globale
const config = {
    margin: { top: 40, right: 40, bottom: 60, left: 60 },
    transitionDuration: 1000,
    colorSchemes: {
        industry: d3.schemeTableau10,
        country: d3.schemeSet3
    }
};

// Variables globales
let rawData = [];
let filteredData = [];
let industryList = [];
let countryList = [];
let yearExtent = [2000, 2023];

// Chargement des données
d3.csv("startup_growth_investment_data.csv").then(function(data) {
    // Formatage des données
    rawData = data.map(d => {
        return {
            name: d['Startup Name'],
            industry: d.Industry,
            fundingRounds: +d['Funding Rounds'],
            investment: +d['Investment Amount (USD)'],
            valuation: +d['Valuation (USD)'],
            investors: +d['Number of Investors'],
            country: d.Country,
            year: +d['Year Founded'],
            growth: +d['Growth Rate (%)'],
            // Calcul de l'investissement moyen par tour
            investmentPerRound: +d['Investment Amount (USD)'] / +d['Funding Rounds']
        };
    });

    // Extraction des listes uniques
    industryList = [...new Set(rawData.map(d => d.industry))].sort();
    countryList = [...new Set(rawData.map(d => d.country))].sort();
    yearExtent = d3.extent(rawData, d => d.year);

    // Mise à jour des filtres
    updateFilters();
    
    // Initialisation avec toutes les données
    filteredData = [...rawData];
    updateDashboard();
    
    // Mise à jour de la date
    document.getElementById('update-date').textContent = new Date().toLocaleDateString();
});

// Mise à jour des filtres
function updateFilters() {
    const industryFilter = d3.select('#industry-filter');
    const countryFilter = d3.select('#country-filter');
    const yearRange = d3.select('#year-range');
    
    // Mise à jour des options des filtres
    industryFilter.selectAll('option:not(:first-child)').remove();
    industryFilter.selectAll('option.data-option')
        .data(industryList)
        .enter()
        .append('option')
        .attr('class', 'data-option')
        .attr('value', d => d)
        .text(d => d);
    
    countryFilter.selectAll('option:not(:first-child)').remove();
    countryFilter.selectAll('option.data-option')
        .data(countryList)
        .enter()
        .append('option')
        .attr('class', 'data-option')
        .attr('value', d => d)
        .text(d => d);
    
    // Mise à jour du range slider
    yearRange
        .attr('min', yearExtent[0])
        .attr('max', yearExtent[1])
        .attr('value', yearExtent[0]);
    
    d3.select('#year-value').text(`${yearExtent[0]}-${yearExtent[1]}`);
    
    // Écouteurs d'événements pour les filtres
    d3.selectAll('.dashboard-filter').on('change', function() {
        applyFilters();
    });
    
    yearRange.on('input', function() {
        d3.select('#year-value').text(`${this.value}-${yearExtent[1]}`);
        applyFilters();
    });
    
    d3.select('#reset-filters').on('click', function() {
        resetFilters();
    });
}

// Application des filtres
function applyFilters() {
    const industry = d3.select('#industry-filter').property('value');
    const country = d3.select('#country-filter').property('value');
    const year = +d3.select('#year-range').property('value');
    
    filteredData = rawData.filter(d => {
        return (industry === 'all' || d.industry === industry) &&
               (country === 'all' || d.country === country) &&
               d.year >= year;
    });
    
    updateDashboard();
}

// Réinitialisation des filtres
function resetFilters() {
    d3.select('#industry-filter').property('value', 'all');
    d3.select('#country-filter').property('value', 'all');
    d3.select('#year-range').property('value', yearExtent[0]);
    d3.select('#year-value').text(`${yearExtent[0]}-${yearExtent[1]}`);
    
    applyFilters();
}

// Mise à jour du dashboard
function updateDashboard() {
    updateMetrics();
    updateBubbleChart();
    updatePieChart();
    updateBarChart();
    updateLineChart();
    updateIndustryBarChart();
}

// Mise à jour des indicateurs
function updateMetrics() {
    const totalStartups = filteredData.length;
    const avgInvestment = d3.mean(filteredData, d => d.investment);
    const avgGrowth = d3.mean(filteredData, d => d.growth);
    const avgValuation = d3.mean(filteredData, d => d.valuation);
    
    // Calcul des variations par rapport à l'ensemble complet
    const totalChange = ((filteredData.length / rawData.length) * 100 - 100).toFixed(1);
    const investmentChange = ((avgInvestment / d3.mean(rawData, d => d.investment)) * 100 - 100).toFixed(1);
    const growthChange = ((avgGrowth / d3.mean(rawData, d => d.growth)) * 100 - 100).toFixed(1);
    const valuationChange = ((avgValuation / d3.mean(rawData, d => d.valuation)) * 100 - 100).toFixed(1);
    
    // Mise à jour des éléments DOM
    d3.select('#total-startups').text(totalStartups);
    d3.select('#avg-investment').text(formatCurrency(avgInvestment));
    d3.select('#avg-growth').text(avgGrowth ? `${avgGrowth.toFixed(1)}%` : 'N/A');
    d3.select('#avg-valuation').text(formatCurrency(avgValuation));
    
    // Mise à jour des variations
    updateMetricChange('#startups-change', totalChange);
    updateMetricChange('#investment-change', investmentChange);
    updateMetricChange('#growth-change', growthChange);
    updateMetricChange('#valuation-change', valuationChange);
    
    function updateMetricChange(selector, value) {
        const element = d3.select(selector);
        element.text(`${Math.abs(value)}%`);
        
        if (value > 0) {
            element.classed('negative', false);
        } else if (value < 0) {
            element.classed('negative', true);
        } else {
            element.text('Pas de changement');
            element.classed('negative', false);
        }
    }
}

// Graphique à bulles: Investissement par secteur et pays
function updateBubbleChart() {
    const container = d3.select('#bubble-chart');
    container.selectAll('*').remove();
    
    if (filteredData.length === 0) return;
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const innerWidth = width - config.margin.left - config.margin.right;
    const innerHeight = height - config.margin.top - config.margin.bottom;
    
    // Agrégation des données par secteur et pays
    const aggregatedData = d3.rollup(
        filteredData,
        v => ({
            count: v.length,
            totalInvestment: d3.sum(v, d => d.investment),
            avgGrowth: d3.mean(v, d => d.growth),
            startups: v
        }),
        d => d.industry,
        d => d.country
    );
    
    // Transformation en tableau pour la visualisation
    const bubbleData = [];
    aggregatedData.forEach((countries, industry) => {
        countries.forEach((stats, country) => {
            bubbleData.push({
                industry,
                country,
                count: stats.count,
                totalInvestment: stats.totalInvestment,
                avgGrowth: stats.avgGrowth,
                startups: stats.startups
            });
        });
    });
    
    // Échelles
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(bubbleData, d => d.totalInvestment)])
        .range([0, innerWidth])
        .nice();
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(bubbleData, d => d.avgGrowth)])
        .range([innerHeight, 0])
        .nice();
    
    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(bubbleData, d => d.count)])
        .range([4, 20]);
    
    const colorScale = d3.scaleOrdinal()
        .domain(industryList)
        .range(config.colorSchemes.industry);
    
    // Création du SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', 'Graphique à bulles montrant la relation entre investissement total, croissance moyenne et nombre de startups par secteur et pays');
    
    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left},${config.margin.top})`);
    
    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => formatCurrency(d, true));
    
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => `${d}%`);
    
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .attr('dy', '1em')
        .style('text-anchor', 'middle');
    
    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);
    
    // Étiquettes des axes
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + config.margin.bottom - 10)
        .style('text-anchor', 'middle')
        .text('Investissement total (USD)');
    
    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -config.margin.left + 20)
        .style('text-anchor', 'middle')
        .text('Croissance moyenne (%)');
    
    // Bulles
    const bubbles = g.selectAll('.bubble')
        .data(bubbleData)
        .enter()
        .append('g')
        .attr('class', 'bubble-group')
        .attr('transform', d => `translate(${xScale(d.totalInvestment)},${yScale(d.avgGrowth)})`)
        .attr('tabindex', '0')
        .attr('role', 'listitem')
        .attr('aria-label', d => `${d.count} startups dans ${d.industry} en ${d.country}. Investissement total: ${formatCurrency(d.totalInvestment)}, croissance moyenne: ${d.avgGrowth.toFixed(1)}%`);
    
    bubbles.append('circle')
        .attr('class', 'bubble')
        .attr('r', d => sizeScale(d.count))
        .attr('fill', d => colorScale(d.industry))
        .attr('opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    
    // Animation d'entrée
    bubbles.attr('transform', `translate(0,${innerHeight})`)
        .transition()
        .duration(config.transitionDuration)
        .attr('transform', d => `translate(${xScale(d.totalInvestment)},${yScale(d.avgGrowth)})`);
    
    // Tooltip
    const tooltip = d3.select('#bubble-tooltip');
    
    bubbles.on("mouseover", function(event, d) {
        // Réduire l'opacité de toutes les bulles sauf celle survolée
        bubbles.select('circle')
            .transition()
            .duration(200)
            .attr('opacity', 0.05);
        
        d3.select(this).select('circle')
            .transition()
            .duration(200)
            .attr('opacity', 0.9)
            .attr('stroke-width', 2)
            .attr('stroke', '#000');
        // Mettre en gras l'élément correspondant dans la légende
        d3.selectAll('#bubble-legend .legend-item')
        .select('span')
        .classed('highlight', function() {
            return d3.select(this.parentNode).datum().label === d.industry;
        });    
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.industry} - ${d.country}</strong><br>
                Startups: ${d.count}<br>
                Investissement total: ${formatCurrency(d.totalInvestment)}<br>
                Croissance moyenne: ${d.avgGrowth.toFixed(1)}%
            `);
    })
    
    .on("mousemove", function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    })
    .on("mouseout", function() {
        // Réinitialise toutes les bulles
        bubbles.select('circle')
            .transition()
            .duration(200)
            .attr('opacity', 0.7)
            .attr('stroke-width', 1)
            .attr('stroke', '#fff');
        // Réinitialiser la mise en gras de la légende
        d3.selectAll('#bubble-legend .legend-item span')
        .classed('highlight', false);    
        tooltip.style('opacity', 0);
    })
    
    .on("focus", function(event, d) {
        d3.select(this).select('circle').attr('stroke-width', 2).attr('stroke', '#000');
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.industry} - ${d.country}</strong><br>
                Startups: ${d.count}<br>
                Investissement total: ${formatCurrency(d.totalInvestment)}<br>
                Croissance moyenne: ${d.avgGrowth.toFixed(1)}%
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    })
    .on("blur", function() {
        d3.select(this).select('circle').attr('stroke-width', 1).attr('stroke', '#fff');
        tooltip.style('opacity', 0);
    });
    
    // Légende
    const legendContainer = d3.select('#bubble-legend');
    legendContainer.selectAll('*').remove();
    
    const legendItems = industryList.map(industry => ({
        label: industry,
        color: colorScale(industry)
    }));
    
    legendItems.forEach(item => {
        const legendItem = legendContainer.append('div')
            .attr('class', 'legend-item')
            .attr('role', 'listitem')
            .datum(item);
        legendItem.append('div')
            .attr('class', 'legend-color')
            .style('background-color', item.color);
        
        legendItem.append('span')
            .text(item.label);
    });
}

// Diagramme circulaire: Répartition par secteur
function updatePieChart() {
    const container = d3.select('#pie-chart');
    container.selectAll('*').remove();
    
    if (filteredData.length === 0) return;
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const radius = Math.min(width, height) / 2 - 10;
    
    // Agrégation des données par secteur
    const industryCounts = d3.rollup(
        filteredData,
        v => v.length,
        d => d.industry
    );
    
    const pieData = Array.from(industryCounts, ([industry, count]) => ({
        industry,
        count,
        percentage: (count / filteredData.length) * 100
    })).sort((a, b) => b.count - a.count);
    
    // Échelle de couleurs
    const colorScale = d3.scaleOrdinal()
        .domain(industryList)
        .range(config.colorSchemes.industry);
    
    // Création du SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', `Diagramme circulaire montrant la répartition des startups par secteur. Total: ${filteredData.length} startups`);
    
    const g = svg.append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
    
    // Génération des arcs
    const pie = d3.pie()
        .value(d => d.count)
        .sort(null);
    
    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(radius);
    const arcHover = d3.arc()
        .innerRadius(0)
        .outerRadius(radius * 1.08);  // légèrement plus grand pour l'effet zoom

    const outerArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);
    
    // Dessin des secteurs
    const arcs = g.selectAll('.arc')
        .data(pie(pieData))
        .enter()
        .append('g')
        .attr('class', 'arc')
        .attr('role', 'listitem')
        .attr('tabindex', '0')
        .attr('aria-label', d => `${d.data.industry}: ${d.data.count} startups (${d.data.percentage.toFixed(1)}%)`);
    const label = g.append("text")
        .attr("text-anchor", "middle")
        .attr("class", "hover-label")
        .style("font-size", "0.9em")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("opacity", 0);
    
    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => colorScale(d.data.industry))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('opacity', 0.7)
        .transition()
        .duration(config.transitionDuration)
        .attrTween('d', function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) { return arc(i(t)); };
        });
    
    // Fonction utilitaire pour calculer l'angle moyen
    function midAngle(d) { return d.startAngle + (d.endAngle - d.startAngle) / 2; }
    
    // Tooltip
    const tooltip = d3.select('#pie-tooltip');
    
    arcs.on("mouseover", function(event, d) {
        d3.select(this).select('path')
            .transition()
            .duration(200)
            .attr('d', arcHover)
            .attr('opacity', 1)
            .attr('stroke-width', 2);
    
        const angle = midAngle(d);
        const [x, y] = arc.centroid(d);
        label.attr("x", x)
            .attr("y", y-6)
            .text(`${d.data.industry}: ${d.data.percentage.toFixed(1)}%`)
            .style("opacity", 1);
    
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.data.industry}</strong><br>
                Startups: ${d.data.count}<br>
                Pourcentage: ${d.data.percentage.toFixed(1)}%
            `);
    })
    .on("mousemove", function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    })
    .on("mouseout", function() {
        d3.select(this).select('path')
            .transition()
            .duration(200)
            .attr('d', arc)
            .attr('opacity', 0.7)
            .attr('stroke-width', 1);
    
        label.style("opacity", 0);
        tooltip.style('opacity', 0);
    })
    .on("focus", function(event, d) {
        d3.select(this).select('path').attr('opacity', 1).attr('stroke-width', 2);
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.data.industry}</strong><br>
                Startups: ${d.data.count}<br>
                Pourcentage: ${d.data.percentage.toFixed(1)}%
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    })
    .on("blur", function() {
        d3.select(this).select('path').attr('opacity', 0.7).attr('stroke-width', 1);
        tooltip.style('opacity', 0);
    });

    // Légende
    const legendContainer = d3.select('#pie-legend');
    legendContainer.selectAll('*').remove();
    
    const legendItems = pieData.map(d => ({
        label: d.industry,
        color: colorScale(d.industry),
        value: d.count,
        percentage: d.percentage
    }));
    
    legendItems.forEach(item => {
        const legendItem = legendContainer.append('div')
            .attr('class', 'legend-item')
            .attr('role', 'listitem');
        
        legendItem.append('div')
            .attr('class', 'legend-color')
            .style('background-color', item.color);
        
        legendItem.append('span')
            .text(`${item.label}: ${item.value}`);
        
    });
}

// Diagramme en barres: Top 10 par croissance
function updateBarChart() {
    const container = d3.select('#bar-chart');
    container.selectAll('*').remove();
    
    if (filteredData.length === 0) return;
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const innerWidth = width - config.margin.left - config.margin.right;
    const innerHeight = height - config.margin.top - config.margin.bottom;
    
    // Tri des données par croissance
    const sortedData = [...filteredData]
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 10);
    
    // Échelles
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.2);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d.growth)])
        .range([innerHeight, 0])
        .nice();
    
    const colorScale = d3.scaleOrdinal()
        .domain(industryList)
        .range(config.colorSchemes.industry);
    
    // Création du SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', 'Diagramme en barres montrant les 10 startups avec la plus forte croissance');
    
    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left},${config.margin.top})`);
    
    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => d.split('_')[1]); // Affiche seulement le numéro
    
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => `${d}%`);
    
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .attr('dy', '0.5em')
        .attr('dx', '-0.5em')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);
    
    // Étiquettes des axes
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + config.margin.bottom - 10)
        .style('text-anchor', 'middle')
        .text('Startup');
    
    g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -config.margin.left + 20)
        .style('text-anchor', 'middle')
        .text('Taux de croissance (%)');
    
    // Barres
    const bars = g.selectAll('.bar')
        .data(sortedData)
        .enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('transform', d => `translate(${xScale(d.name)},0)`)
        .attr('tabindex', '0')
        .attr('role', 'listitem')
        .attr('aria-label', d => `${d.name}: ${d.growth.toFixed(1)}% de croissance, secteur ${d.industry}, pays ${d.country}`);
    
    bars.append('rect')
        .attr('class', 'bar')
        .attr('y', innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', d => colorScale(d.industry))
        .attr('opacity', 0.7)
        .transition()
        .duration(config.transitionDuration)
        .attr('y', d => yScale(d.growth))
        .attr('height', d => innerHeight - yScale(d.growth));
    
    
    // Tooltip
    const tooltip = d3.select('#bar-tooltip');

     bars.on("mouseover", function(event, d) {
        d3.select(this).select('rect')
        .attr('opacity', 1)
        .transition()
        .duration(200)
        .attr('width', xScale.bandwidth() + 5)  // augmente légèrement
        .attr('x', -2.5); 
        
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.name}</strong><br>
                Secteur: ${d.industry}<br>
                Pays: ${d.country}<br>
                Croissance: ${d.growth.toFixed(1)}%<br>
                Investissement: ${formatCurrency(d.investment)}
            `);
    // Ajouter valeur dynamique
    d3.select(this).append('text')
        .attr('class', 'hover-value')
        .attr('x', xScale.bandwidth() / 2)
        .attr('y', yScale(d.growth) - 8)
        .attr('text-anchor', 'middle')
        .style('font-size', '0.8em')
        .style('fill', '#111')
        .text(`${d.growth.toFixed(1)}%`);
})
    .on("mousemove", function(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    })
    .on("mouseout", function() {
        d3.select(this).select('rect')
            .transition()
            .duration(200)
            .attr('width', xScale.bandwidth())
            .attr('x', 0)
            .attr('opacity', 0.7);
    
        tooltip.style('opacity', 0);
            // Supprimer la valeur dynamique
        d3.select(this).select('.hover-value').remove();
    })
    .on("click", function(event, d) {
        d3.selectAll('.bar').attr('stroke', null); // retire les anciens traits
        d3.select(this).select('rect')
            .attr('stroke', '#222')
            .attr('stroke-width', 2);

        d3.select("#industry-display")
          .html(`Domaine de <strong>${d.name}</strong>: ${d.industry}`);
    })

    .on("focus", function(event, d) {
        d3.select(this).select('rect').attr('opacity', 1).attr('stroke', '#000').attr('stroke-width', 1);
        tooltip.style('opacity', 1)
            .html(`
                <strong>${d.name}</strong><br>
                Secteur: ${d.industry}<br>
                Pays: ${d.country}<br>
                Croissance: ${d.growth.toFixed(1)}%<br>
                Investissement: ${formatCurrency(d.investment)}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    })
    .on("blur", function() {
        d3.select(this).select('rect').attr('opacity', 0.7).attr('stroke', 'none');
        tooltip.style('opacity', 0);
    })
    ;
}

// Graphique linéaire: Évolution temporelle des investissements
function updateLineChart() {
    const container = d3.select('#line-chart');
    container.selectAll('*').remove();

    if (filteredData.length === 0) return;

    const width = container.node().clientWidth;
    const height = container.node().clientHeight;
    const innerWidth = width - config.margin.left - config.margin.right;
    const innerHeight = height - config.margin.top - config.margin.bottom;

    // Agrégation des données par année
    const investmentByYear = d3.rollup(
        filteredData,
        v => ({
            totalInvestment: d3.sum(v, d => d.investment),
            avgValuation: d3.mean(v, d => d.valuation),
            count: v.length
        }),
        d => d.year
    );

    const lineData = Array.from(investmentByYear, ([year, stats]) => ({
        year,
        ...stats
    })).sort((a, b) => a.year - b.year);

    // Échelles
    const xScale = d3.scaleLinear()
        .domain(d3.extent(lineData, d => d.year))
        .range([0, innerWidth]);

    let yScale = d3.scaleLinear()
        .domain([0, d3.max(lineData, d => d.totalInvestment)])
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(['investment', 'valuation'])
        .range(['#4361ee', '#4cc9f0']);

    // Création du SVG
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('role', 'img')
        .attr('aria-label', 'Graphique linéaire montrant l\'évolution des investissements au fil du temps');

    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left},${config.margin.top})`);

    // Axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format('d'));

    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => formatCurrency(d, true));

    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis);

    const yAxisGroup = g.append('g')
        .attr('class', 'y-axis')
        .call(yAxis);

    // Étiquettes des axes
    g.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + config.margin.bottom - 10)
        .style('text-anchor', 'middle')
        .text('Année');

    const yAxisLabel = g.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -config.margin.left + 20)
        .style('text-anchor', 'middle')
        .text('Investissement total (USD)');

    // Ligne
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.totalInvestment))
        .curve(d3.curveMonotoneX);

    g.append('path')
        .datum(lineData)
        .attr('class', 'line')
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', colorScale('investment'))
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', function() { return this.getTotalLength(); })
        .attr('stroke-dashoffset', function() { return this.getTotalLength(); })
        .transition()
        .duration(config.transitionDuration * 1.5)
        .attr('stroke-dashoffset', 0);

    // Points
    const points = g.selectAll('.point')
        .data(lineData)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.totalInvestment))
        .attr('r', 5)
        .attr('fill', colorScale('investment'))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('opacity', 0.7)

        .on("mouseover", function(event, d) {
            d3.select(this).attr('r', 8).attr('opacity', 1);
            const valueToShow = showValuation ? d.avgValuation : d.totalInvestment;

            tooltip.style('opacity', 1)
                .html(`
                    <strong>${d.year}</strong><br>
                    Investissement total: ${formatCurrency(d.totalInvestment)}<br>
                    Startups: ${d.count}<br>
                    Valorisation moyenne: ${formatCurrency(d.avgValuation)}
                `);
                    // Ajouter l'étiquette au-dessus du point
                g.append('text')
                .attr('class', 'label')
                .attr('x', xScale(d.year))
                .attr('y', yScale(valueToShow) - 10) // Placer l'étiquette au-dessus du point
                .attr('text-anchor', 'middle')
                .attr('fill', '#000')
                .attr('font-size', '12px')
                .text(formatCurrency(valueToShow)); // Afficher la valeur correspondante (investment ou valuation)
        })
        .on("mousemove", function(event) {
            tooltip.style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on("mouseout", function() {
            d3.select(this).attr('r', 5).attr('opacity', 0.7);
            tooltip.style('opacity', 0);
                // Supprimer l'étiquette au moment du mouseout
            g.selectAll('.label').remove();
        });

    // Tooltip
    const tooltip = d3.select('#line-tooltip')
        .style('position', 'absolute')
        .style('opacity', 0)
        .style('background', '#fff')
        .style('border', '1px solid #ccc')
        .style('border-radius', '5px')
        .style('padding', '5px')
        .style('pointer-events', 'none');

    // Basculer entre investissement et valorisation
    let showValuation = false;

    d3.select('#toggle-metric').on('click', function() {
        showValuation = !showValuation;

        // Mise à jour du bouton
        d3.select(this).text(showValuation ? 'Basculer vers Investissement' : 'Basculer vers Valorisation');

        // Mise à jour de l'axe Y
        const newYDomain = showValuation ?
            [0, d3.max(lineData, d => d.avgValuation)] :
            [0, d3.max(lineData, d => d.totalInvestment)];

        yScale.domain(newYDomain).nice();

        yAxisGroup.transition()
            .duration(config.transitionDuration / 2)
            .call(yAxis.tickFormat(d => formatCurrency(d, true)));

        // Mise à jour de l'étiquette Y
        yAxisLabel.text(showValuation ? 'Valorisation moyenne (USD)' : 'Investissement total (USD)');

        // Mise à jour de la ligne et des points
        const newLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(showValuation ? d.avgValuation : d.totalInvestment))
            .curve(d3.curveMonotoneX);

        g.select('.line')
            .transition()
            .duration(config.transitionDuration)
            .attr('d', newLine)
            .attr('stroke', colorScale(showValuation ? 'valuation' : 'investment'));

        points.transition()
            .duration(config.transitionDuration)
            .attr('cy', d => yScale(showValuation ? d.avgValuation : d.totalInvestment))
            .attr('fill', colorScale(showValuation ? 'valuation' : 'investment'));
    });
}


// Fonction pour obtenir une couleur par industrie
function getIndustryColor(industry) {
    const index = industryList.indexOf(industry);
    return config.colorSchemes.industry[index % config.colorSchemes.industry.length];
}

// Fonction pour formater les montants en devise
function formatCurrency(value) {
    if (value >= 1000000000) {
        return '$' + (value / 1000000000).toFixed(1) + 'B';
    }
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return '$' + (value / 1000).toFixed(1) + 'K';
    }
    return '$' + value.toFixed(0);
}

// Fonctions utilitaires pour le formatage
function formatCurrency(value) {
    if (value >= 1000000000) {
        return `$${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
}

function formatNumber(value) {
    return value.toLocaleString();
}

// barchart
// barchart
function updateIndustryBarChart(sortDirection = 'desc', displayDefault = true) {
    if (!displayDefault) {
        return;  // Si le flag est false, on saute le rendu du graphique.
    }

    // Supprimer le graphique précédent
    d3.select('#industry-bar-chart').selectAll('*').remove();
    
    // Dimensions
    const width = document.querySelector('#industry-bar-chart').clientWidth;
    const height = 400;
    const margin = {top: 20, right: 30, bottom: 60, left: 100};
    
    // Créer SVG
    const svg = d3.select('#industry-bar-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // Groupe principal
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Calculer les investissements par industrie
    const industryData = {};
    filteredData.forEach(d => {
        if (!industryData[d.industry]) {
            industryData[d.industry] = 0;
        }
        industryData[d.industry] += d.investment;
    });
    
    // Convertir en tableau et trier
    let data = Object.entries(industryData).map(([industry, investment]) => ({
        industry,
        investment
    }));
    
    // Trier les données
    if (sortDirection === 'asc') {
        data.sort((a, b) => a.investment - b.investment);
    } else {
        data.sort((a, b) => b.investment - a.investment);
    }
    
    // Échelles
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.investment)])
        .range([0, width - margin.left - margin.right]);
    
    const y = d3.scaleBand()
        .domain(data.map(d => d.industry))
        .range([0, height - margin.top - margin.bottom])
        .padding(0.2);
    
    // Ajouter des barres
    const bars = g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', d => y(d.industry))
        .attr('width', 0)  // Initialiser à 0 pour ajouter l'animation
        .attr('height', y.bandwidth())
        .attr('fill', (d, i) => config.colorSchemes.industry[i % 10])
        .on('mouseover', function(event, d) {
            // Affichage de l'infobulle au survol
            const tooltip = d3.select('#bubble-tooltip');
            tooltip.style('visibility', 'visible')
                   .text(`${d.industry}: ${formatCurrency(d.investment, true)}`);
        })
        .on('mousemove', function(event) {
            // Déplacer l'infobulle avec la souris
            const tooltip = d3.select('#bubble-tooltip');
            tooltip.style('top', (event.pageY + 5) + 'px')
                   .style('left', (event.pageX + 5) + 'px');
        })
        .on('mouseout', function() {
            // Masquer l'infobulle
            const tooltip = d3.select('#bubble-tooltip');
            tooltip.style('visibility', 'hidden');
        });
    
    // Ajouter une transition pour l'animation des barres
    bars.transition()
        .duration(1000)
        .attr('width', d => x(d.investment));
    
    // Axe X avec la rotation appliquée
    g.append('g')
        .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => formatCurrency(d, true)))
        .selectAll('text')
        .attr('transform', 'rotate(45)')  // Rotation de 45 degrés
        .style('text-anchor', 'start')    // Alignement des textes
        .style('font-size', '12px');  // Ajuster la taille de la police
    
    // Axe Y
    g.append('g')
        .call(d3.axisLeft(y))
        .style('font-size', '12px');  // Ajuster la taille de la police


}

// Gestion des boutons de tri
d3.select('#sort-asc').on('click', () => updateIndustryBarChart('asc'));
d3.select('#sort-desc').on('click', () => updateIndustryBarChart('desc'));


// Helper function
function formatValue(value, variable) {
    if (variable.includes('USD)')) return formatCurrency(value);
    if (variable.includes('(%)')) return `${value.toFixed(1)}%`;
    return value;
}

// Fonctions utilitaires
function formatCurrency(value, compact = false) {
    if (isNaN(value)) return 'N/A';
    
    if (compact) {
        return d3.format('$.2s')(value).replace('G', 'B');
    } else {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value);
    }
}

// Redimensionnement responsive
window.addEventListener('resize', function() {
    if (filteredData.length > 0) {
        updateScatterPlot();
    }
});
