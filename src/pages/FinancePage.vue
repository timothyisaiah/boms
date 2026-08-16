<template>
  <q-page class="page-layout operations-page">
    <section class="page-hero">
      <div>
        <p class="page-hero__eyebrow">Finance</p>
        <h1 class="page-hero__title">Reconciliation and cash</h1>
        <p class="page-hero__body">
          Settle retailer stock, record cash, and review margin without losing
          traceability.
        </p>
      </div>

      <div class="page-hero__actions">
        <q-btn
          color="primary"
          no-caps
          icon="refresh"
          label="Refresh workspace"
          :loading="isLoading"
          @click="loadWorkspace"
        />
        <q-btn
          flat
          color="secondary"
          no-caps
          label="Open distribution"
          to="/retail"
        />
      </div>
    </section>

    <q-banner
      v-if="workspace.mode === 'preview'"
      rounded
      class="surface-card operations-banner bg-amber-1 text-brown-10"
    >
      Preview mode is active. Connect Supabase and apply the latest hosted
      migration to unlock live reconciliations, remittances, and expenses.
    </q-banner>

    <q-banner
      v-if="loadError"
      rounded
      class="surface-card operations-banner bg-orange-1 text-brown-10"
    >
      {{ loadError }}
    </q-banner>

    <section class="card-grid card-grid--two operations-page__metrics">
      <q-card
        v-for="metric in metrics"
        :key="metric.title"
        flat
        class="surface-card metric-card operations-metric-card"
      >
        <q-card-section>
          <div class="section-label">{{ metric.label }}</div>
          <div class="section-title">{{ metric.title }}</div>
          <div class="operations-metric-card__value">{{ metric.value }}</div>
          <p class="text-body2 text-grey-8 q-mt-sm">{{ metric.text }}</p>
        </q-card-section>
      </q-card>
    </section>

    <section>
      <q-card flat class="surface-card operations-workspace-shell">
        <q-card-section class="operations-workspace-shell__header">
          <div>
            <div class="section-label">Workspace</div>
            <div class="section-title">Forms and records</div>
          </div>

          <div class="summary-pill-row">
            <q-chip square color="amber-2" text-color="brown-10">
              {{ retailersWithOutstanding }} collections pending
            </q-chip>
            <q-chip
              square
              :color="workspace.mode === 'live' ? 'green-1' : 'brown-2'"
              :text-color="workspace.mode === 'live' ? 'green-10' : 'brown-10'"
            >
              {{ workspace.mode === 'live' ? 'Live mode' : 'Preview mode' }}
            </q-chip>
          </div>
        </q-card-section>

        <q-tabs
          v-model="activeWorkspaceTab"
          align="left"
          inline-label
          outside-arrows
          mobile-arrows
          indicator-color="primary"
          active-color="brown-10"
          class="operations-tabs"
        >
          <q-tab name="snapshot" icon="insights" label="Snapshot" />
          <q-tab
            name="reconciliation-entry"
            icon="fact_check"
            label="Reconciliation"
          />
          <q-tab
            name="remittance-entry"
            icon="payments"
            label="Remittance"
          />
          <q-tab name="expense-entry" icon="receipt_long" label="Expense" />
          <q-tab
            name="records"
            icon="history"
            :label="`Records (${workspace.reconciliations.length + workspace.remittances.length + workspace.expenses.length})`"
          />
        </q-tabs>

        <q-separator />

        <q-tab-panels
          v-model="activeWorkspaceTab"
          animated
          class="bg-transparent operations-tab-panels"
        >
          <q-tab-panel name="snapshot" class="operations-tab-panel">
            <section class="card-grid card-grid--two">
              <div class="operations-tab-block">
                <div class="section-label">Outstanding view</div>
                <div class="section-title">
                  Retailer balances and follow-up status
                </div>

                <div
                  v-if="workspace.retailerBalances.length > 0"
                  class="list-stack q-mt-lg"
                >
                  <article
                    v-for="balance in workspace.retailerBalances"
                    :key="balance.retailer_id"
                    class="list-card"
                  >
                    <div class="detail-row">
                      <strong>{{ balance.retailer_name }}</strong>
                      <q-chip
                        square
                        :color="getRetailerBalanceState(balance).color"
                        :text-color="getRetailerBalanceState(balance).textColor"
                      >
                        {{ getRetailerBalanceState(balance).label }}
                      </q-chip>
                    </div>

                    <div class="text-body2 text-grey-8 q-mt-sm">
                      {{ balance.delivery_location || 'Delivery location pending' }}
                    </div>

                    <div class="summary-pill-row q-mt-sm">
                      <q-chip square color="grey-2" text-color="grey-9">
                        Sold: {{ formatQuantity(balance.sold_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Returned: {{ formatQuantity(balance.returned_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Damaged: {{ formatQuantity(balance.damaged_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Remaining: {{ formatQuantity(balance.remaining_quantity) }}
                      </q-chip>
                    </div>

                    <div class="detail-row q-mt-sm">
                      <span>Recognized sales</span>
                      <strong>{{
                        formatMoney(balance.recognized_sales_value)
                      }}</strong>
                    </div>

                    <div class="detail-row q-mt-xs">
                      <span>Remitted</span>
                      <span>{{ formatMoney(balance.remitted_amount) }}</span>
                    </div>

                    <div class="detail-row q-mt-xs">
                      <span>Outstanding</span>
                      <span>{{ formatMoney(balance.outstanding_amount) }}</span>
                    </div>

                    <div class="text-caption text-grey-7 q-mt-sm">
                      Last reconciled {{ formatDate(balance.last_reconciled_at) }}
                      / Last remitted {{ formatDate(balance.last_remitted_at) }}
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state q-mt-lg">
                  Retailer balances will appear here after the first
                  reconciliation or remittance is recorded.
                </div>
              </div>

              <div class="operations-tab-block">
                <div class="section-label">Gross profit view</div>
                <div class="section-title">How the current picture is built</div>

                <div class="detail-list q-mt-lg">
                  <div class="detail-row">
                    <span>Issued to retailers</span>
                    <strong>{{ formatQuantity(profitSummary.issued_quantity) }} jars</strong>
                  </div>

                  <div class="detail-row">
                    <span>Sold through reconciliation</span>
                    <strong>{{ formatQuantity(profitSummary.sold_quantity) }} jars</strong>
                  </div>

                  <div class="detail-row">
                    <span>Returned to warehouse</span>
                    <strong>{{ formatQuantity(profitSummary.returned_quantity) }} jars</strong>
                  </div>

                  <div class="detail-row">
                    <span>Damaged at retailer</span>
                    <strong>{{ formatQuantity(profitSummary.damaged_quantity) }} jars</strong>
                  </div>

                  <div class="detail-row">
                    <span>Still at retailers</span>
                    <strong>{{ formatQuantity(profitSummary.remaining_quantity) }} jars</strong>
                  </div>

                  <div class="detail-row">
                    <span>Recognized sales</span>
                    <strong>{{
                      formatMoney(profitSummary.recognized_sales_value)
                    }}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Cost of goods sold</span>
                    <strong>{{
                      formatMoney(profitSummary.cost_of_goods_sold)
                    }}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Gross profit</span>
                    <strong>{{ formatMoney(profitSummary.gross_profit) }}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Operating expenses</span>
                    <strong>{{
                      formatMoney(profitSummary.operating_expenses)
                    }}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Net result</span>
                    <q-chip
                      square
                      :color="profitSummary.net_profit >= 0 ? 'green-1' : 'red-1'"
                      :text-color="
                        profitSummary.net_profit >= 0 ? 'green-10' : 'red-10'
                      "
                    >
                      {{ formatMoney(profitSummary.net_profit) }}
                    </q-chip>
                  </div>

                  <div class="detail-row">
                    <span>Remitted so far</span>
                    <strong>{{ formatMoney(profitSummary.remitted_amount) }}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Outstanding from retailers</span>
                    <strong>{{
                      formatMoney(profitSummary.outstanding_amount)
                    }}</strong>
                  </div>
                </div>
              </div>
            </section>
          </q-tab-panel>

          <q-tab-panel
            name="reconciliation-entry"
            class="operations-tab-panel"
          >
            <div class="operations-tab-block">
              <div class="section-label">Reconciliation workflow</div>
              <div class="section-title">Explain what happened to retailer stock</div>

              <div class="text-body2 text-grey-8 q-mt-sm">
                Count sold, returned, damaged, and remaining jars against each
                open retailer line.
              </div>

              <q-banner
                v-if="reconciliationWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                {{ reconciliationWriteMessage }}
              </q-banner>

              <q-form class="q-mt-lg" @submit.prevent="submitReconciliation">
                <div class="inline-form-grid">
                  <q-select
                    v-model="reconciliationForm.retailerId"
                    outlined
                    emit-value
                    map-options
                    :disable="
                      reconciliationWritesDisabled ||
                      reconciliationRetailerOptions.length === 0
                    "
                    :options="reconciliationRetailerOptions"
                    label="Retail partner"
                  />

                  <q-input
                    v-model="reconciliationForm.reconciledOn"
                    outlined
                    type="date"
                    :disable="reconciliationWritesDisabled"
                    label="Reconciliation date"
                  />

                  <q-input
                    v-model="reconciliationForm.reconciliationReference"
                    outlined
                    :disable="reconciliationWritesDisabled"
                    label="Reconciliation reference"
                    hint="Optional visit, count, or van-sheet code"
                  />

                  <q-input
                    v-model="reconciliationForm.notes"
                    outlined
                    type="textarea"
                    autogrow
                    :disable="reconciliationWritesDisabled"
                    label="Notes"
                  />
                </div>

                <div class="operations-subheading q-mt-lg">Counted lines</div>

                <div class="line-item-stack q-mt-sm">
                  <article
                    v-for="(item, index) in reconciliationForm.items"
                    :key="item.key"
                    class="line-item-card"
                  >
                    <div class="detail-row">
                      <strong>Line {{ index + 1 }}</strong>
                      <q-btn
                        v-if="reconciliationForm.items.length > 1"
                        flat
                        round
                        dense
                        type="button"
                        color="negative"
                        icon="delete"
                        :disable="reconciliationWritesDisabled"
                        @click="removeReconciliationLine(item.key)"
                      />
                    </div>

                    <div class="line-item-grid line-item-grid--two q-mt-md">
                      <q-select
                        v-model="item.stockIssueItemId"
                        outlined
                        emit-value
                        map-options
                        :disable="
                          reconciliationWritesDisabled ||
                          reconciliationOpenLineOptions.length === 0
                        "
                        :options="reconciliationOpenLineOptions"
                        label="Issued stock line"
                        @update:model-value="applyOpenIssueDefaults(item)"
                      />

                      <q-input
                        v-model="item.unitPrice"
                        outlined
                        type="number"
                        min="0"
                        step="100"
                        :disable="reconciliationWritesDisabled"
                        label="Selling price per jar"
                      />
                    </div>

                    <div class="line-item-grid q-mt-md">
                      <q-input
                        v-model="item.quantitySold"
                        outlined
                        type="number"
                        min="0"
                        step="1"
                        :disable="reconciliationWritesDisabled"
                        label="Sold"
                      />

                      <q-input
                        v-model="item.quantityReturned"
                        outlined
                        type="number"
                        min="0"
                        step="1"
                        :disable="reconciliationWritesDisabled"
                        label="Returned"
                      />

                      <q-input
                        v-model="item.quantityDamaged"
                        outlined
                        type="number"
                        min="0"
                        step="1"
                        :disable="reconciliationWritesDisabled"
                        label="Damaged"
                      />

                      <q-input
                        v-model="item.quantityRemaining"
                        outlined
                        type="number"
                        min="0"
                        step="1"
                        :disable="reconciliationWritesDisabled"
                        label="Remaining"
                      />
                    </div>

                    <div
                      v-if="resolveOpenIssueLine(item.stockIssueItemId)"
                      class="text-caption text-grey-7 q-mt-sm"
                    >
                      {{
                        resolveOpenIssueLine(item.stockIssueItemId).sku ?? 'Variant'
                      }}
                      /
                      {{
                        resolveOpenIssueLine(item.stockIssueItemId).batch_code ??
                        'Batch'
                      }}
                      /
                      {{
                        formatQuantity(
                          resolveOpenIssueLine(item.stockIssueItemId)
                            .quantity_open
                        )
                      }}
                      jars open at
                      {{
                        formatMoney(
                          resolveOpenIssueLine(item.stockIssueItemId).unit_cost
                        )
                      }}
                      cost per jar
                    </div>
                  </article>
                </div>

                <div class="form-footer">
                  <div class="summary-pill-row">
                    <q-btn
                      flat
                      color="secondary"
                      no-caps
                      icon="add"
                      type="button"
                      label="Add line"
                      :disable="reconciliationWritesDisabled"
                      @click="addReconciliationLine"
                    />

                    <q-chip square color="blue-1" text-color="blue-10">
                      Sales value:
                      {{ formatMoney(estimatedReconciliationSalesValue) }}
                    </q-chip>

                    <q-chip square color="amber-2" text-color="brown-10">
                      COGS:
                      {{ formatMoney(estimatedReconciliationCogsValue) }}
                    </q-chip>

                    <q-chip square color="green-1" text-color="green-10">
                      Remaining counted:
                      {{ formatQuantity(estimatedRemainingQuantity) }} jars
                    </q-chip>
                  </div>

                  <q-btn
                    color="primary"
                    no-caps
                    type="submit"
                    label="Record reconciliation"
                    :disable="reconciliationWritesDisabled"
                    :loading="isSubmittingReconciliation"
                  />
                </div>
              </q-form>
            </div>
          </q-tab-panel>

          <q-tab-panel name="remittance-entry" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Remittance workflow</div>
              <div class="section-title">Record cash received from retailers</div>

              <div class="text-body2 text-grey-8 q-mt-sm">
                Post receipts separately from stock recognition so collections
                stay auditable.
              </div>

              <q-banner
                v-if="remittanceWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                {{ remittanceWriteMessage }}
              </q-banner>

              <q-form class="q-mt-lg" @submit.prevent="submitRemittance">
                <div class="inline-form-grid">
                  <q-select
                    v-model="remittanceForm.retailerId"
                    outlined
                    emit-value
                    map-options
                    :disable="
                      remittanceWritesDisabled ||
                      remittanceRetailerOptions.length === 0
                    "
                    :options="remittanceRetailerOptions"
                    label="Retail partner"
                  />

                  <q-select
                    v-model="remittanceForm.reconciliationId"
                    outlined
                    clearable
                    emit-value
                    map-options
                    :disable="remittanceWritesDisabled"
                    :options="remittanceReconciliationOptions"
                    label="Linked reconciliation"
                    hint="Optional, for partial or period-specific settlement"
                  />

                  <q-input
                    v-model="remittanceForm.receivedOn"
                    outlined
                    type="date"
                    :disable="remittanceWritesDisabled"
                    label="Received date"
                  />

                  <q-input
                    v-model="remittanceForm.amount"
                    outlined
                    type="number"
                    min="0"
                    step="100"
                    :disable="remittanceWritesDisabled"
                    label="Amount remitted"
                  />

                  <q-input
                    v-model="remittanceForm.remittanceReference"
                    outlined
                    :disable="remittanceWritesDisabled"
                    label="Payment reference"
                    hint="Optional transfer or receipt code"
                  />

                  <q-input
                    v-model="remittanceForm.notes"
                    outlined
                    type="textarea"
                    autogrow
                    :disable="remittanceWritesDisabled"
                    label="Notes"
                  />
                </div>

                <div class="summary-pill-row q-mt-md">
                  <q-chip square color="amber-2" text-color="brown-10">
                    Current outstanding:
                    {{ formatMoney(selectedRetailerOutstandingAmount) }}
                  </q-chip>
                </div>

                <div class="form-footer">
                  <span class="text-caption text-grey-7">
                    Remittances stay separate from stock recognition so partial
                    collections remain auditable.
                  </span>

                  <q-btn
                    color="primary"
                    no-caps
                    type="submit"
                    label="Record remittance"
                    :disable="remittanceWritesDisabled"
                    :loading="isSubmittingRemittance"
                  />
                </div>
              </q-form>
            </div>
          </q-tab-panel>

          <q-tab-panel name="expense-entry" class="operations-tab-panel">
            <div class="operations-tab-block">
              <div class="section-label">Expense workflow</div>
              <div class="section-title">Capture operating costs against profit</div>

              <div class="text-body2 text-grey-8 q-mt-sm">
                Keep expense posting separate from inventory truth while margin
                stays visible.
              </div>

              <q-banner
                v-if="expenseWritesDisabled"
                rounded
                class="bg-grey-2 text-grey-9 q-mt-lg"
              >
                {{ expenseWriteMessage }}
              </q-banner>

              <q-form class="q-mt-lg" @submit.prevent="submitExpense">
                <div class="inline-form-grid">
                  <q-input
                    v-model="expenseForm.expenseCategory"
                    outlined
                    :disable="expenseWritesDisabled"
                    label="Expense category"
                  />

                  <q-input
                    v-model="expenseForm.incurredOn"
                    outlined
                    type="date"
                    :disable="expenseWritesDisabled"
                    label="Expense date"
                  />

                  <q-input
                    v-model="expenseForm.amount"
                    outlined
                    type="number"
                    min="0"
                    step="100"
                    :disable="expenseWritesDisabled"
                    label="Expense amount"
                  />

                  <q-input
                    v-model="expenseForm.vendorName"
                    outlined
                    :disable="expenseWritesDisabled"
                    label="Vendor or payee"
                  />

                  <q-input
                    v-model="expenseForm.expenseReference"
                    outlined
                    :disable="expenseWritesDisabled"
                    label="Reference"
                    hint="Optional invoice, fuel, or voucher number"
                  />

                  <q-input
                    v-model="expenseForm.notes"
                    outlined
                    type="textarea"
                    autogrow
                    :disable="expenseWritesDisabled"
                    label="Notes"
                  />
                </div>

                <div class="form-footer">
                  <span class="text-caption text-grey-7">
                    Operating expenses reduce the gross margin view without
                    changing inventory truth.
                  </span>

                  <q-btn
                    color="primary"
                    no-caps
                    type="submit"
                    label="Record expense"
                    :disable="expenseWritesDisabled"
                    :loading="isSubmittingExpense"
                  />
                </div>
              </q-form>
            </div>
          </q-tab-panel>

          <q-tab-panel name="records" class="operations-tab-panel">
            <section class="card-grid card-grid--two">
              <div class="operations-tab-block">
                <div class="section-label">Reconciliation history</div>
                <div class="section-title">Recent stock settlement snapshots</div>

                <div
                  v-if="workspace.reconciliations.length > 0"
                  class="list-stack q-mt-lg"
                >
                  <article
                    v-for="reconciliation in workspace.reconciliations"
                    :key="reconciliation.id"
                    class="list-card"
                  >
                    <div class="detail-row">
                      <strong>{{ reconciliationLabel(reconciliation) }}</strong>
                      <q-chip square color="amber-2" text-color="brown-10">
                        {{ formatMoney(reconciliation.total_sales_value) }}
                      </q-chip>
                    </div>

                    <div class="text-body2 text-grey-8 q-mt-sm">
                      {{ reconciliation.retailer?.retailer_name ?? 'Retailer' }} /
                      {{ formatDateTime(reconciliation.reconciled_at) }}
                    </div>

                    <div class="summary-pill-row q-mt-sm">
                      <q-chip square color="grey-2" text-color="grey-9">
                        Sold {{ formatQuantity(reconciliation.total_sold_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Returned
                        {{ formatQuantity(reconciliation.total_returned_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Damaged
                        {{ formatQuantity(reconciliation.total_damaged_quantity) }}
                      </q-chip>
                      <q-chip square color="grey-2" text-color="grey-9">
                        Remaining
                        {{ formatQuantity(reconciliation.total_remaining_quantity) }}
                      </q-chip>
                    </div>

                    <div class="summary-pill-row q-mt-sm">
                      <q-chip
                        v-for="item in reconciliation.items ?? []"
                        :key="item.id"
                        square
                        color="grey-2"
                        text-color="grey-9"
                      >
                        {{ item.variant?.sku ?? 'Variant' }} /
                        {{ item.batch?.batch_code ?? 'Batch' }} / sold
                        {{ formatQuantity(item.quantity_sold) }} / left
                        {{ formatQuantity(item.quantity_remaining) }}
                      </q-chip>
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state q-mt-lg">
                  Reconciliation history will appear here after retailer stock
                  is counted and posted.
                </div>
              </div>

              <div class="dashboard-section-stack">
                <div class="operations-tab-block">
                  <div class="section-label">Remittance history</div>
                  <div class="section-title">Recent retailer cash receipts</div>

                  <div
                    v-if="workspace.remittances.length > 0"
                    class="list-stack q-mt-lg"
                  >
                    <article
                      v-for="remittance in workspace.remittances"
                      :key="remittance.id"
                      class="list-card"
                    >
                      <div class="detail-row">
                        <strong>{{
                          remittance.retailer?.retailer_name ?? 'Retailer'
                        }}</strong>
                        <q-chip square color="green-1" text-color="green-10">
                          {{ formatMoney(remittance.amount) }}
                        </q-chip>
                      </div>

                      <div class="text-body2 text-grey-8 q-mt-sm">
                        {{ remittanceLabel(remittance) }}
                      </div>

                      <div class="text-caption text-grey-7 q-mt-xs">
                        {{ formatDateTime(remittance.received_at) }}
                        <span
                          v-if="
                            remittance.reconciliation?.reconciliation_reference
                          "
                        >
                          /
                          {{ remittance.reconciliation.reconciliation_reference }}
                        </span>
                      </div>
                    </article>
                  </div>

                  <div v-else class="empty-state q-mt-lg">
                    Remittance records will appear here after the first retailer
                    payment is posted.
                  </div>
                </div>

                <div class="operations-tab-block">
                  <div class="section-label">Expense history</div>
                  <div class="section-title">Recent operating expenses</div>

                  <div
                    v-if="workspace.expenses.length > 0"
                    class="list-stack q-mt-lg"
                  >
                    <article
                      v-for="expense in workspace.expenses"
                      :key="expense.id"
                      class="list-card"
                    >
                      <div class="detail-row">
                        <strong>{{ expense.expense_category }}</strong>
                        <q-chip square color="blue-1" text-color="blue-10">
                          {{ formatMoney(expense.amount) }}
                        </q-chip>
                      </div>

                      <div class="text-body2 text-grey-8 q-mt-sm">
                        {{ expense.vendor_name || 'Vendor not specified' }}
                      </div>

                      <div class="text-caption text-grey-7 q-mt-xs">
                        {{ formatDateTime(expense.incurred_at) }}
                        <span v-if="expense.expense_reference">
                          / {{ expense.expense_reference }}
                        </span>
                      </div>
                    </article>
                  </div>

                  <div v-else class="empty-state q-mt-lg">
                    Expense records will appear here after the first operating
                    cost is entered.
                  </div>
                </div>
              </div>
            </section>
          </q-tab-panel>
        </q-tab-panels>
      </q-card>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { hasAllowedRole } from '@/constants/roles'
import { authState } from '@/services/auth'
import {
  fetchFinanceWorkspace,
  formatFinanceError,
  getPreviewFinanceWorkspace,
  recordOperatingExpense,
  recordRetailReconciliation,
  recordRetailRemittance
} from '@/services/finance'

let lineKeySeed = 0

function createLineKey(prefix) {
  lineKeySeed += 1
  return `${prefix}-${lineKeySeed}`
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

function createReconciliationLine() {
  return {
    key: createLineKey('reconciliation'),
    stockIssueItemId: null,
    quantitySold: '',
    quantityReturned: '',
    quantityDamaged: '',
    quantityRemaining: '',
    unitPrice: ''
  }
}

function resetArray(target, nextItems) {
  target.splice(0, target.length, ...nextItems)
}

function asNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function toIsoTimestamp(dateValue) {
  if (!dateValue) {
    return null
  }

  return `${dateValue}T12:00:00.000Z`
}

const $q = useQuasar()
const workspace = ref(getPreviewFinanceWorkspace())
const activeWorkspaceTab = ref('snapshot')
const isLoading = ref(false)
const isSubmittingReconciliation = ref(false)
const isSubmittingRemittance = ref(false)
const isSubmittingExpense = ref(false)
const loadError = ref('')

const reconciliationForm = reactive({
  retailerId: null,
  reconciledOn: getTodayString(),
  reconciliationReference: '',
  notes: '',
  items: [createReconciliationLine()]
})

const remittanceForm = reactive({
  retailerId: null,
  reconciliationId: null,
  receivedOn: getTodayString(),
  amount: '',
  remittanceReference: '',
  notes: ''
})

const expenseForm = reactive({
  expenseCategory: '',
  incurredOn: getTodayString(),
  amount: '',
  vendorName: '',
  expenseReference: '',
  notes: ''
})

const canRecordReconciliation = computed(() =>
  hasAllowedRole(authState.role, [
    'admin_owner',
    'operations_manager',
    'finance_accountant'
  ])
)

const canRecordRemittance = computed(() =>
  hasAllowedRole(authState.role, [
    'admin_owner',
    'operations_manager',
    'finance_accountant'
  ])
)

const canRecordExpense = computed(() =>
  hasAllowedRole(authState.role, [
    'admin_owner',
    'operations_manager',
    'finance_accountant'
  ])
)

const profitSummary = computed(() => ({
  active_retailers: 0,
  issued_quantity: 0,
  sold_quantity: 0,
  returned_quantity: 0,
  damaged_quantity: 0,
  remaining_quantity: 0,
  recognized_sales_value: 0,
  cost_of_goods_sold: 0,
  gross_profit: 0,
  expense_count: 0,
  operating_expenses: 0,
  net_profit: 0,
  remitted_amount: 0,
  outstanding_amount: 0,
  ...workspace.value.profitSummary
}))

const reconciliationRetailerOptions = computed(() =>
  workspace.value.retailers.map(retailer => ({
    label: retailer.delivery_location
      ? `${retailer.retailer_name} / ${retailer.delivery_location}`
      : retailer.retailer_name,
    value: retailer.id
  }))
)

const remittanceRetailerOptions = computed(
  () => reconciliationRetailerOptions.value
)

const reconciliationOpenLineOptions = computed(() =>
  workspace.value.openIssueLines
    .filter(
      line =>
        !reconciliationForm.retailerId ||
        line.retailer_id === reconciliationForm.retailerId
    )
    .map(line => ({
      label: `${line.issue_reference ?? `ISSUE-${line.stock_issue_id}`} / ${line.sku ?? 'Variant'} / ${line.batch_code ?? 'Batch'} / ${formatQuantity(line.quantity_open)} jars open`,
      value: line.stock_issue_item_id
    }))
)

const remittanceReconciliationOptions = computed(() =>
  workspace.value.reconciliations
    .filter(
      reconciliation =>
        !remittanceForm.retailerId ||
        reconciliation.retailer?.id === remittanceForm.retailerId
    )
    .map(reconciliation => ({
      label: `${reconciliationLabel(reconciliation)} / ${formatDate(reconciliation.reconciled_at)} / ${formatMoney(reconciliation.total_sales_value)}`,
      value: reconciliation.id
    }))
)

const estimatedReconciliationSalesValue = computed(() =>
  reconciliationForm.items.reduce(
    (total, item) =>
      total +
      Math.max(0, Math.trunc(asNumber(item.quantitySold))) *
        Math.max(0, asNumber(item.unitPrice)),
    0
  )
)

const estimatedReconciliationCogsValue = computed(() =>
  reconciliationForm.items.reduce((total, item) => {
    const openLine = resolveOpenIssueLine(item.stockIssueItemId)

    if (!openLine) {
      return total
    }

    return (
      total +
      Math.max(0, Math.trunc(asNumber(item.quantitySold))) *
        Math.max(0, asNumber(openLine.unit_cost))
    )
  }, 0)
)

const estimatedRemainingQuantity = computed(() =>
  reconciliationForm.items.reduce(
    (total, item) =>
      total + Math.max(0, Math.trunc(asNumber(item.quantityRemaining))),
    0
  )
)

const retailersWithOutstanding = computed(
  () =>
    workspace.value.retailerBalances.filter(
      balance => asNumber(balance.outstanding_amount) > 0
    ).length
)

const selectedRetailerOutstandingAmount = computed(() => {
  const balance = workspace.value.retailerBalances.find(
    item => item.retailer_id === remittanceForm.retailerId
  )

  return balance?.outstanding_amount ?? 0
})

const reconciliationWritesDisabled = computed(
  () =>
    workspace.value.mode !== 'live' ||
    !canRecordReconciliation.value ||
    workspace.value.retailers.length === 0 ||
    workspace.value.openIssueLines.length === 0
)

const remittanceWritesDisabled = computed(
  () =>
    workspace.value.mode !== 'live' ||
    !canRecordRemittance.value ||
    workspace.value.retailers.length === 0
)

const expenseWritesDisabled = computed(
  () => workspace.value.mode !== 'live' || !canRecordExpense.value
)

const reconciliationWriteMessage = computed(() => {
  if (workspace.value.mode !== 'live') {
    return 'Live reconciliation writes are disabled until the app is connected to a Supabase project with the phase 4 migration applied.'
  }

  if (!canRecordReconciliation.value) {
    return 'Your role can review the finance picture, but only admin, operations, and finance roles can record reconciliations.'
  }

  if (workspace.value.retailers.length === 0) {
    return 'Add or seed at least one retailer before posting a reconciliation.'
  }

  if (workspace.value.openIssueLines.length === 0) {
    return 'Open retailer stock lines appear here after warehouse issues are posted and still need reconciliation.'
  }

  return ''
})

const remittanceWriteMessage = computed(() => {
  if (workspace.value.mode !== 'live') {
    return 'Live remittance writes are disabled until the app is connected to a Supabase project with the phase 4 migration applied.'
  }

  if (!canRecordRemittance.value) {
    return 'Your role can review remittances, but only admin, operations, and finance roles can record them.'
  }

  if (workspace.value.retailers.length === 0) {
    return 'Add or seed at least one retailer before recording a remittance.'
  }

  return ''
})

const expenseWriteMessage = computed(() => {
  if (workspace.value.mode !== 'live') {
    return 'Live expense writes are disabled until the app is connected to a Supabase project with the phase 4 migration applied.'
  }

  if (!canRecordExpense.value) {
    return 'Your role can review expenses, but only admin, operations, and finance roles can record them.'
  }

  return ''
})

const metrics = computed(() => [
  {
    label: 'Sales',
    title: 'Recognized sales',
    value: formatMoney(profitSummary.value.recognized_sales_value),
    text: `${formatQuantity(profitSummary.value.sold_quantity)} jars settled.`
  },
  {
    label: 'Cash',
    title: 'Remitted',
    value: formatMoney(profitSummary.value.remitted_amount),
    text: `${formatQuantity(workspace.value.remittances.length)} receipts posted.`
  },
  {
    label: 'Margin',
    title: 'Gross profit',
    value: formatMoney(profitSummary.value.gross_profit),
    text: 'Before operating expenses.'
  },
  {
    label: 'Collections',
    title: 'Outstanding',
    value: formatMoney(profitSummary.value.outstanding_amount),
    text: `${retailersWithOutstanding.value} retailers need follow-up.`
  }
])

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function formatDate(value) {
  if (!value) {
    return 'No date'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) {
    return 'No timestamp'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatQuantity(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(asNumber(value))
}

function reconciliationLabel(reconciliation) {
  return (
    reconciliation.reconciliation_reference?.trim() ||
    `REC-${reconciliation.id}`
  )
}

function remittanceLabel(remittance) {
  return remittance.remittance_reference?.trim() || `REMIT-${remittance.id}`
}

function resolveOpenIssueLine(stockIssueItemId) {
  return (
    workspace.value.openIssueLines.find(
      line => line.stock_issue_item_id === stockIssueItemId
    ) ?? null
  )
}

function getRetailerBalanceState(balance) {
  if (asNumber(balance.outstanding_amount) > 0) {
    return {
      label: 'Outstanding',
      color: 'amber-2',
      textColor: 'brown-10'
    }
  }

  if (asNumber(balance.outstanding_amount) < 0) {
    return {
      label: 'Retailer credit',
      color: 'blue-1',
      textColor: 'blue-10'
    }
  }

  if (asNumber(balance.remaining_quantity) > 0) {
    return {
      label: 'Stock on hand',
      color: 'green-1',
      textColor: 'green-10'
    }
  }

  return {
    label: 'Settled',
    color: 'grey-2',
    textColor: 'grey-8'
  }
}

function suggestUnitPriceForOpenLine(openLine) {
  if (!openLine) {
    return ''
  }

  for (const reconciliation of workspace.value.reconciliations ?? []) {
    for (const item of reconciliation.items ?? []) {
      if (item.stock_issue_item_id === openLine.stock_issue_item_id) {
        return `${asNumber(item.unit_price)}`
      }

      if (
        reconciliation.retailer?.id === openLine.retailer_id &&
        item.variant?.id === openLine.variant_id
      ) {
        return `${asNumber(item.unit_price)}`
      }
    }
  }

  return ''
}

function applyOpenIssueDefaults(line) {
  const openLine = resolveOpenIssueLine(line.stockIssueItemId)

  if (!openLine) {
    line.quantitySold = ''
    line.quantityReturned = ''
    line.quantityDamaged = ''
    line.quantityRemaining = ''
    line.unitPrice = ''
    return
  }

  line.quantitySold = ''
  line.quantityReturned = ''
  line.quantityDamaged = ''
  line.quantityRemaining = `${asNumber(openLine.quantity_open)}`
  line.unitPrice = suggestUnitPriceForOpenLine(openLine)
}

function addReconciliationLine() {
  reconciliationForm.items.push(createReconciliationLine())
}

function removeReconciliationLine(lineKey) {
  if (reconciliationForm.items.length === 1) {
    return
  }

  const nextItems = reconciliationForm.items.filter(
    item => item.key !== lineKey
  )
  resetArray(reconciliationForm.items, nextItems)
}

function resetReconciliationForm() {
  reconciliationForm.retailerId = null
  reconciliationForm.reconciledOn = getTodayString()
  reconciliationForm.reconciliationReference = ''
  reconciliationForm.notes = ''
  resetArray(reconciliationForm.items, [createReconciliationLine()])
}

function resetRemittanceForm() {
  remittanceForm.retailerId = null
  remittanceForm.reconciliationId = null
  remittanceForm.receivedOn = getTodayString()
  remittanceForm.amount = ''
  remittanceForm.remittanceReference = ''
  remittanceForm.notes = ''
}

function resetExpenseForm() {
  expenseForm.expenseCategory = ''
  expenseForm.incurredOn = getTodayString()
  expenseForm.amount = ''
  expenseForm.vendorName = ''
  expenseForm.expenseReference = ''
  expenseForm.notes = ''
}

async function loadWorkspace() {
  isLoading.value = true
  loadError.value = ''

  try {
    workspace.value = await fetchFinanceWorkspace()
  } catch (error) {
    workspace.value = getPreviewFinanceWorkspace()
    loadError.value = formatFinanceError(
      error,
      'Unable to load the reconciliation and finance workspace right now.'
    )
  } finally {
    isLoading.value = false
  }
}

async function submitReconciliation() {
  if (reconciliationWritesDisabled.value) {
    return
  }

  const normalizedItems = reconciliationForm.items.map(item => ({
    stock_issue_item_id: item.stockIssueItemId,
    quantity_sold:
      item.quantitySold === ''
        ? Number.NaN
        : Math.trunc(asNumber(item.quantitySold)),
    quantity_returned:
      item.quantityReturned === ''
        ? 0
        : Math.trunc(asNumber(item.quantityReturned)),
    quantity_damaged:
      item.quantityDamaged === ''
        ? 0
        : Math.trunc(asNumber(item.quantityDamaged)),
    quantity_remaining:
      item.quantityRemaining === ''
        ? Number.NaN
        : Math.trunc(asNumber(item.quantityRemaining)),
    unit_price:
      item.unitPrice === '' ? Number.NaN : Math.max(0, asNumber(item.unitPrice))
  }))

  if (!reconciliationForm.retailerId) {
    $q.notify({
      type: 'warning',
      message: 'Select a retailer before recording a reconciliation.'
    })
    return
  }

  if (
    normalizedItems.some(
      item =>
        !item.stock_issue_item_id ||
        !Number.isFinite(item.quantity_sold) ||
        !Number.isFinite(item.quantity_returned) ||
        !Number.isFinite(item.quantity_damaged) ||
        !Number.isFinite(item.quantity_remaining) ||
        item.quantity_sold < 0 ||
        item.quantity_returned < 0 ||
        item.quantity_damaged < 0 ||
        item.quantity_remaining < 0 ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0
    )
  ) {
    $q.notify({
      type: 'warning',
      message:
        'Complete every reconciliation line with a stock line, non-negative quantities, and a selling price.'
    })
    return
  }

  const duplicateLines = new Set()

  for (const item of normalizedItems) {
    if (duplicateLines.has(item.stock_issue_item_id)) {
      $q.notify({
        type: 'warning',
        message:
          'Each issued stock line can only appear once in a reconciliation.'
      })
      return
    }

    duplicateLines.add(item.stock_issue_item_id)
  }

  for (const item of normalizedItems) {
    const openLine = resolveOpenIssueLine(item.stock_issue_item_id)

    if (!openLine || openLine.retailer_id !== reconciliationForm.retailerId) {
      $q.notify({
        type: 'warning',
        message:
          'One of the selected stock lines is no longer open for the selected retailer.'
      })
      return
    }

    const accountedQuantity =
      item.quantity_sold +
      item.quantity_returned +
      item.quantity_damaged +
      item.quantity_remaining

    if (accountedQuantity !== Math.trunc(asNumber(openLine.quantity_open))) {
      $q.notify({
        type: 'warning',
        message:
          'Each line must fully explain the retailer stock currently on hand.'
      })
      return
    }
  }

  isSubmittingReconciliation.value = true

  try {
    await recordRetailReconciliation({
      retailerId: reconciliationForm.retailerId,
      reconciledAt: toIsoTimestamp(reconciliationForm.reconciledOn),
      reconciliationReference: reconciliationForm.reconciliationReference,
      notes: reconciliationForm.notes,
      items: normalizedItems
    })

    $q.notify({
      type: 'positive',
      message:
        'Reconciliation recorded and retailer stock balances updated successfully.'
    })

    resetReconciliationForm()
    await loadWorkspace()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the reconciliation right now.'
      )
    })
  } finally {
    isSubmittingReconciliation.value = false
  }
}

async function submitRemittance() {
  if (remittanceWritesDisabled.value) {
    return
  }

  const normalizedAmount = asNumber(remittanceForm.amount, Number.NaN)

  if (!remittanceForm.retailerId) {
    $q.notify({
      type: 'warning',
      message: 'Select a retailer before recording a remittance.'
    })
    return
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    $q.notify({
      type: 'warning',
      message: 'Enter a remittance amount greater than zero.'
    })
    return
  }

  isSubmittingRemittance.value = true

  try {
    await recordRetailRemittance({
      retailerId: remittanceForm.retailerId,
      reconciliationId: remittanceForm.reconciliationId,
      receivedAt: toIsoTimestamp(remittanceForm.receivedOn),
      amount: normalizedAmount,
      remittanceReference: remittanceForm.remittanceReference,
      notes: remittanceForm.notes
    })

    $q.notify({
      type: 'positive',
      message: 'Remittance recorded and retailer balance updated successfully.'
    })

    resetRemittanceForm()
    await loadWorkspace()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the remittance right now.'
      )
    })
  } finally {
    isSubmittingRemittance.value = false
  }
}

async function submitExpense() {
  if (expenseWritesDisabled.value) {
    return
  }

  const normalizedAmount = asNumber(expenseForm.amount, Number.NaN)

  if (!expenseForm.expenseCategory.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Enter an expense category before saving the cost.'
    })
    return
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    $q.notify({
      type: 'warning',
      message: 'Enter an expense amount greater than zero.'
    })
    return
  }

  isSubmittingExpense.value = true

  try {
    await recordOperatingExpense({
      expenseCategory: expenseForm.expenseCategory,
      incurredAt: toIsoTimestamp(expenseForm.incurredOn),
      amount: normalizedAmount,
      vendorName: expenseForm.vendorName,
      expenseReference: expenseForm.expenseReference,
      notes: expenseForm.notes
    })

    $q.notify({
      type: 'positive',
      message: 'Expense recorded and gross profit view refreshed successfully.'
    })

    resetExpenseForm()
    await loadWorkspace()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: formatFinanceError(
        error,
        'Unable to record the expense right now.'
      )
    })
  } finally {
    isSubmittingExpense.value = false
  }
}

watch(
  () => reconciliationForm.retailerId,
  retailerId => {
    for (const item of reconciliationForm.items) {
      const openLine = resolveOpenIssueLine(item.stockIssueItemId)

      if (item.stockIssueItemId && openLine?.retailer_id !== retailerId) {
        item.stockIssueItemId = null
        item.quantitySold = ''
        item.quantityReturned = ''
        item.quantityDamaged = ''
        item.quantityRemaining = ''
        item.unitPrice = ''
      }
    }
  }
)

watch(
  () => remittanceForm.retailerId,
  retailerId => {
    const selectedReconciliation = workspace.value.reconciliations.find(
      reconciliation => reconciliation.id === remittanceForm.reconciliationId
    )

    if (
      selectedReconciliation &&
      selectedReconciliation.retailer?.id !== retailerId
    ) {
      remittanceForm.reconciliationId = null
    }
  }
)

onMounted(() => {
  void loadWorkspace()
})
</script>
