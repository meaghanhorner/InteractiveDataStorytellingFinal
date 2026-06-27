const chartRegistry = {}; 
const scroller = scrollama(); 

const mlm_copy = {
    mlm_step1: {
        label: d => `Among those who earned any profit (n=${d.nProfit})`,
        annotation: d => `${d.pctUnder5kOfProfit}% of those who earned a profit made under $5,000`,
        title: 'How much did those who earned a profit actually make?',
    },
    mlm_step2: {
        label: d => `Among all participants (n=${d.nTotal})`,
        title: 'How much did all participants report earning or losing',
        annotation: d => `${d.pctUnder5kOfProfit}% of those who earned a profit made under $5,000`,
    },
};




const COLOR = {
  profit: getComputedStyle(document.documentElement).getPropertyValue('--color-profit').trim(),
  even: getComputedStyle(document.documentElement).getPropertyValue('--color-even').trim(),
  loss: getComputedStyle(document.documentElement).getPropertyValue('--color-loss').trim(),
};

const DUR = +getComputedStyle(document.documentElement).getPropertyValue('--dur').trim();
const margin = { top: 16, right: 20, bottom: 72, left: 44 };
const totalH = 320;

// =========================================================================
// 2. THE MULTI-CHART GENERATOR
// =========================================================================
function initChart(containerId, copy) {
  console.log('initChart called with container:', containerId);
  
  const block = document.getElementById(containerId);
  const svgEl = block.querySelector('.chart-svg');
  const frameLabel = block.querySelector('.frame-label');
  const frameTitle = block.querySelector('.frame-title');
  const annotation = block.querySelector('.annotation');
  const legend = block.querySelector('.legend');
  const btnOut = block.querySelector('.btn-zoom-out');
  const btnIn = block.querySelector('.btn-zoom-in');
  const stepLabel = block.querySelector('.step-label');
  const loading = block.querySelector('.loading');
  const controls = block.querySelector('.controls');
  
  const totalW = svgEl.getBoundingClientRect().width || 1200;
  const innerW = totalW - margin.left - margin.right;
  const innerH = totalH - margin.top - margin.bottom;

  svgEl.setAttribute('height', totalH);
  svgEl.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const svg = d3.select(svgEl);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const x = d3.scaleBand().range([0, innerW]).padding(0.45);
  const y = d3.scaleLinear().range([innerH, 0]);
  const gX = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`);
  const gY = g.append('g').attr('class', 'axis');
  const gGrid = g.insert('g', ':first-child').attr('class', 'axis');
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--color-gridline').trim();

  // D3 Core Rendering Logic
  function draw(data, animate) {
    const dur = animate ? DUR : 0;
    console.log('draw called, dur:', dur, 'existing bars:', g.selectAll('.bar').size());
    x.domain(data.map(d => d.label));
    y.domain([0, Math.ceil(d3.max(data, d => d.value) / 10) * 10 + 8]);

    gX.transition().duration(dur)
  .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
  .call(ax => {
    ax.select('.domain').remove();
  })
  .on('end', function() {
    d3.select(this).selectAll('.tick text')
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .each(function(d) {
        const el = d3.select(this);
        const normalized = d.replace(' to ', '–');
        const [type, amount] = normalized.split(': ');
        el.text('');
        el.append('tspan').attr('x', 0).attr('dy', '0').text(type);
        el.append('tspan').attr('x', 0).attr('dy', '1.2em').attr('fill-opacity', 0.65).text(amount || '');
      });
  });
  

    // Bars Rendering
    const bars = g.selectAll('.bar').data(data, d => d.label);
    bars.enter().append('rect').attr('class', 'bar')
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', innerH).attr('height', 0).attr('rx', 3)
      .attr('fill', d => COLOR[d.type]).attr('opacity', 0.88)
    .merge(bars).transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', d => y(d.value)).attr('height', d => innerH - y(d.value))
      .attr('fill', d => COLOR[d.type])
      .attr('opacity', d => d.value === 0 ? 0 : 0.88);  // ← add this

    bars.exit().transition().duration(dur * 0.6)
      .attr('height', 0).attr('y', innerH).remove();

    // Value Labels Rendering
    const labels = g.selectAll('.bar-label').data(data, d => `${d.label}__${d.type}`);
    labels.enter().append('text').attr('class', 'bar-label')
        .attr('x', d => x(d.label) + x.bandwidth() / 2)
        .attr('y', innerH - 4).attr('opacity', 0)
      .merge(labels).transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('opacity', d => d.value === 0 ? 0 : 1)  // ← add this
      .text(d => d.value + '%');
    labels.exit().remove();
  }


  
  // Exposed methods object returned to Scrollama registry
  const chartInstance = {
    meta: null, 
    applyStep: function(stateName, stepData, shouldAnimate) {
      console.log('applyStep called:', stateName, shouldAnimate, stepData?.length);
      if (!stepData) return;
      
      const stepConfig = copy[stateName];
      if (stepConfig && this.meta) {
        frameLabel.textContent = stepConfig.label(this.meta);
        frameTitle.textContent = stepConfig.title;
        annotation.textContent = stepConfig.annotation(this.meta);
        annotation.style.borderColor = stepConfig.accentColor;
      }
      
      draw(stepData, shouldAnimate);
    },
    uiSetup: function() {
      loading.style.display = 'none';
      svgEl.style.display = '';
      if (controls) controls.style.display = 'flex';
      
      let zoomed = false;
      if (btnOut && btnIn) {
        btnOut.addEventListener('click', () => {
          if (zoomed) return;
          zoomed = true;
          btnOut.style.display = 'none';
          btnIn.style.display = '';
          if (stepLabel) stepLabel.textContent = 'Step 2 of 2';
          this.applyStep('mlm_step2', this.mlm_step2.data, true);
        });

        btnIn.addEventListener('click', () => {
          if (!zoomed) return;
          zoomed = false;
          btnIn.style.display = 'none';
          btnOut.style.display = '';
          if (stepLabel) stepLabel.textContent = 'Step 1 of 2';
          this.applyStep('mlm_step1', this.mlm_step1.data, true);
        });
      }
    }
  };

  chartRegistry[containerId] = chartInstance;
  return chartInstance;
}

// Data loading
const loadMlmData = d3.json('mlm-chart-data.json');
const loadFraudData = d3.json('fraud-growth.json'); 


  Promise.all([loadMlmData, loadFraudData]).then(([mlmData, fraudData]) => {

  // tooltip first, before any chart code
  d3.select(".chart-tooltip").remove();
  
  let activeTooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("position", "fixed")
    .style("visibility", "hidden")
    .style("background-color", "rgba(255, 255, 255, 0.92)")
    .style("color", "#000000")
    .style("padding", "8px 12px")
    .style("border-radius", "4px")
    .style("font-size", "14px")
    .style("z-index", "99999")
    .style("pointer-events", "none");

  // =========================================================================
  // 3. THE RUNTIME DATA ENGINE (Asynchronous Handling)
  // =========================================================================

  // CHART B //
  const container = document.getElementById('chart-fraud-growth');
  if (container) {
    container.innerHTML = '';
    fraudData.sort((a, b) => a.year - b.year);

    const categoryTotals = Array.from(d3.rollup(fraudData, v => d3.sum(v, d => d.indexed), d => d.category));
    const top5Categories = categoryTotals.sort((a, b) => b[1] - a[1]).slice(0, 5).map(d => d[0]);
    const filteredData = fraudData.filter(d => top5Categories.includes(d.category));
    const fraudByCategory = Array.from(d3.group(filteredData, d => d.category));

    const margin = { top: 72, right: 220, bottom: 40, left: 60 }; 
    const width = 1800 - margin.left - margin.right;
    const height = 900 - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 1800 900`)
      .style("width", "100%")
      .style("height", "auto")
      .style("overflow", "visible"); 


    // Title
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 22)
      .attr("font-size", "30px")
      .attr("font-weight", "700")
      .attr("fill", "#1a1a1a")
      .attr("font-family", "sans-serif")
      .text("Investment Scams, Business scams and Job-related scams have grown the most since 2017");

    // Subtitle
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 46)
      .attr("font-size", "22px")
      .attr("fill", "#666666")
      .attr("font-family", "sans-serif")
      .text("Indexed growth · Hover any line to explore");

      // Source caption
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", 920)
      .attr("font-size", "18px")
      .attr("fill", "#999999")
      .attr("font-family", "sans-serif")
      .text("Source: FTC Consumer Sentinel Network");


    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const colorScale = d3.scaleOrdinal().domain(top5Categories).range(['#cc4435', '#278091', '#788637', '#c97b1d', '#3c9b7c']);
    const xFraud = d3.scaleLinear().domain(d3.extent(filteredData, d => d.year)).range([0, width]);
    const yFraud = d3.scaleLinear().domain([0, d3.max(filteredData, d => d.indexed - 100)]).range([height, 0]);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xFraud)
      .tickFormat(d3.format("d")).tickPadding(8))
      .style("font-size", "16px");
    g.append("g").
      call(d3.axisLeft(yFraud)
      .tickPadding(8)
      .tickFormat(d => d === 0 ? "0%" : `+${d}%`))
      .style("font-size", "16px");

    const line = d3.line()
      .x(d => xFraud(d.year))
      .y(d => yFraud(d.indexed - 100));

    g.selectAll(".fraud-line")
      .data(fraudByCategory)
      .enter()
      .append("path")
      .attr("class", "fraud-line")
      .attr("fill", "none")
      .attr("stroke", d => colorScale(d[0]))
      .attr("stroke-width", 2.5)
      .attr("d", d => line(d[1]));



      g.selectAll(".fraud-line-hit")
  .data(fraudByCategory)
  .enter()
  .append("path")
  .attr("class", "fraud-line-hit")
  .attr("fill", "none")
  .attr("stroke", "transparent")
  .attr("stroke-width", 20)        // wide enough to catch hover easily
  .style("pointer-events", "all") // only respond to events on the stroke, not fill
  .attr("d", d => line(d[1]))
  .on("mousemove", function(event, d) {
    console.log("mm");
  const tooltip = d3.select(".chart-tooltip");  // ← grab it fresh every time
  const [categoryName, dataPoints] = d;
  const mouseX = d3.pointer(event, this)[0];
  const targetYear = Math.round(xFraud.invert(mouseX));
  const matchingPoint = dataPoints.find(p => +p.year === targetYear);

  if (matchingPoint) {
    tooltip
      .style("visibility", "visible")
      .html(`
        <strong>${categoryName}</strong>
        <div style="margin-top:4px;">
          Year: ${targetYear} — 
          <span style="color:${colorScale(categoryName)}; font-weight:bold;">
            ${matchingPoint.indexed.toFixed(1)}%
          </span>
        </div>`)
      .style("top", (event.clientY - 15) + "px")
      .style("left", (event.clientX + 15) + "px");
  }
})
.on("mouseleave", function() {
  d3.select(".chart-tooltip").style("visibility", "hidden");
});

    const labelsData = fraudByCategory.map(d => {
      const lastPoint = d[1][d[1].length - 1];
      return {
        y: yFraud(lastPoint.indexed - 100),
        data: d
      };
    });

    labelsData.sort((a, b) => a.y - b.y);

    const minSpacing = 34; 
    const chartHeight = yFraud.range()[0]; 

    for (let i = 1; i < labelsData.length; i++) {
      if (labelsData[i].y - labelsData[i - 1].y < minSpacing) {
        labelsData[i].y = labelsData[i - 1].y + minSpacing;
      }
    }

    for (let i = labelsData.length - 1; i >= 1; i--) {
      if (labelsData[i].y > chartHeight - 15) {
        labelsData[i].y = chartHeight - 15;
        if (labelsData[i].y - labelsData[i - 1].y < minSpacing) {
          labelsData[i - 1].y = labelsData[i].y - minSpacing;
        }
      }
    }

    const labels = g.selectAll(".line-label")
      .data(labelsData) 
      .enter()
      .append("text")
      .attr("class", d => `line-label value label-id-${d.data[0].replace(/\s+/g, '')}`) 
      .attr("fill", d => colorScale(d.data[0]))
      .attr("font-size", "16px")
      .attr("font-weight", "600")
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .attr("x", d => xFraud(d.data[1][d.data[1].length - 1].year) + 15)
      .attr("y", d => d.y);

    labels.call(parent => {
      parent.append("tspan").text(d => d.data[0]);
      parent.append("tspan")
        .attr("x", d => xFraud(d.data[1][d.data[1].length - 1].year) + 15) 
        .attr("dy", "1.2em")
        .attr("font-size", "18px")
        .attr("font-weight", "600")
        .text(d => {
          const dataPoints = d.data[1];
          const initialRaw = dataPoints[0].indexed;
          const currentRaw = dataPoints[dataPoints.length - 1].indexed;
          if (initialRaw === 0) return "0%"; 
          const growth = ((currentRaw - initialRaw) / initialRaw) * 100;
          return `${growth.toFixed(0)}%`; 
        });
    });
    
  };

  // CHART C //

  function drawStaticEpiChart(containerSelector, jsonPath) {
  // 1. Define dimensions within local function scope
  const margin = { top: 150, right: 120, bottom: 20, left: 100 };
  const width = 1000 - margin.left - margin.right;
  const height = 1100 - margin.top - margin.bottom;

  // 2. Clear out any existing placeholder content inside the selection
  const container = d3.select(containerSelector);
  container.selectAll("*").remove();

  // 3. Create the isolated SVG container
  const svg = container
    .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // 4. Fetch the local JSON file
  d3.json(jsonPath).then(data => {
    
    // Parse time strings (e.g., "1981q3") into native dates for accurate linear scaling
    const cleanData = data.map(d => {
    // d.Year is "1948q1"
    const parts = d.Year.split('q');
    const year = parseInt(parts[0], 10);
    const quarter = parseInt(parts[1], 10);
    
    // Map quarter to month index (0 = Jan, 3 = Apr, 6 = Jul, 9 = Oct)
    let monthIndex = 0;
    if (quarter === 2) monthIndex = 3;
    if (quarter === 3) monthIndex = 6;
    if (quarter === 4) monthIndex = 9;
    
    return {
      date: new Date(year, monthIndex, 1),
      productivity: +d.Productivity, 
      pay: +d.Pay                   
    };
  }).filter(d => !isNaN(d.date.getTime()));

    // 5. Build localized scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(cleanData, d => d.date))
      .range([0, width]);

    const yMax = d3.max(cleanData, d => Math.max(d.productivity, d.pay));
    const yScale = d3.scaleLinear()
      .domain([100, yMax]) // Baseline starts at 100 based on the index
      .nice()
      .range([height, 0]);

    // 6. Generate the line paths
    const productivityLine = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.productivity));

    const payLine = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.pay));

    // 7. Render Axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat("%Y")))
      .style("font-size", "12px");

    svg.append("g")
      .call(d3.axisLeft(yScale).tickFormat(d => `${d}%`))
      .style("font-size", "12px");

    // 8. Draw Productivity Line (Top Line)
    svg.append("path")
      .datum(cleanData)
      .attr("fill", "none")
      .attr("stroke", "#008080") // Distinct slate/teal
      .attr("stroke-width", 3)
      .attr("d", productivityLine);

    // 9. Draw Pay Line (Bottom Line)
    svg.append("path")
      .datum(cleanData)
      .attr("fill", "none")
      .attr("stroke", "#d95f02") // Distinct orange/amber
      .attr("stroke-width", 3)
      .attr("d", payLine);

    // 10. Direct Labels (Saves space, avoids legend clutter)
    const lastPoint = cleanData[cleanData.length - 1];

    svg.append("text")
      .attr("x", xScale(lastPoint.date) + 8)
      .attr("y", yScale(lastPoint.productivity))
      .attr("alignment-baseline", "middle")
      .attr("fill", "#008080")
      .style("font-weight", "bold")
      .style("font-size", "12px")
      .text("Productivity");

    svg.append("text")
      .attr("x", xScale(lastPoint.date) + 8)
      .attr("y", yScale(lastPoint.pay))
      .attr("alignment-baseline", "middle")
      .attr("fill", "#d95f02")
      .style("font-weight", "bold")
      .style("font-size", "12px")
      .text("Hourly Pay");

