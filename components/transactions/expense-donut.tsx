"use client";

import { useState } from "react";
import { Pie } from "@visx/shape";
import { formatCurrencyBRL } from "@/lib/formatters";
import {
  TRANSACTION_CATEGORIES,
  type TransactionCategoryCode,
} from "@/lib/transactions/categories";
import styles from "./expense-donut.module.css";

const CATEGORY_COLORS: Record<TransactionCategoryCode, string> = {
  alimentacao: "#d95f59",
  aluguel: "#5969d9",
  assinaturas: "#9a59d9",
  automoveis: "#d98e59",
  combustivel: "#c7a33d",
  condominio: "#4b8f8c",
  internet: "#4f7fbd",
  lazer: "#c6538c",
  luz: "#d9c64f",
  renda: "#4d9b68",
  saude: "#6f9b4d",
};

type ExpenseDatum = {
  category: TransactionCategoryCode;
  totalCents: number;
};

type ExpenseDonutProps = {
  data: ExpenseDatum[];
};

function categoryLabel(categoryCode: TransactionCategoryCode): string {
  return (
    TRANSACTION_CATEGORIES.find(
      (category) => category.code === categoryCode,
    )?.label ?? categoryCode
  );
}

export function ExpenseDonut({ data }: ExpenseDonutProps) {
  const [activeCategory, setActiveCategory] =
    useState<TransactionCategoryCode | null>(null);
  const activeDatum = data.find(
    (item) => item.category === activeCategory,
  );

  return (
    <figure className={styles.figure}>
      <figcaption>Distribuição de gastos por categoria</figcaption>
      {data.length === 0 ? (
        <p className={styles.empty}>Sem despesas neste mês.</p>
      ) : (
        <div className={styles.content}>
          <div className={styles.visual}>
            <svg
              viewBox="0 0 240 240"
              width="100%"
              role="img"
              aria-labelledby="expense-donut-title expense-donut-description"
            >
              <title id="expense-donut-title">Gráfico mensal</title>
              <desc id="expense-donut-description">
                Gráfico de rosca das despesas do mês. A legenda textual repete
                todos os totais.
              </desc>
              <g transform="translate(120 120)">
                <Pie<ExpenseDatum>
                  data={data}
                  pieValue={(item) => item.totalCents}
                  innerRadius={58}
                  outerRadius={104}
                  cornerRadius={3}
                  padAngle={0.02}
                  pieSort={null}
                  pieSortValues={null}
                >
                  {({ arcs, path }) =>
                    arcs.map((arc) => {
                      const datum = arc.data;
                      const label = categoryLabel(datum.category);

                      return (
                        <path
                          key={datum.category}
                          d={path(arc) ?? undefined}
                          fill={CATEGORY_COLORS[datum.category]}
                          tabIndex={0}
                          aria-label={`${label}: ${formatCurrencyBRL(datum.totalCents)}`}
                          onPointerEnter={() =>
                            setActiveCategory(datum.category)
                          }
                          onPointerLeave={() => setActiveCategory(null)}
                          onFocus={() => setActiveCategory(datum.category)}
                          onBlur={() => setActiveCategory(null)}
                          onClick={() =>
                            setActiveCategory((current) =>
                              current === datum.category ? null : datum.category,
                            )
                          }
                        />
                      );
                    })
                  }
                </Pie>
              </g>
            </svg>
            {activeDatum && (
              <p className={styles.tooltip} role="status">
                {categoryLabel(activeDatum.category)}:{" "}
                {formatCurrencyBRL(activeDatum.totalCents)}
              </p>
            )}
          </div>

          <ul className={styles.legend} aria-label="Legenda do gráfico mensal">
            {data.map((item) => (
              <li key={item.category}>
                <span
                  aria-hidden="true"
                  className={styles.swatch}
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                />
                <span>{categoryLabel(item.category)}</span>{" "}
                <span>{formatCurrencyBRL(item.totalCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
