# Mobile audit — 10 September 2026, before implementation

Source audit against the charter at 375–390px; browser verification is a separate check.

| Screen                     | Existing behavior                                                | Gaps to resolve                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Main layout                | Quasar responsive drawer, initially closed                       | Header mixes full brand, role and sign-out; drawer breakpoint differs from md; menu/delete targets may be under 44px                                               |
| Sign-in                    | Responsive single-column form                                    | Long marketing section precedes form on phones; password toggle target; distinguish connection failure; prevent duplicate submits                                  |
| Dashboard                  | Cards and lists, six-month trend and monthly review              | Trend precedes watchlist; all detail visible at once; no weekly digest, historical month-end valuation or explicit expiry data                                     |
| Operations                 | Purchase/batch histories are already cards, no q-table           | Numeric inputs lack inputmode; selects lack inline required rules; batch code is typed; recipe defaults absent; retry state missing; pending forms remain editable |
| Distribution               | Warehouse, retailer ledger and issue histories are already cards | Dense tabs and small delete controls; quantity validation only on submit; missing explicit retry state                                                             |
| Finance                    | Open issue lines, balances and histories are already cards       | User-editable reconciliation price; no expired quantity; numeric keypad and inline validation gaps; pending forms remain editable; retry state missing             |
| Access/settings            | Role list and environment card                                   | Supabase-specific status; no variant price history/recipe setup                                                                                                    |
| Access denied / 404        | Static recovery cards                                            | Ensure recovery controls and long text fit on phones                                                                                                               |
| SecondPage / EssentialLink | Unused scaffold, no route                                        | No operational workflow                                                                                                                                            |

The repository contains no q-table or HTML table in an active screen. Existing phone card/list workflows should be retained; desktop report density can be added at md (1024px). No table conversion is needed merely to reproduce the same cards.