// Title
    svg.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("font-size", "28px")
      .attr("font-weight", "700")
      .attr("fill", "#1a1a1a")
      .attr("font-family", "sans-serif")
      .text("Productivity and Hourly diverged sharply starting around 1980");

  // Subtitle
    svg.append("text")
      .attr("x", 0)
      .attr("y", -20)
      .attr("font-size", "22px")
      .attr("fill", "#666666")
      .attr("font-family", "sans-serif")
      .text("Indexed growth of productivity and pay since 1948");



      
  }).catch(err => {
    console.warn("Static chart asset load failed:", err);
  });
}
drawStaticEpiChart("#chart-productivity-gap", "productivity_wage.json");
  

  // CHART D //
  const mlmChart = initChart('block-chart-D', mlm_copy);
    mlmChart.meta = mlmData.meta;
    mlmChart.mlm_step1 = { data: mlmData.profitData };
    mlmChart.mlm_step2 = { data: mlmData.fullData };
    mlmChart.uiSetup();
    mlmChart.applyStep('mlm_step1', mlmChart.mlm_step1.data, false);

  const color = d3.scaleOrdinal()
  .domain(Object.keys(COLOR))
  .range(Object.values(COLOR));

    // 3. SCROLLAMA
    scroller.setup({ step: ".step", offset: 0.5, debug: false })
      .onStepEnter(({ element, index }) => {
        document.querySelectorAll(".step").forEach(e => e.classList.remove("is-active"));
        element.classList.add("is-active");
        updateChart(index, element);
      });

  }).catch(err => console.error("Error:", err));

// =========================================================================
// 4. THE GLOBAL TRANSLATOR
// =========================================================================
function updateChart(stepIndex, element) {
  const chartId = element.dataset.chart; 
  const stateName = element.dataset.state; 
  
  const chart = chartRegistry[chartId];
  if (!chart || !chart[stateName]) return;

  // Ignore if this step is already active
  if (chart._currentState === stateName) return;
  chart._currentState = stateName;

  chart.applyStep(stateName, chart[stateName].data, true);
}

window.addEventListener("resize", scroller.resize);


