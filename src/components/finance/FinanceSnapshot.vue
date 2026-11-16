<template>
  <div class="finance-snapshot">
    <section class="finance-snapshot__section" :aria-labelledby="balancesId">
      <h2 :id="balancesId" class="section-title finance-snapshot__title">
        Retailer balances
      </h2>
      <p class="finance-snapshot__lead">Follow-up status per retailer.</p>

      <ul v-if="balances.length" class="finance-snapshot__balances">
        <li
          v-for="balance in balances"
          :key="balance.retailer_id"
          class="finance-snapshot__balance"
        >
          <div class="finance-snapshot__balance-header">
            <h3 class="finance-snapshot__balance-title">
              {{ balance.retailer_name }}
            </h3>
            <StatusBadge v-bind="retailerBalanceStatus(balance)" />
          </div>
          <p class="finance-snapshot__muted">
            {{ balance.delivery_location || 'Delivery location pending' }}
          </p>
          <dl class="finance-snapshot__facts">
            <div>
              <dt>Sold</dt>
              <dd>{{ formatQuantity(balance.sold_quantity) }}</dd>
            </div>
            <div>
              <dt>Returned</dt>
              <dd>{{ formatQuantity(balance.returned_quantity) }}</dd>
            </div>
            <div>
              <dt>Damaged</dt>
              <dd>{{ formatQuantity(balance.damaged_quantity) }}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{{ formatQuantity(balance.remaining_quantity) }}</dd>
            </div>
            <div>
              <dt>Recognized sales</dt>
              <dd>{{ formatMoney(balance.recognized_sales_value) }}</dd>
            </div>
            <div>
              <dt>Remitted</dt>
              <dd>{{ formatMoney(balance.remitted_amount) }}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{{ formatMoney(balance.outstanding_amount) }}</dd>
            </div>
          </dl>
          <p class="finance-snapshot__muted finance-snapshot__caption">
            Last reconciled {{ formatDate(balance.last_reconciled_at) }} / Last
            remitted {{ formatDate(balance.last_remitted_at) }}
          </p>
        </li>
      </ul>
      <EmptyState
        v-else
        title="No retailer balances yet"
        message="Retailer balances appear after the first reconciliation or remittance is recorded."
      />
    </section>

    <section class="finance-snapshot__section" :aria-labelledby="profitId">
      <h2 :id="profitId" class="section-title finance-snapshot__title">
        Gross profit picture
      </h2>
      <p class="finance-snapshot__lead">How the current picture is built.</p>
      <dl class="finance-snapshot__profit">
        <div v-for="row in profitRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>
            <StatusBadge v-if="row.tone" :tone="row.tone" :label="row.value" />
            <template v-else>{{ row.value }}</template>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate, formatMoney, formatQuantity } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge.vue'
import { netResultStatus, retailerBalanceStatus } from '@/lib/status'

const props = defineProps({
  balances: { type: Array, default: () => [] },
  /** profitSummary with zero defaults applied by the page. */
  profit: { type: Object, required: true }
})
const balancesId = useId()
const profitId = useId()

const jars = value => `${formatQuantity(value)} jars`
const profitRows = computed(() => {
  const profit = props.profit
  const net = netResultStatus(profit.net_profit)
  return [
    { label: 'Issued to retailers', value: jars(profit.issued_quantity) },
    { label: 'Sold through reconciliation', value: jars(profit.sold_quantity) },
    { label: 'Returned to warehouse', value: jars(profit.returned_quantity) },
    { label: 'Damaged at retailer', value: jars(profit.damaged_quantity) },
    { label: 'Still at retailers', value: jars(profit.remaining_quantity) },
    {
      label: 'Recognized sales',
      value: formatMoney(profit.recognized_sales_value)
    },
    {
      label: 'Cost of goods sold',
      value: formatMoney(profit.cost_of_goods_sold)
    },
    { label: 'Gross profit', value: formatMoney(profit.gross_profit) },
    {
      label: 'Operating expenses',
      value: formatMoney(profit.operating_expenses)
    },
    {
      label: 'Net result',
      value: `${net.label} ${formatMoney(profit.net_profit)}`,
      tone: net.tone
    },
    { label: 'Remitted so far', value: formatMoney(profit.remitted_amount) },
    {
      label: 'Outstanding from retailers',
      value: formatMoney(profit.outstanding_amount)
    }
  ]
})
</script>

<style scoped>
.finance-snapshot {
  display: grid;
  gap: var(--boms-space-8);
  min-width: 0;
}
.finance-snapshot__section {
  min-width: 0;
}
.finance-snapshot__title {
  margin: 0;
}
.finance-snapshot__lead {
  margin: var(--boms-space-1) 0 var(--boms-space-4);
  color: var(--boms-color-text-muted);
}
.finance-snapshot__balances {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.finance-snapshot__balance {
  display: flex;
  flex-direction: column;
  gap: var(--boms-space-2);
  padding: var(--boms-space-3) var(--boms-space-4);
  border: 1px solid var(--boms-color-border);
  border-radius: var(--boms-radius-md);
  background: var(--boms-color-surface);
}
.finance-snapshot__balance-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--boms-space-2);
}
.finance-snapshot__balance-title {
  margin: 0;
  color: var(--boms-color-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: normal;
  overflow-wrap: anywhere;
}
.finance-snapshot__muted {
  margin: 0;
  color: var(--boms-color-text-muted);
}
.finance-snapshot__caption {
  font-size: var(--boms-font-size-caption);
}
.finance-snapshot__facts,
.finance-snapshot__profit {
  display: grid;
  gap: var(--boms-space-1);
  margin: 0;
}
.finance-snapshot__facts > div,
.finance-snapshot__profit > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--boms-space-3);
  min-height: 32px;
}
.finance-snapshot__profit > div {
  padding: var(--boms-space-1) 0;
  border-bottom: 1px solid var(--boms-color-border);
}
.finance-snapshot__facts dt,
.finance-snapshot__profit dt {
  color: var(--boms-color-text-muted);
}
.finance-snapshot__facts dd,
.finance-snapshot__profit dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 1024px) {
  .finance-snapshot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
