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
  even:   getComputedStyle(document.documentElement).getPropertyValue('--color-even').trim(),
  loss:   getComputedStyle(document.documentElement).getPropertyValue('--color-loss').trim(),
};

const DUR    = +getComputedStyle(document.documentElement).getPropertyValue('--dur').trim();
const margin = { top: 16, right: 20, bottom: 72, left: 44 };
const totalH = 320;

// =========================================================================
// CHART C — Static EPI productivity/pay line chart
// =========================================================================
function drawStaticEpiChart(containerSelector, jsonPath) {
  const m      = { top: 150, right: 120, bottom: 20, left: 100 };
  const width  = 800 - m.left - m.right;
  const height = 900 - m.top - m.bottom;

  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const svg = container
    .append('svg')
    .attr('width',  width  + m.left + m.right)
    .attr('height', height + m.top  + m.bottom)
    .append('g')
    .attr('transform', `translate(${m.left},${m.top})`);

  d3.json(jsonPath).then(data => {
    const cleanData = data.map(d => {
      const [yearStr, qStr] = d.Year.split('q');
      const monthIndex = [0, 0, 3, 6, 9][+qStr];
      return {
        date:         new Date(+yearStr, monthIndex, 1),
        productivity: +d.Productivity,
        pay:          +d.Pay,
      };
    }).filter(d => !isNaN(d.date.getTime()));

    const xScale = d3.scaleTime()
      .domain(d3.extent(cleanData, d => d.date))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([100, d3.max(cleanData, d => Math.max(d.productivity, d.pay))])
      .nice()
      .range([height, 0]);

    const makeLine = key => d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d[key]));

    // axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.timeFormat('%Y')))
      .style('font-size', '12px');

    svg.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => `${d}%`))
      .style('font-size', '12px');

    // lines
    const lines = [
      { key: 'productivity', color: '#008080', label: 'Productivity' },
      { key: 'pay',          color: '#d95f02', label: 'Hourly Pay'   },
    ];

    lines.forEach(({ key, color, label }) => {
      svg.append('path')
        .datum(cleanData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 3)
        .attr('d', makeLine(key));

      const last = cleanData[cleanData.length - 1];
      svg.append('text')
        .attr('x', xScale(last.date) + 8)
        .attr('y', yScale(last[key]))
        .attr('alignment-baseline', 'middle')
        .attr('fill', color)
        .style('font-weight', 'bold')
        .style('font-size', '12px')
        .text(label);
    });

    // title / subtitle
    svg.append('text').attr('x', 0).attr('y', -40)
  .attr('font-size', '28px').attr('font-weight', '700')
  .attr('fill', '#1a1a1a').attr('font-family', "'Playfair Display', Georgia, serif")
  .text('Productivity and Hourly Pay diverged sharply starting around 1980');

    svg.append('text').attr('x', 0).attr('y', -12)
  .attr('font-size', '14px').attr('font-style', 'italic')
  .attr('fill', '#666').attr('font-family', "'Playfair Display', Georgia, serif")
  .text('Indexed growth of productivity and pay since 1948');

  }).catch(err => console.warn('EPI chart load failed:', err));
}

// =========================================================================
// CHART D1 — Horizontal bar chart: MLM participant income distribution
// =========================================================================
function drawIncomeChart(containerSelector, jsonPath) {
  const m      = { top: 100, right: 70, bottom: 30, left: 160 };
  const width  = 800 - m.left - m.right;
  const height = 600 - m.top  - m.bottom;

  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const svg = container
    .append('svg')
    .attr('viewBox', '0 0 1100 600')
    .style('width', '100%')
    .style('height', 'auto');

  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  d3.json(jsonPath).then(data => {
    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.pct)])
      .range([0, width]);

    const y = d3.scaleBand()
      .domain(data.map(d => d.E09b))
      .range([0, height])
      .padding(0.28);

    // axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${Math.round(d * 100)}%`).ticks(5))
      .style('font-size', '18px')
      .style('font-family', "'Barlow Condensed', sans-serif");

    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .style('font-size', '18px')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .call(ax => ax.select('.domain').remove());

    // bars
    g.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => y(d.E09b))
      .attr('width',  d => x(d.pct))
      .attr('height', y.bandwidth())
      .attr('rx', 3)
      .attr('fill', COLOR.profit)
      .attr('opacity', 0.88);

    // value labels (inside bars, white)
    g.selectAll('.income-bar-label')
      .data(data)
      .join('text')
      .attr('class', 'income-bar-label')
      .attr('x', d => x(d.pct) - 8)
      .attr('y', d => y(d.E09b) + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'end')
      .attr('font-size', '20px')
      .attr('font-weight', '700')
      .attr('font-family', "'Barlow Condensed', sans-serif")
      .attr('fill', '#fff')
      .text(d => d.pct_label);

    // title / subtitle
    svg.append('text').attr('x', 0).attr('y', 30)
      .attr('font-size', '28px').attr('font-weight', '700')
      .attr('fill', '#1a1a1a').attr('font-family', 'sans-serif')
      .text('Nearly 2/3 of MLM participants have household incomes under $50,000');

    svg.append('text').attr('x', 0).attr('y', 60)
      .attr('font-size', '22px').attr('fill', '#666')
      .attr('font-family', 'sans-serif')
      .text('Household incomes of MLM participants');

  }).catch(err => console.warn('Income chart load failed:', err));
}

