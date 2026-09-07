/* eslint-disable react/prop-types */

const fmt = (n) => "₹" + Number(n ?? 0).toLocaleString("en-IN");

const AmountWithTax = ({ amount, tax }) => (
  <span className="inline-flex min-w-fit flex-col rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-800">
    <span>{fmt(amount)}</span>
    <span className="text-xs font-medium text-slate-500">
      (Tax: {fmt(tax)})
    </span>
  </span>
);

const RevenueTable = ({ rows = [], selectedDateLabel = "" }) => {
  console.log(rows);
  const sortedRows = [...rows].sort(
    (a, b) => Number(b?.yearlyRevenue ?? 0) - Number(a?.yearlyRevenue ?? 0),
  );
  const maxRevenue = Math.max(
    ...sortedRows.map((row) => Number(row?.yearlyRevenue ?? 0)),
    0,
  );

  console.log(sortedRows);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold text-slate-800">Revenue Table</h2>
        <p className="mt-1 text-sm text-slate-500">
          Company-wise total revenue up to{" "}
          {selectedDateLabel || "the selected date"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50/90">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                Company Name
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                Total Revenue
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                Daily
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                Monthly
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                Yearly
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? (
              sortedRows.map((row, index) => (
                <tr
                  key={`${row?.cmp_id ?? row?.companyName}-${index}`}
                  className="border-t border-slate-100 transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-sky-50/50"
                >
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {row?.companyName || "Unknown Company"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-full max-w-[280px] rounded-sm bg-slate-100 p-[2px] ring-1 ring-slate-200">
                        <div
                          className="h-full rounded-[2px] bg-gradient-to-r from-sky-700 to-blue-900 transition-all duration-500"
                          style={{
                            width: `${
                              maxRevenue > 0
                                ? Math.max(
                                    (Number(row?.yearlyRevenue ?? 0) /
                                      maxRevenue) *
                                      100,
                                    8,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <AmountWithTax
                        amount={row?.dailyRevenue}
                        tax={row?.dailyTax}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <AmountWithTax
                        amount={row?.monthlyRevenue}
                        tax={row?.monthlyTax}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <AmountWithTax
                        amount={row?.yearlyRevenue}
                        tax={row?.yearlyTax}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-10 text-center text-sm text-slate-400 sm:px-5"
                >
                  No revenue data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default RevenueTable;
