import TitleDiv from "@/components/common/TitleDiv";
import SummaryCards from "../Components/SummaryDashboard/SummaryCards";
import SummaryCardsSkeleton from "../Components/SummaryDashboard/SummaryCardsSkeleton";
import RevenueTable from "../Components/SummaryDashboard/RevenueTable";
import { useSelector } from "react-redux";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/api";
import { AlertCircle, CalendarIcon, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const fmt = (n) =>
  "₹" + " " +
  Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const SummaryDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const company = useSelector(
    (state) => state.secSelectedOrganization.secSelectedOrg,
  );

  const cmp_id = company?._id;
  const primaryUserId = company?.owner;
  const selectedDateParam = useMemo(
    () => format(selectedDate, "yyyy-MM-dd"),
    [selectedDate],
  );
  const selectedDateLabel = useMemo(
    () => format(selectedDate, "dd MMM yyyy"),
    [selectedDate],
  );
  const selectedDateLongLabel = useMemo(
    () => format(selectedDate, "EEEE, dd MMMM yyyy"),
    [selectedDate],
  );
  const dashboardRequestConfig = useMemo(
    () => ({
      withCredentials: true,
      params: { date: selectedDateParam },
    }),
    [selectedDateParam],
  );

  const fetchDashboardConsolidatedTotals = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardConsolidatedTotals/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const fetchDashboardCompanyRevenueBreakdown = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardCompanyRevenueBreakdown/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const fetchDashboardCompanyDailyCollectionBreakdown = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardCompanyDailyCollectionBreakdown/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const fetchDashboardCompanyMonthlyCollectionBreakdown = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardCompanyMonthlyCollectionBreakdown/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const fetchDashboardRoomCountSummary = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardRoomCountSummary/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const fetchDashboardPropertySalesSummary = async () => {
    const response = await api.get(
      `/api/sUsers/fetchDashboardPropertySalesSummary/${cmp_id}/${primaryUserId}`,
      dashboardRequestConfig,
    );
    return response.data;
  };

  const {
    data,
    isLoading: isTotalsLoading,
    isError: isTotalsError,
    error: totalsError,
    refetch: refetchTotals,
    isFetching: isTotalsFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "consolidatedTotals",
      cmp_id,
      selectedDateParam,
    ],
    queryFn: fetchDashboardConsolidatedTotals,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: revenueBreakdownData,
    isLoading: isRevenueBreakdownLoading,
    isError: isRevenueBreakdownError,
    error: revenueBreakdownError,
    refetch: refetchRevenueBreakdown,
    isFetching: isRevenueBreakdownFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "companyRevenueBreakdown",
      primaryUserId,
      selectedDateParam,
    ],
    queryFn: fetchDashboardCompanyRevenueBreakdown,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  console.log(revenueBreakdownData);

  const {
    data: dailyCollectionBreakdownData,
    isLoading: isDailyCollectionBreakdownLoading,
    isError: isDailyCollectionBreakdownError,
    error: dailyCollectionBreakdownError,
    refetch: refetchDailyCollectionBreakdown,
    isFetching: isDailyCollectionBreakdownFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "dailyCollectionBreakdown",
      primaryUserId,
      selectedDateParam,
    ],
    queryFn: fetchDashboardCompanyDailyCollectionBreakdown,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: monthlyCollectionBreakdownData,
    isLoading: isMonthlyCollectionBreakdownLoading,
    isError: isMonthlyCollectionBreakdownError,
    error: monthlyCollectionBreakdownError,
    refetch: refetchMonthlyCollectionBreakdown,
    isFetching: isMonthlyCollectionBreakdownFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "monthlyCollectionBreakdown",
      primaryUserId,
      selectedDateParam,
    ],
    queryFn: fetchDashboardCompanyMonthlyCollectionBreakdown,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: roomCountSummaryData,
    isLoading: isRoomCountSummaryLoading,
    isError: isRoomCountSummaryError,
    error: roomCountSummaryError,
    refetch: refetchRoomCountSummary,
    isFetching: isRoomCountSummaryFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "roomCountSummary",
      primaryUserId,
      selectedDateParam,
    ],
    queryFn: fetchDashboardRoomCountSummary,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const {
    data: propertySalesSummaryData,
    isLoading: isPropertySalesSummaryLoading,
    isError: isPropertySalesSummaryError,
    error: propertySalesSummaryError,
    refetch: refetchPropertySalesSummary,
    isFetching: isPropertySalesSummaryFetching,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      "propertySalesSummary",
      primaryUserId,
      selectedDateParam,
    ],
    queryFn: fetchDashboardPropertySalesSummary,
    enabled: !!cmp_id && !!primaryUserId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const isLoading =
    isTotalsLoading ||
    isRevenueBreakdownLoading ||
    isDailyCollectionBreakdownLoading ||
    isMonthlyCollectionBreakdownLoading ||
    isRoomCountSummaryLoading ||
    isPropertySalesSummaryLoading;
  const isError =
    isTotalsError ||
    isRevenueBreakdownError ||
    isDailyCollectionBreakdownError ||
    isMonthlyCollectionBreakdownError ||
    isRoomCountSummaryError ||
    isPropertySalesSummaryError;
  const error =
    totalsError ||
    revenueBreakdownError ||
    dailyCollectionBreakdownError ||
    monthlyCollectionBreakdownError ||
    roomCountSummaryError ||
    propertySalesSummaryError;
  const isFetching =
    isTotalsFetching ||
    isRevenueBreakdownFetching ||
    isDailyCollectionBreakdownFetching ||
    isMonthlyCollectionBreakdownFetching ||
    isRoomCountSummaryFetching ||
    isPropertySalesSummaryFetching;

  const refetch = () => {
    Promise.all([
      refetchTotals(),
      refetchRevenueBreakdown(),
      refetchDailyCollectionBreakdown(),
      refetchMonthlyCollectionBreakdown(),
      refetchRoomCountSummary(),
      refetchPropertySalesSummary(),
    ]);
  };

  console.log(propertySalesSummaryData);

  return (
    <div className="min-h-screen bg-gray-50">
      <div>
        <TitleDiv title="Summary Dashboard" />
      </div>

      <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-5 md:py-6 max-w-7xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6 bg-slate-100 px-4 py-4 sm:px-5 sm:py-5 rounded-xl">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-700 leading-tight truncate">
              Summary Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Selected date: {selectedDateLongLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-xl border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw
                size={14}
                className={isFetching ? "animate-spin" : ""}
              />
              {isFetching ? "Refreshing..." : "Refresh Dashboard"}
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 rounded-xl border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <CalendarIcon size={14} />
                  <span>{selectedDateLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <button className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-[#0f172a] text-sm text-white font-medium hover:bg-[#1e293b] active:bg-[#0a101e] transition">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hidden sm:inline">Export Report</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && <SummaryCardsSkeleton />}

        {/* Error */}
        {isError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load summary</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 mt-1">
              <span className="text-sm">
                {error?.message ?? "Something went wrong. Please try again."}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                disabled={isFetching}
                className="w-fit flex items-center gap-2"
              >
                <RefreshCw
                  size={13}
                  className={isFetching ? "animate-spin" : ""}
                />
                {isFetching ? "Retrying…" : "Retry"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Success */}
        {!isLoading && !isError && data && (
          <div className="space-y-6">
            <SummaryCards
              totalRevenue={fmt(data.totalRevenue)}
              totalTax={fmt(data.totalTax)}
              finalRevenue={fmt(
                Number(propertySalesSummaryData?.totalPropertySales) -
                  Number(data.totalTax),
              )}
              revenueBreakdown={revenueBreakdownData?.companyWiseRevenue ?? []}
              dailyCollection={fmt(data.dailyCollection)}
              dailyCollectionBreakdown={
                dailyCollectionBreakdownData?.companyWiseCollection ?? []
              }
              monthlyCollection={fmt(data.monthlyCollection)}
              monthlyCollectionBreakdown={
                monthlyCollectionBreakdownData?.companyWiseCollection ?? []
              }
              totalPropertySales={fmt(
                propertySalesSummaryData?.totalPropertySales,
              )}
              totalHotelSales={fmt(propertySalesSummaryData?.totalHotelSales)}
              totalHotelSalesTax={fmt(
                propertySalesSummaryData?.totalHotelSalesTax,
              )}
              grossSalesHotel={fmt(
                propertySalesSummaryData?.totalHotelSaleWithOutTax,
              )}
              totalRestaurantSales={fmt(
                propertySalesSummaryData?.totalRestaurantSales,
              )}
              totalRestaurantSalesTax={fmt(
                propertySalesSummaryData?.totalRestaurantTax,
              )}
              grossRestaurantSales={fmt(
                propertySalesSummaryData?.totalRestaurantSaleWithOutTax,
              )}
              propertySalesBreakdown={
                propertySalesSummaryData?.companyWisePropertySales ?? []
              }
              totalRooms={String(roomCountSummaryData?.totalRooms ?? 0)}
              totalAvailableRooms={String(
                roomCountSummaryData?.totalAvailableRooms ?? 0,
              )}
              totalBlockedRooms={String(
                roomCountSummaryData?.totalBlockedRooms ?? 0,
              )}
              roomCountBreakdown={
                roomCountSummaryData?.companyWiseRoomCount ?? []
              }
              dailyCash={fmt(data.cashCollection?.daily)}
              dailyBank={fmt(data.bankCollection?.daily)}
              monthlyCash={fmt(data.cashCollection?.monthly)}
              monthlyBank={fmt(data.bankCollection?.monthly)}
              selectedDateLabel={selectedDateLabel}
            />

            <RevenueTable
              rows={revenueBreakdownData?.companyWiseRevenue ?? []}
              selectedDateLabel={selectedDateLabel}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDashboard;
