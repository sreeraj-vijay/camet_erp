/* eslint-disable react/prop-types */
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "./useIsMobile";

const fmt = (n) => "₹" + Number(n ?? 0).toLocaleString("en-IN");

const PropertySalesBreakdownSheet = ({
  open,
  onOpenChange,
  totalPropertySales,
  finalAmount,
  tax,
  totalHotelSales,
  totalRestaurantSales,
  propertySalesBreakdown = [],
}) => {
  const isMobile = useIsMobile();

  console.log(propertySalesBreakdown);

  //  {
  //     cmp_id: '685e813492da9720ba535083',
  //     companyName: 'ARCADIA',
  //     hotelSales: 6135695.8,
  //     hotelTax: 785121,
  //     restaurantSales: 188498.21,
  //     restaurantTax: 3762.01,
  //     totalSales: 6324194.01,
  //     totalTax: 788883.01
  //   },

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="w-full h-[70vh] sm:h-full sm:w-[420px] p-0 flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50"
      >
        <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
          <SheetTitle className="text-sm sm:text-base font-semibold text-gray-800">
            Property Sales Breakdown
          </SheetTitle>
          <SheetDescription className="text-[11px] sm:text-xs text-gray-400">
            Company-wise hotel and restaurant sales under the primary user
          </SheetDescription>
        </SheetHeader>

        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 rounded-2xl bg-white border border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm flex flex-col items-center text-center gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex min-w-0 flex-col items-center gap-1 sm:items-start">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Total Property Sales
            </p>
            <p className="w-full text-right text-md sm:text-md font-bold tabular-nums text-gray-800 leading-tight break-all">
              {totalPropertySales}
            </p>
            <p className="w-full text-right text-md sm:text-md font-bold tabular-nums text-gray-800 leading-tight break-all">
              {tax}
            </p>
            <p className="w-full text-right text-md sm:text-md font-bold tabular-nums text-gray-800 leading-tight break-all">
              {finalAmount}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="text-xs self-center sm:self-center"
          >
            {propertySalesBreakdown.length} companies
          </Badge>
        </div>

        <div className="mx-4 sm:mx-6 mb-3 sm:mb-4 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 sm:px-3 py-2">
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-amber-50 text-amber-700">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  d="M4 20V7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 7V20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M8 9H10M14 9H16M8 13H10M14 13H16M10 20V16H14V20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-[9px] uppercase tracking-wider leading-none font-semibold">
                Hotel
              </p>
            </div>
            <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
              {totalHotelSales}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 sm:px-3 py-2">
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-sky-50 text-sky-700">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  d="M7 4V11M10 4V11M7 8H10M8.5 11V20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M15 4C17 6 17 9 15 11V20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-[9px] uppercase tracking-wider leading-none font-semibold">
                Restaurant
              </p>
            </div>
            <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
              {totalRestaurantSales}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {propertySalesBreakdown.map((company, idx) => (
            <div
              key={`${company.companyName}-${idx}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-[11px] text-gray-400 font-medium w-4 flex-shrink-0 pt-0.5">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 break-words leading-snug">
                      {company.companyName}
                    </p>
                    <p className="text-right text-[11px] tabular-nums text-slate-500 mt-1">
                      Total {fmt(company.totalSales)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-amber-50 text-amber-700">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        d="M4 20V7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 7V20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 9H10M14 9H16M8 13H10M14 13H16M10 20V16H14V20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="text-[9px] uppercase tracking-wider leading-none font-semibold">
                      Hotel
                    </p>
                  </div>
                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.hotelSales)}
                  </p>

                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.hotelTax)}
                  </p>
                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.hotelSales - company.hotelTax)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-sky-50 text-sky-700">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        d="M7 4V11M10 4V11M7 8H10M8.5 11V20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M15 4C17 6 17 9 15 11V20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="text-[9px] uppercase tracking-wider leading-none font-semibold">
                      Restaurant
                    </p>
                  </div>
                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.restaurantSales)}
                  </p>
                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.restaurantTax)}
                  </p>
                  <p className="text-right text-xs sm:text-sm font-semibold tabular-nums text-gray-800 mt-1 break-all">
                    {fmt(company.restaurantSales - company.restaurantTax)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {propertySalesBreakdown.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No property sales data available
            </p>
          )}
        </div>

        <Separator />
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-[11px] text-gray-400 text-center">
            Showing company-wise hotel and restaurant sales
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PropertySalesBreakdownSheet;
