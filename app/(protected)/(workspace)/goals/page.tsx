import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ContributionForm } from "@/components/goals/contribution-form";
import { DeleteContribution } from "@/components/goals/delete-contribution";
import { DeleteGoal } from "@/components/goals/delete-goal";
import { GoalForm } from "@/components/goals/goal-form";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { RevealPanel } from "@/components/ui/reveal-panel";
import { createContributionAction, createGoalAction } from "@/lib/actions/goals";
import { formatCivilDatePtBR, formatCurrencyBRL } from "@/lib/formatters";
import type { GoalDashboardItem } from "@/lib/goals/load-dashboard";
import { loadGoalsDashboard } from "@/lib/goals/load-dashboard";
import { createClient } from "@/lib/supabase/server";
import { parseAmountToCents } from "@/lib/transactions/money";
import styles from "./goals.module.css";

export const metadata: Metadata = {
  title: "Metas | Cadence",
};

function paceLabel(goal: GoalDashboardItem) {
  const { progress } = goal;
  if (progress.paceStatus === "completed") return "Objetivo alcançado";
  if (progress.paceStatus === "no_pace") return "Sem ritmo definido";
  if (progress.paceStatus === "on_track") return "Em dia com o ritmo";
  const count = progress.paceUnits ?? 0;
  const unit = count === 1 ? "mês" : "meses";
  return `${count} ${unit} de ritmo ${
    progress.paceStatus === "ahead" ? "à frente" : "atrás"
  }`;
}

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await loadGoalsDashboard(supabase, user.id);
  if (result.status === "no_workspace") redirect("/onboarding/workspace");
  if (result.status === "error") {
    return (
      <main className={styles.errorPage}>
        <FeedbackState
          kind="error"
          title="Não foi possível carregar suas metas."
          description="Tente novamente em alguns instantes."
        >
          <Link href="/dashboard">Voltar ao Dashboard</Link>
        </FeedbackState>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        eyebrow={result.data.workspace.name}
        title="Metas"
        description="O ritmo é uma referência: aporte quando puder, no valor que fizer sentido."
      />

      <RevealPanel
        className={`${styles.card} ${styles.create}`}
        label="Criar meta"
      >
        <GoalForm
          action={createGoalAction}
          submitLabel="Salvar meta"
          initialValues={{
            name: "",
            targetAmount: "",
            suggestedMonthly: "",
          }}
        />
      </RevealPanel>

      {result.data.goals.length === 0 ? (
        <FeedbackState
          kind="empty"
          title="Nenhuma meta ainda."
          description="Crie uma meta para acompanhar seu progresso e registrar aportes."
        />
      ) : (
        <section className={styles.grid} aria-label="Metas">
          {result.data.goals.map((goal) => {
            const action = createContributionAction.bind(null, goal.id);

            return (
              <article
                key={goal.id}
                className={`${styles.goal} ${
                  goal.progress.completed ? styles.goalComplete : ""
                }`}
                aria-labelledby={`goal-${goal.id}`}
              >
                <div className={styles.goalHeader}>
                  <h2 id={`goal-${goal.id}`}>{goal.name}</h2>
                  {goal.progress.completed && (
                    <span className={styles.badge}>Meta concluída</span>
                  )}
                </div>

                <div className={styles.progressSummary}>
                  <p className={styles.amountLine}>
                    {formatCurrencyBRL(goal.progress.totalContributedCents)} de{" "}
                    {formatCurrencyBRL(goal.progress.targetCents)}
                  </p>
                  <p className={styles.percent}>
                    {goal.progress.percentage}% do caminho
                  </p>
                  <progress
                    className={styles.progress}
                    max={100}
                    value={goal.progress.barPercentage}
                    aria-label={`Progresso de ${goal.name}`}
                  />
                </div>

                <p className={styles.pace} data-pace={goal.progress.paceStatus}>
                  {paceLabel(goal)}
                </p>

                <div className={styles.actions}>
                  <Link href={`/goals/${goal.id}/edit`}>Editar meta</Link>
                  <DeleteGoal
                    goalId={goal.id}
                    contributionCount={goal.contributionCount}
                  />
                </div>

                <RevealPanel
                  className={styles.contributionForm}
                  label="Aportar"
                >
                  <ContributionForm
                    action={action}
                    idPrefix={`contribution-${goal.id}`}
                    submitLabel="Salvar aporte"
                    initialValues={{
                      amount: "",
                      occurredOn: result.data.today,
                      goalId: goal.id,
                    }}
                  />
                </RevealPanel>

                {goal.contributions.length > 0 && (
                  <section className={styles.contributions}>
                    <h3>Aportes recentes</h3>
                    <ul>
                      {goal.contributions.slice(0, 4).map((item) => (
                        <li key={item.id} className={styles.contributionRow}>
                          <div>
                            <strong>
                              {formatCurrencyBRL(
                                parseAmountToCents(item.amount) ?? 0,
                              )}
                            </strong>
                            <p className={styles.contributionMeta}>
                              {formatCivilDatePtBR(item.occurredOn)}
                            </p>
                          </div>
                          <div className={styles.actions}>
                            <Link href={`/contributions/${item.id}/edit`}>
                              Editar aporte
                            </Link>
                            <DeleteContribution transactionId={item.id} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