// =========================================================================
// CHART D — Animated bar chart
// =========================================================================
function initChart(containerId, copy) {
  const block    = document.getElementById(containerId);
  const svgEl    = block.querySelector('.chart-svg');
  const frameLabel = block.querySelector('.frame-label');
  const frameTitle = block.querySelector('.frame-title');
  const annotation = block.querySelector('.annotation');
  const loading  = block.querySelector('.loading');
  const controls = block.querySelector('.controls');

  const totalW = svgEl.getBoundingClientRect().width || 1200;
  const innerW = totalW - margin.left - margin.right;
  const innerH = totalH - margin.top  - margin.bottom;

  svgEl.setAttribute('height',  totalH);
  svgEl.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

  const svg = d3.select(svgEl);
  const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const x   = d3.scaleBand().range([0, innerW]).padding(0.45);
  const y   = d3.scaleLinear().range([innerH, 0]);
  const gX  = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`);

  function draw(data, animate, fullDomain) {
    const dur = animate ? DUR : 0;

    x.domain(fullDomain);
    y.domain([0, Math.ceil(d3.max(data, d => d.value) / 10) * 10 + 8]);

    const activeLabels = new Set(data.filter(d => d.value > 0).map(d => d.label));
    const isStep1      = activeLabels.size < fullDomain.length;

    // slide whole group to center profit bars in step 1
    if (isStep1) {
      const profitStartX = x(fullDomain.find(l => activeLabels.has(l)));
      const profitEndX   = x(fullDomain.filter(l => activeLabels.has(l)).at(-1)) + x.bandwidth();
      const offset       = (innerW - (profitEndX - profitStartX)) / 2 - profitStartX;
      g.transition().duration(dur).ease(d3.easeCubicOut)
        .attr('transform', `translate(${margin.left + offset},${margin.top})`);
    } else {
      g.transition().duration(dur).ease(d3.easeCubicOut)
        .attr('transform', `translate(${margin.left},${margin.top})`);
    }

    // normalize data to always cover the full domain
    const allData = fullDomain.map(label =>
      data.find(d => d.label === label) || { label, value: 0, type: 'profit' }
    );

    // bars
    const bars = g.selectAll('.bar').data(allData, d => d.label);

    bars.enter().append('rect').attr('class', 'bar')
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', innerH).attr('height', 0).attr('rx', 3)
      .attr('fill', d => COLOR[d.type]).attr('opacity', 0)
    .merge(bars).transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', d => y(d.value)).attr('height', d => innerH - y(d.value))
      .attr('fill', d => COLOR[d.type])
      .attr('opacity', d => d.value === 0 ? 0 : 0.88);

    bars.exit().transition().duration(dur * 0.6)
      .attr('opacity', 0).attr('height', 0).attr('y', innerH).remove();

    // value labels
    const labels = g.selectAll('.bar-label').data(allData, d => d.label);

    labels.enter().append('text').attr('class', 'bar-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('opacity', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-family', "'Barlow Condensed', sans-serif")
      .text(d => d.value + '%')
    .merge(labels)
      .text(d => d.value + '%')
      .transition().duration(dur).ease(d3.easeCubicOut)
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.value) - 6)
      .attr('opacity', d => activeLabels.has(d.label) ? 1 : 0);

    labels.exit().transition().duration(dur).attr('opacity', 0).remove();

    // x-axis (instant, no transition — avoids font flash)
    gX.call(d3.axisBottom(x).tickSize(0).tickPadding(10))
      .call(ax => {
        ax.select('.domain').remove();
        ax.selectAll('.tick text')
          .attr('text-anchor', 'middle')
          .style('font-size', '11px')
          .style('font-family', "'Barlow Condensed', sans-serif")
          .style('opacity', d => activeLabels.has(d) ? 1 : 0)
          .each(function(d) {
            const el         = d3.select(this);
            const normalized = d.replace(' to ', '–');
            const [type, amount] = normalized.split(': ');
            el.text('');
            el.append('tspan').attr('x', 0).attr('dy', '0').text(type);
            el.append('tspan').attr('x', 0).attr('dy', '1.2em').attr('fill-opacity', 0.65).text(amount || '');
          });
      });
  }

  const chartInstance = {
    meta: null,
    applyStep(stateName, stepData, shouldAnimate) {
      if (!stepData) return;
      const stepConfig = copy[stateName];
      if (stepConfig && this.meta) {
        frameLabel.textContent       = stepConfig.label(this.meta);
        frameTitle.textContent       = stepConfig.title;
        annotation.textContent       = stepConfig.annotation(this.meta);
        annotation.style.borderColor = stepConfig.accentColor;
      }
      draw(stepData, shouldAnimate, this.fullDomain);
    },
    uiSetup() {
      loading.style.display = 'none';
      svgEl.style.display   = '';
      if (controls) controls.style.display = 'flex';
    },
  };

  chartRegistry[containerId] = chartInstance;
  return chartInstance;
}

// =========================================================================
// DATA LOADING + INITIALISATION
// =========================================================================
drawStaticEpiChart('#chart-productivity-gap', 'productivity_wage.json');
drawIncomeChart('#chart-income-dist', 'mlm_income_dist.json');

Promise.all([
  d3.json('mlm-chart-data.json'),
  d3.json('fraud-growth.json'),
]).then(([mlmData, fraudData]) => {

  // single shared tooltip for all charts
  d3.select('.chart-tooltip').remove();
  const activeTooltip = d3.select('body')
    .append('div')
    .attr('class', 'chart-tooltip')
    .style('position',         'fixed')
    .style('visibility',       'hidden')
    .style('background-color', 'rgba(255,255,255,0.8)')
    .style('color',            '#000')
    .style('padding',          '8px 12px')
    .style('border-radius',    '4px')
    .style('font-size',        '14px')
    .style('z-index',          '99999')
    .style('pointer-events',   'none');

  // ── CHART B: fraud growth line chart ──────────────────────────────────
  const fraudContainer = document.getElementById('chart-fraud-growth');
  if (fraudContainer) {
    fraudContainer.innerHTML = '';
    fraudData.sort((a, b) => a.year - b.year);

    const categoryTotals  = Array.from(d3.rollup(fraudData, v => d3.sum(v, d => d.indexed), d => d.category));
    const top5Categories  = categoryTotals.sort((a, b) => b[1] - a[1]).slice(0, 5).map(d => d[0]);
    const filteredData    = fraudData.filter(d => top5Categories.includes(d.category));
    const fraudByCategory = Array.from(d3.group(filteredData, d => d.category));

    const fm     = { top: 72, right: 220, bottom: 40, left: 60 };
    const fWidth  = 1800 - fm.left - fm.right;
    const fHeight =  900 - fm.top  - fm.bottom;

    const svg = d3.select(fraudContainer)
      .append('svg')
      .attr('viewBox', '0 0 1800 900')
      .style('width',    '100%')
      .style('height',   'auto')
      .style('overflow', 'visible');

    svg.append('text').attr('x', fm.left).attr('y', 22)
      .attr('font-size', '30px').attr('font-weight', '700')
      .attr('fill', '#1a1a1a').attr('font-family', 'sans-serif')
      .text('Investment Scams, Business scams and Job-related scams have grown the most since 2017');

    svg.append('text').attr('x', fm.left).attr('y', 46)
      .attr('font-size', '22px').attr('fill', '#666')
      .attr('font-family', 'sans-serif')
      .text('Indexed growth · Hover any line to explore');

    svg.append('text').attr('x', fm.left).attr('y', 920)
      .attr('font-size', '18px').attr('fill', '#999')
      .attr('font-family', 'sans-serif')
      .text('Source: FTC Consumer Sentinel Network');

    const g          = svg.append('g').attr('transform', `translate(${fm.left},${fm.top})`);
    const colorScale  = d3.scaleOrdinal().domain(top5Categories)
      .range(['#cc4435', '#278091', '#788637', '#c97b1d', '#3c9b7c']);
    const xFraud      = d3.scaleLinear().domain(d3.extent(filteredData, d => d.year)).range([0, fWidth]);
    const yFraud      = d3.scaleLinear().domain([0, d3.max(filteredData, d => d.indexed - 100)]).range([fHeight, 0]);

    g.append('g').attr('transform', `translate(0,${fHeight})`)
      .call(d3.axisBottom(xFraud).tickFormat(d3.format('d')).tickPadding(8))
      .style('font-size', '16px');

    g.append('g')
      .call(d3.axisLeft(yFraud).tickPadding(8).tickFormat(d => d === 0 ? '0%' : `+${d}%`))
      .style('font-size', '16px');

    const line = d3.line()
      .x(d => xFraud(d.year))
      .y(d => yFraud(d.indexed - 100));

    g.selectAll('.fraud-line')
      .data(fraudByCategory).enter().append('path')
      .attr('class', 'fraud-line')
      .attr('fill', 'none')
      .attr('stroke', d => colorScale(d[0]))
      .attr('stroke-width', 2.5)
      .attr('d', d => line(d[1]));

    // wide invisible hit paths for easier hover
    g.selectAll('.fraud-line-hit')
      .data(fraudByCategory).enter().append('path')
      .attr('class', 'fraud-line-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 20)
      .style('pointer-events', 'all')
      .attr('d', d => line(d[1]))
      .on('mousemove', function(event, d) {
        const [categoryName, dataPoints] = d;
        const mouseX      = d3.pointer(event, this)[0];
        const targetYear  = Math.round(xFraud.invert(mouseX));
        const matchingPoint = dataPoints.find(p => +p.year === targetYear);
        if (matchingPoint) {
          d3.select('.chart-tooltip')
            .style('visibility', 'visible')
            .html(`<strong>${categoryName}</strong>
              <div style="margin-top:4px;">
                Year: ${targetYear} —
                <span style="color:${colorScale(categoryName)};font-weight:bold;">
                  ${matchingPoint.indexed.toFixed(1)}%
                </span>
              </div>`)
            .style('top',  (event.clientY - 15) + 'px')
            .style('left', (event.clientX + 15) + 'px');
        }
      })
      .on('mouseleave', () => d3.select('.chart-tooltip').style('visibility', 'hidden'));

    const labelsData = fraudByCategory.map(d => ({
      y:    yFraud(d[1][d[1].length - 1].indexed - 100),
      data: d,
    })).sort((a, b) => a.y - b.y);

    const minSpacing = 54;
    for (let i = 1; i < labelsData.length; i++) {
      if (labelsData[i].y - labelsData[i - 1].y < minSpacing)
        labelsData[i].y = labelsData[i - 1].y + minSpacing;
    }
    for (let i = labelsData.length - 1; i >= 1; i--) {
      if (labelsData[i].y > fHeight - 15) {
        labelsData[i].y = fHeight - 15;
        if (labelsData[i].y - labelsData[i - 1].y < minSpacing)
          labelsData[i - 1].y = labelsData[i].y - minSpacing;
      }
    }

    const lineLabels = g.selectAll('.line-label')
      .data(labelsData).enter().append('text')
      .attr('class', d => `line-label value label-id-${d.data[0].replace(/\s+/g, '')}`)
      .attr('fill', d => colorScale(d.data[0]))
      .attr('font-size', '16px').attr('font-weight', '600')
      .attr('text-anchor', 'start').attr('dominant-baseline', 'middle')
      .attr('x', d => xFraud(d.data[1][d.data[1].length - 1].year) + 15)
      .attr('y', d => d.y);

    lineLabels.call(parent => {
      parent.append('tspan').text(d => d.data[0]);
      parent.append('tspan')
        .attr('x', d => xFraud(d.data[1][d.data[1].length - 1].year) + 15)
        .attr('dy', '1.2em').attr('font-size', '18px').attr('font-weight', '600')
        .text(d => {
          const pts     = d.data[1];
          const growth  = ((pts[pts.length - 1].indexed - pts[0].indexed) / pts[0].indexed) * 100;
          return pts[0].indexed === 0 ? '0%' : `${growth.toFixed(0)}%`;
        });
    });
  }

  // ── CHART D: animated MLM profit/loss bar chart ───────────────────────
  const mlmChart        = initChart('block-chart-D', mlm_copy);
  mlmChart.meta         = mlmData.meta;
  mlmChart.fullDomain   = mlmData.fullData.map(d => d.label);
  mlmChart.mlm_step1    = { data: mlmData.profitData };
  mlmChart.mlm_step2    = { data: mlmData.fullData };
  mlmChart.uiSetup();
  mlmChart.applyStep('mlm_step1', mlmChart.mlm_step1.data, false);

  // ── SCROLLAMA ─────────────────────────────────────────────────────────
  scroller.setup({ step: '.step', offset: 0.5, debug: false })
    .onStepEnter(({ element }) => {
      document.querySelectorAll('.step').forEach(e => e.classList.remove('is-active'));
      element.classList.add('is-active');
      updateChart(element);
    });

}).catch(err => console.error('Data load error:', err));

// =========================================================================
// SCROLLAMA STEP → CHART TRANSLATOR
// =========================================================================
function updateChart(element) {
  const chartId   = element.dataset.chart;
  const stateName = element.dataset.state;
  const chart     = chartRegistry[chartId];
  if (!chart || !chart[stateName]) return;
  if (chart._currentState === stateName) return;
  chart._currentState = stateName;
  chart.applyStep(stateName, chart[stateName].data, true);
}

window.addEventListener('resize', scroller.resize);