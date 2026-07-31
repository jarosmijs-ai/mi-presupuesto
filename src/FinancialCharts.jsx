import React, {
  useLayoutEffect,
  useMemo
} from 'react';

import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ'
});

export default function FinancialCharts({
  expenses = [],
  budgets = {}
}) {
  const categoryData = useMemo(() => {
    const totals = {};

    expenses.forEach((expense) => {
      const category =
        expense.category || 'Otros';

      totals[category] =
        (totals[category] || 0) +
        Number(expense.amount || 0);
    });

    return Object.entries(totals)
      .map(([category, value]) => ({
        category,
        value
      }))
      .filter((item) => item.value > 0);
  }, [expenses]);

  const budgetData = useMemo(() => {
    return Object.entries(budgets).map(
      ([category, budget]) => {
        const spent = expenses
          .filter(
            (expense) =>
              expense.category === category
          )
          .reduce(
            (total, expense) =>
              total +
              Number(expense.amount || 0),
            0
          );

        return {
          category,
          budget: Number(budget || 0),
          spent
        };
      }
    );
  }, [budgets, expenses]);

  return (
    <section className="charts-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            ANÁLISIS DEL MES
          </span>

          <h2>Resumen visual</h2>

          <p>
            Compara tus gastos con el presupuesto
            definido para cada categoría.
          </p>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-card-heading">
            <div>
              <span>Distribución</span>
              <h3>Gastos por categoría</h3>
            </div>

            <strong>
              {currency.format(
                categoryData.reduce(
                  (total, item) =>
                    total + item.value,
                  0
                )
              )}
            </strong>
          </div>

          {categoryData.length > 0 ? (
            <ExpenseDonutChart
              data={categoryData}
            />
          ) : (
            <ChartEmptyState />
          )}
        </div>

        <div className="chart-card chart-card-wide">
          <div className="chart-card-heading">
            <div>
              <span>Comparación</span>
              <h3>Presupuesto vs. gastado</h3>
            </div>
          </div>

          <BudgetComparisonChart
            data={budgetData}
          />
        </div>
      </div>
    </section>
  );
}

function ExpenseDonutChart({ data }) {
  useLayoutEffect(() => {
    const root = am5.Root.new(
      'expense-donut-chart'
    );

    root.setThemes([
      am5themes_Animated.new(root)
    ]);

    root.numberFormatter.set(
      'numberFormat',
      "'Q'#,###.00"
    );

    const chart =
      root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
          innerRadius:
            am5.percent(64)
        })
      );

    const series =
      chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: 'value',
          categoryField: 'category',
          alignLabels: false
        })
      );

    series.labels.template.setAll({
      text: '{category}',
      fontSize: 12,
      fill: am5.color(0x64748b)
    });

    series.ticks.template.setAll({
      strokeOpacity: 0.3
    });

    series.slices.template.setAll({
      stroke: am5.color(0xffffff),
      strokeWidth: 3,
      cornerRadius: 8,
      tooltipText:
        '{category}: Q{value.formatNumber("#,###.00")}'
    });

    series.data.setAll(data);

    series.appear(700, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div
      id="expense-donut-chart"
      className="chart-container donut-chart"
    />
  );
}

function BudgetComparisonChart({ data }) {
  useLayoutEffect(() => {
    const root = am5.Root.new(
      'budget-comparison-chart'
    );

    root.setThemes([
      am5themes_Animated.new(root)
    ]);

    root.numberFormatter.set(
      'numberFormat',
      "'Q'#,###"
    );

    const chart =
      root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: 'none',
          wheelY: 'none',
          layout: root.verticalLayout
        })
      );

    const xRenderer =
      am5xy.AxisRendererX.new(root, {
        minGridDistance: 28
      });

    xRenderer.labels.template.setAll({
      rotation: -35,
      centerY: am5.p50,
      centerX: am5.p100,
      paddingRight: 10,
      fontSize: 11,
      fill: am5.color(0x64748b)
    });

    xRenderer.grid.template.setAll({
      visible: false
    });

    const xAxis =
      chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: 'category',
          renderer: xRenderer
        })
      );

    const yRenderer =
      am5xy.AxisRendererY.new(root, {});

    yRenderer.labels.template.setAll({
      fontSize: 11,
      fill: am5.color(0x64748b)
    });

    yRenderer.grid.template.setAll({
      strokeOpacity: 0.08
    });

    const yAxis =
      chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: 0,
          renderer: yRenderer
        })
      );

    function createSeries({
      name,
      field,
      color
    }) {
      const series =
        chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name,
            xAxis,
            yAxis,
            valueYField: field,
            categoryXField: 'category',
            clustered: true,
            fill: am5.color(color),
            stroke: am5.color(color)
          })
        );

      series.columns.template.setAll({
        width: am5.percent(72),
        cornerRadiusTL: 7,
        cornerRadiusTR: 7,
        tooltipText:
          `${name}: Q{valueY.formatNumber("#,###.00")}`
      });

      series.data.setAll(data);
      series.appear(700);

      return series;
    }

    const budgetSeries = createSeries({
      name: 'Presupuesto',
      field: 'budget',
      color: 0xcbd5e1
    });

    const spentSeries = createSeries({
      name: 'Gastado',
      field: 'spent',
      color: 0x10b981
    });

    xAxis.data.setAll(data);

    const legend =
      chart.children.push(
        am5.Legend.new(root, {
          centerX: am5.p50,
          x: am5.p50
        })
      );

    legend.labels.template.setAll({
      fontSize: 12,
      fill: am5.color(0x475569)
    });

    legend.data.setAll([
      budgetSeries,
      spentSeries
    ]);

    chart.appear(700, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div
      id="budget-comparison-chart"
      className="chart-container budget-chart"
    />
  );
}

function ChartEmptyState() {
  return (
    <div className="chart-empty-state">
      <span>◌</span>

      <strong>
        Sin gastos registrados
      </strong>

      <p>
        La gráfica aparecerá cuando agregues
        movimientos en el mes seleccionado.
      </p>
    </div>
  );
}