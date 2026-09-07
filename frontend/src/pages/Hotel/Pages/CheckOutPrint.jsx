import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import api from "@/api/api";
import TitleDiv from "@/components/common/TitleDiv";
import "jspdf-autotable";
import {
  handlePrintInvoice,
  handleDownloadPDF,
} from "../PrintSide/generateHotelInvoicePDF ";
import { calculateStayDays, getRoomStayStartDate } from "../Helper/hotelHelper";

// ====== removed chunksForTwo helper ====== [attached_file:1]

export default function SattvaInvoice() {
  // Router and Redux state
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useSelector(
    (state) => state?.secSelectedOrganization?.secSelectedOrg
  );
  const secondaryUser = JSON.parse(localStorage.getItem("sUserData"));

  // Props from location state
  const selectedCheckOut = location.state?.selectedCheckOut || [];
  const selectedCustomerId = location.state?.customerId;
  const isForPreview = location.state?.isForPreview;

  // Component state (global only for popup and printing)
  const [showSplitPopUp, setShowSplitPopUp] = useState(false);
  const [selected, setSelected] = useState("default");
  const printReference = useRef(null);

  // Global fetch of KOT and outstanding for all provided checkouts (will be scoped per table)
  const [allOutStanding, setAllOutStanding] = useState([]);
  const [allKotData, setAllKotData] = useState([]);
  // ================= transform function (original) =================
  const transformCheckOutData = (list) => {
    let result = [];
    list.forEach((item) => {
      item.selectedRooms.forEach((room) => {
        const stayDays = calculateStayDays(
          item,
          room,
          item.arrivalDate,
          item.checkOutDate,
          item.stayDays,
        );
        if (stayDays <= 0) return;
        const fullDays = Math.floor(stayDays);
        const fractionalDay = stayDays - fullDays;

        const perDayAmount = room.baseAmountWithTax / stayDays;
        const baseAmount = room.baseAmount / stayDays;
        const taxAmount = room.taxAmount / stayDays;
        const foodPlanAmountWithTax = room.foodPlanAmountWithTax / stayDays;
        const foodPlanAmountWithOutTax =
          room.foodPlanAmountWithOutTax / stayDays;
        const additionalPaxDataWithTax =
          room.additionalPaxAmountWithTax / stayDays;
        const additionalPaxDataWithOutTax =
          room.additionalPaxAmountWithOutTax / stayDays;

        const startDate = new Date(
          getRoomStayStartDate(item, room, item.arrivalDate),
        );

        // Full days
        for (let i = 0; i < fullDays; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const formattedDate = d.toLocaleDateString("en-GB").replace(/\//g, "-");
          result.push({
            date: formattedDate,
            baseAmountWithTax: perDayAmount,
            baseAmount,
            taxAmount,
            voucherNumber: item.voucherNumber,
            roomName: room.roomName,
            hsn: room?.hsnDetails?.hsn,
            customerName: item.customerId?.partyName,
            foodPlanAmountWithTax,
            foodPlanAmountWithOutTax,
            additionalPaxDataWithTax,
            additionalPaxDataWithOutTax,
          });
        }

        // Fractional 50%
        if (fractionalDay > 0) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + fullDays);
          const formattedDate = d.toLocaleDateString("en-GB").replace(/\//g, "-");
          result.push({
            date: formattedDate,
            baseAmountWithTax: perDayAmount * 0.5,
            baseAmount: baseAmount * 0.5,
            taxAmount: taxAmount * 0.5,
            voucherNumber: item.voucherNumber,
            roomName: room.roomName,
            hsn: room?.hsnDetails?.hsn,
            customerName: item.customerId?.partyName,
            foodPlanAmountWithTax: foodPlanAmountWithTax * 0.5,
            foodPlanAmountWithOutTax: foodPlanAmountWithOutTax * 0.5,
            additionalPaxDataWithTax: additionalPaxDataWithTax * 0.5,
            additionalPaxDataWithOutTax: additionalPaxDataWithOutTax * 0.5,
          });
        }
      });
    });
    return result;
  };

  // ================= API fetch for all checkouts =================
  const fetchDebitData = async (data) => {
    try {
      const res = await api.post(
        `/api/sUsers/fetchOutStandingAndFoodData/${organization._id}`,
        { data: data, isForPreview: isForPreview },
        { withCredentials: true }
      );
      if (res.data.success) {
        setAllOutStanding(res.data.data || []);
        setAllKotData(res.data.kotData || []);
      }
    } catch (error) {
      toast.error(error.message);
      console.error("Error fetching debit data:", error);
    }
  };

  // ================= per-checkout scoped builders =================
  const scopeOutStanding = (checkoutItem) => {
    // Try to match by customer/checkIn/booking if present in payload
    const cid = checkoutItem?.customerId?._id || checkoutItem?.customerId?.id;
    const chkId = checkoutItem?.checkInId?._id || checkoutItem?.checkInId?.id;
    const bookingId = checkoutItem?.bookingId;
    return (allOutStanding || []).filter(
      (t) =>
        (cid && (t?.customerId === cid || t?.customer_id === cid)) ||
        (chkId && (t?.checkInId === chkId || t?.check_in_id === chkId)) ||
        (bookingId && t?.bookingId === bookingId)
    );
  };

  const scopeKot = (checkoutItem) => {
    const chkId = checkoutItem?.checkInId?._id || checkoutItem?.checkInId?.id;
    const bookingId = checkoutItem?.bookingId;
    return (allKotData || []).filter(
      (k) =>
        (chkId && (k?.checkInId === chkId || k?.check_in_id === chkId)) ||
        (bookingId && k?.bookingId === bookingId)
    );
  };

  const buildViewForSingleCheckout = (checkoutItem) => {
    // rows for this single checkout
    const rows = transformCheckOutData([checkoutItem]);

    const roomTariffTotal = rows.reduce(
      (t, r) => t + Number(r.baseAmount || 0),
      0
    );
    const taxAmount = rows.reduce((t, r) => t + Number(r.taxAmount || 0), 0);

    const planAmount = rows.reduce(
      (t, r) => t + Number(r.foodPlanAmountWithOutTax || 0),
      0
    );
    const taxAmountFoodPlan = rows.reduce(
      (t, r) =>
        t +
        Number((r.foodPlanAmountWithTax || 0) - (r.foodPlanAmountWithOutTax || 0)),
      0
    );

    const paxAmount = rows.reduce(
      (t, r) => t + Number(r.additionalPaxDataWithOutTax || 0),
      0
    );

    const totalAmountIncludeAllTax =
      roomTariffTotal + planAmount + paxAmount + taxAmount + taxAmountFoodPlan;

    const scopedOut = scopeOutStanding(checkoutItem);
    const advanceTotal =
      scopedOut.reduce(
        (t, tr) =>
          t +
          Number(
            tr?.bill_amount ??
              tr?.billamount ??
              tr?.amount ??
              0
          ),
        0
      ) || 0;

    const scopedKot = scopeKot(checkoutItem);
    const kotTotal =
      scopedKot.reduce((t, k) => t + Number(k?.finalAmount || 0), 0) || 0;

    const taxableAmount = roomTariffTotal + paxAmount;
    const taxRate = taxableAmount ? (taxAmount / taxableAmount) * 100 : 0;
    const taxRateFoodPlan = planAmount
      ? (taxAmountFoodPlan / planAmount) * 100
      : 0;

    const sumOfRestaurantAndRoom = totalAmountIncludeAllTax + kotTotal;
    const balanceAmount = totalAmountIncludeAllTax - advanceTotal;
    const balanceAmountToPay = sumOfRestaurantAndRoom - advanceTotal;

    return {
      checkoutItem,
      rows,
      scoped: {
        outStanding: scopedOut,
        kotData: scopedKot,
      },
      totals: {
        roomTariffTotal,
        advanceTotal,
        kotTotal,
        balanceAmount,
        totalTaxAmount: taxAmount + taxAmountFoodPlan, // single-side sum (CGST+SGST split later)
        balanceAmountToPay,
        taxData: taxAmount + taxAmountFoodPlan,
        totalAmountIncludeAllTax,
        sumOfRestaurantAndRoom,
        taxableAmount,
        taxRate,
        taxRateFoodPlan,
        taxAmount,
        taxAmountFoodPlan,
        planAmount,
        paxAmount,
      },
    };
  };

  // ================= effects =================
  useEffect(() => {
    if (selectedCheckOut?.length > 0) {
      fetchDebitData(selectedCheckOut);
    }
  }, [selectedCheckOut, isForPreview]);

  // ================= handlers =================
  const handleSplitPayment = () => setShowSplitPopUp(true);
  const handleChange = (value) => setSelected(value);
  const handleSplit = () => {
    setShowSplitPopUp(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // ====== map directly over all selectedCheckOut (no two-item cap) ======
  const views = (selectedCheckOut || []).map((co) =>
    buildViewForSingleCheckout(co)
  );

  // Combined balance for navigation or header if needed
  const combinedBalanceToPay = views.reduce(
    (s, v) => s + (v?.totals?.balanceAmountToPay || 0),
    0
  );

  // Print/download uses combined summary across all views
  // const handlePrint = (isPrint) => {
  //   const firstView = views[0];
  //   const invoiceData = {
  //     organization: {
  //       name: organization?.name || "",
  //       address: organization?.address || "",
  //       flat: organization?.flat || "",
  //       landmark: organization?.landmark || "",
  //       road: organization?.road || "",
  //       gstNum: organization?.gstNum || "",
  //       email: organization?.email || "",
  //       logo: organization?.logo || "",
  //       state: organization?.state || "",
  //       pin: organization?.pin || "",
  //       mobile: organization?.mobile || "",
  //       configurations: organization?.configurations || [],
  //     },
  //     // Use first checkout for header fields; tables are separate on print
  //     selectedCheckOutData: firstView?.checkoutItem || {},
  //     outStanding: [],
  //     kotData: [],
  //     dateWiseDisplayedData: [],
  //     totals: {
  //       roomTariffTotal: views.reduce((s, v) => s + (v.totals.roomTariffTotal || 0), 0),
  //       advanceTotal: views.reduce((s, v) => s + (v.totals.advanceTotal || 0), 0),
  //       kotTotal: views.reduce((s, v) => s + (v.totals.kotTotal || 0), 0),
  //       balanceAmount: views.reduce((s, v) => s + (v.totals.balanceAmount || 0), 0),
  //       totalTaxAmount: views.reduce((s, v) => s + (v.totals.totalTaxAmount || 0), 0),
  //       balanceAmountToPay: combinedBalanceToPay,
  //       taxData: views.reduce((s, v) => s + (v.totals.taxData || 0), 0),
  //       totalAmountIncludeAllTax: views.reduce(
  //         (s, v) => s + (v.totals.totalAmountIncludeAllTax || 0),
  //         0
  //       ),
  //       sumOfRestaurantAndRoom: views.reduce(
  //         (s, v) => s + (v.totals.sumOfRestaurantAndRoom || 0),
  //         0
  //       ),
  //       taxableAmount: views.reduce((s, v) => s + (v.totals.taxableAmount || 0), 0),
  //       taxRate: 0,
  //       taxRateFoodPlan: 0,
  //       taxAmount: views.reduce((s, v) => s + (v.totals.taxAmount || 0), 0),
  //       taxAmountFoodPlan: views.reduce(
  //         (s, v) => s + (v.totals.taxAmountFoodPlan || 0),
  //         0
  //       ),
  //       planAmount: views.reduce((s, v) => s + (v.totals.planAmount || 0), 0),
  //     },
  //     foodPlanAmount: views.reduce((s, v) => s + (v.totals.planAmount || 0), 0),
  //     additionalPaxAmount: views.reduce((s, v) => s + (v.totals.paxAmount || 0), 0),
  //     secondaryUser,
  //     voucherNumber: firstView?.checkoutItem?.voucherNumber || "",
  //     arrivalDate: firstView?.checkoutItem?.arrivalDate || "",
  //     arrivalTime: firstView?.checkoutItem?.arrivalTime || "",
  //     roomNumbers:
  //       firstView?.checkoutItem?.selectedRooms
  //         ?.map((room) => room.roomName)
  //         .join(", ") || "",
  //     roomType:
  //       firstView?.checkoutItem?.selectedRooms?.[0]?.roomType?.brand || "",
  //     tariff:
  //       firstView?.checkoutItem?.selectedRooms?.[0]?.priceLevelRate || "",
  //     agentName: firstView?.checkoutItem?.agentId?.name || "Walk-In Customer",
  //     foodPlan: firstView?.checkoutItem?.foodPlan?.[0]?.foodPlan || "",
  //   };

  //   if (!isPrint) {
  //     handleDownloadPDF(invoiceData);
  //   } else {
  //     handlePrintInvoice(invoiceData);
  //   }
  // };

  const handlePrint = (isPrint) => {
  const batchContext = {
    selectedCheckOutList: selectedCheckOut,
    organization,
    secondaryUser,
    allOutStanding,
    allKotData,
  };

  if (!isPrint) {
    handleDownloadPDF(batchContext);
  } else {
    handlePrintInvoice(batchContext);
  }
};


  return (
    <>
      <TitleDiv title="Check out print" dropdownContents={[]} />

      {showSplitPopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-80">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Select Option
            </h2>

            <div className="flex items-center mb-3">
              <input
                id="opt-default"
                type="radio"
                name="split-option"
                value="default"
                checked={selected === "default"}
                onChange={() => handleChange("default")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500"
              />
              <label
                htmlFor="opt-default"
                className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >
                Default Print
              </label>
            </div>

            <div className="flex items-center mb-3">
              <input
                id="opt-room"
                type="radio"
                name="split-option"
                value="room"
                checked={selected === "room"}
                onChange={() => handleChange("room")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500"
              />
              <label
                htmlFor="opt-room"
                className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >
                Room based
              </label>
            </div>

            <div className="flex items-center mb-5">
              <input
                id="opt-restaurant"
                type="radio"
                name="split-option"
                value="restaurant"
                checked={selected === "restaurant"}
                onChange={() => handleChange("restaurant")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500"
              />
              <label
                htmlFor="opt-restaurant"
                className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300"
              >
                Restaurant based
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSplitPopUp(false)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSplit}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                disabled={!selected}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50 p-4" ref={printReference}>
        <div className="max-w-4xl mx-auto space-y-8">
          {views.map((view, idx) => {
            const s = view.scoped;
            const t = view.totals;
            const selectedCheckOutData = view.checkoutItem;
            const dateWiseDisplayedData = view.rows;

            return (
              <div key={idx} className="bg-white border-2 border-black p-2 text-sm">
                {/* Header */}
                <div className="flex items-center justify-between border-black pb-4">
                  <div className="w-24 h-24 flex-shrink-0">
                    <img
                      src={organization?.logo}
                      alt="Sattva Logo"
                      className="object-contain h-full w-full"
                    />
                  </div>
                  <div className="text-right flex-1 ml-4">
                    <div className="text-xl font-bold mb-2 uppercase">
                      {organization?.name}
                    </div>
                    <div className="mb-2 uppercase">
                      {[organization?.flat, organization?.landmark]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    <div className="text-xs mb-1">
                      {organization?.road && `${organization.road}`}
                    </div>
                    <div className="text-xs mb-1">
                      {organization?.gstNum && `GSTIN: ${organization.gstNum}`}
                    </div>
                    <div className="text-xs mb-1">
                      {organization?.state && `State Name: ${organization.state}`}
                      {organization?.pin && `, Pin: ${organization.pin}`}
                    </div>
                    <div className="text-xs">
                      {organization?.email && `E-Mail: ${organization.email}`}
                    </div>
                  </div>
                </div>

                {/* Invoice Details Grid */}
                <div className="grid grid-cols-3 p-2 text-xs border border-black">
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-20 font-bold">GRC No:</span>
                      <span>{selectedCheckOutData?.voucherNumber}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Pax:</span>
                      <span>
                        {selectedCheckOutData?.selectedRooms?.reduce(
                          (acc, curr) => acc + Number(curr.pax || 0),
                          0
                        )}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Guest:</span>
                      <span className="capitalize">{selectedCheckOutData?.customerId?.partyName}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Agent:</span>
                      <span>
                        {selectedCheckOutData?.agentId?.name || "Walk-In Customer"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-20 font-bold">Bill No:</span>
                      <span>{selectedCheckOutData?.voucherNumber}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Arrival:</span>
                      <span>
                        {selectedCheckOutData?.arrivalDate} /{" "}
                        {selectedCheckOutData?.arrivalTime}
                      </span>
                    </div>
                    {selectedCheckOutData?.selectedRooms &&
                      selectedCheckOutData?.selectedRooms?.length == 1 && (
                        <div className="flex">
                          <span className="w-20 font-bold">Room No:</span>
                          <span>
                            {selectedCheckOutData?.selectedRooms[0]?.roomName}
                          </span>
                        </div>
                      )}

                    {selectedCheckOutData?.foodPlan &&
                      selectedCheckOutData?.foodPlan?.length > 0 && (
                        <div className="flex">
                          <span className="w-20 font-bold">Plan:</span>
                          <span>
                            {selectedCheckOutData?.foodPlan[0]?.foodPlan}
                          </span>
                        </div>
                      )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex">
                      <span className="w-20 font-bold">Bill Date:</span>
                      <span>{formatDate(new Date())}</span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Departure:</span>
                      <span>
                        {formatDate(new Date())} / {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    {selectedCheckOutData?.selectedRooms &&
                      selectedCheckOutData?.selectedRooms?.length > 0 && (
                        <div className="flex">
                          <span className="w-20 font-bold">Room Type:</span>
                          <span>
                            {
                              selectedCheckOutData?.selectedRooms?.[0]?.roomType
                                ?.brand
                            }
                          </span>
                        </div>
                      )}
                    {selectedCheckOutData?.selectedRooms &&
                      selectedCheckOutData?.selectedRooms?.length > 0 && (
                        <div className="flex">
                          <span className="w-20 font-bold">Thariff:</span>
                          <span>
                            {
                              selectedCheckOutData?.selectedRooms?.[0]
                                ?.priceLevelRate
                            }
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Main Transaction Table */}
                <div className="mb-3">
                  <table className="w-full border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-xs">
                        <th className="border border-black p-2 text-center font-bold">
                          DATE
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          VOUCHER
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          DESCRIPTION
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          HSN
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          DEBIT
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          CREDIT
                        </th>
                        <th className="border border-black p-2 text-center font-bold">
                          AMOUNT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Outstanding */}
                      {s.outStanding?.map((transaction, index) => (
                        <tr key={`outstanding-${index}`}>
                          <td className="border-r border-black p-1">
                            {formatDate(transaction?.bill_date)}
                          </td>
                          <td className="border-r border-black p-1">
                            {transaction?.bill_no}
                          </td>
                          <td className="border-r border-black p-1">Advance</td>
                          <td className="border-r border-black p-1"></td>
                          <td className="border-r border-black p-1 text-right"></td>
                          <td className="border-r border-black p-1 text-right">
                            {Number(
                              transaction?.bill_amount ??
                                transaction?.billamount ??
                                0
                            ).toFixed(2)}
                          </td>
                          <td className="border-r border-black p-1 text-right"></td>
                        </tr>
                      ))}

                      {/* Room rows */}
                      {dateWiseDisplayedData?.map((order, index) => (
                        <tr key={`room-${index}`}>
                          <td className="border-r border-black p-1">{order?.date}</td>
                          <td className="border-r border-black p-1">
                            {order?.voucherNumber}
                          </td>
                          <td className="border-r border-black p-1">
                            Room Tariff [{order?.roomName}]
                          </td>
                          <td className="border-r border-black p-1">{order?.hsn}</td>
                          <td className="border-r border-black p-1 text-right">
                            {order?.baseAmount?.toFixed(2)}
                          </td>
                          <td className="border-r border-black p-1 text-right"></td>
                          <td className="border-r border-black p-1 text-right"></td>
                        </tr>
                      ))}

                      {/* Room Tariff Summary */}
                      <tr className="bg-gray-100 ">
                        <td colSpan="3" className="text-right p-2 border-r border-black">
                          Room Tariff Assessable Value
                        </td>
                        <td className="p-2 border-l border-black text-right"></td>
                        <td className="p-1 border-l border-black text-right">
                          {t.roomTariffTotal.toFixed(2)}
                        </td>
                        <td className="p-2 border-l border-black text-right"></td>
                        <td className="p-2 border-l border-black text-right"></td>
                      </tr>

                      {/* Food Plan */}
                      {t.planAmount > 0 && (
                        <tr>
                          <td colSpan="3" className="text-right p-2 border-r border-black">
                            Food Plan Sales
                          </td>
                          <td className="p-2 border-l border-black text-right"></td>
                          <td className="p-2 text-right border-l border-black">
                            {t.planAmount.toFixed(2)}
                          </td>
                          <td className="p-2 border-l border-black text-right"></td>
                          <td className="p-2 border-l border-black text-right"></td>
                        </tr>
                      )}

                      {/* Additional Pax */}
                      {t.paxAmount > 0 && (
                        <tr>
                          <td colSpan="3" className="text-right p-2 border-r border-black">
                            Additional Pax Amount
                          </td>
                          <td className="p-2 border-l border-black text-right"></td>
                          <td className="p-2 text-right border-l border-black">
                            {t.paxAmount.toFixed(2)}
                          </td>
                          <td className="p-2 border-l border-black text-right"></td>
                          <td className="p-2 border-l border-black text-right"></td>
                        </tr>
                      )}

                      {/* Tax Entries (Room + Food combined, split CGST/SGST 50/50) */}
                      <tr>
                        <td colSpan="3" className="text-right p-2 border-r border-black">
                          CGST
                        </td>
                        <td className="p-2 border-l border-black text-right"></td>
                        <td className="p-2 text-right border-l border-black">
                          {(t?.taxData / 2).toFixed(2)}
                        </td>
                        <td className="p-2 border-l border-black text-right"></td>
                        <td className="p-2 border-l border-black text-right"></td>
                      </tr>
                      <tr>
                        <td
                          colSpan="3"
                          className="text-right p-2 border-r border-b border-black"
                        >
                          SGST
                        </td>
                        <td className="p-2 border-l border-b border-black text-right"></td>
                        <td className="border-b border-l border-black p-2 text-right">
                          {(t?.taxData / 2).toFixed(2)}
                        </td>
                        <td className="p-2 border-l border-b border-black text-right"></td>
                        <td className="p-2 border-l border-b border-black text-right"></td>
                      </tr>

                      {/* Balance Summary */}
                      <tr>
                        <td colSpan="2" className="text-right p-2">
                          <span>ROOM NO : </span>
                          {selectedCheckOutData?.selectedRooms
                            ?.map((room) => room.roomName)
                            .join(", ")}
                        </td>
                        <td colSpan="3" className="text-right p-2">
                          {t.totalAmountIncludeAllTax.toFixed(2)}
                        </td>
                        <td className="border-b text-right p-2">
                          {t.advanceTotal.toFixed(2)}
                        </td>
                        <td className="border-b text-right p-2">
                          {t.balanceAmount.toFixed(2)}
                        </td>
                      </tr>

                      {/* Restaurant Section */}
                      <tr className="bg-green-50 border-black">
                        <td colSpan="7" className="border-b-2 p-2 font-bold text-center">
                          RESTAURANT BILL DETAILS
                        </td>
                      </tr>

                      {s.kotData?.map((kot, index) => (
                        <tr key={`kot-${index}`}>
                          <td className="border-r border-black p-1">
                            {formatDate(kot?.createdAt)}
                          </td>
                          <td className="border-r border-black p-1">
                            {kot?.salesNumber}
                          </td>
                          <td className="border-r border-black p-1">POS [Restaurant]</td>
                          <td className="border-r border-black p-1"></td>
                          <td className="border-r border-black p-1 text-right">
                            {Number(kot?.finalAmount || 0).toFixed(2)}
                          </td>
                          <td className="border-r border-black p-1 text-right"></td>
                          <td className="border-r border-black p-1 text-right"></td>
                        </tr>
                      ))}

                      {/* Final Totals */}
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan="4" className="border border-black p-2">
                          Total
                        </td>
                        <td className="border border-black p-2 text-right">
                          {t.kotTotal.toFixed(2)}
                        </td>
                        <td className="border border-black p-2 text-right"></td>
                        <td className="border border-black p-2 text-right">
                          {t.sumOfRestaurantAndRoom.toFixed(2)}
                        </td>
                      </tr>

                      {isForPreview && (
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan="6" className="border border-black p-2">
                            Balance To Pay
                          </td>
                          <td className="border border-black p-2 text-right">
                            {t.balanceAmountToPay.toFixed(2)}
                          </td>
                        </tr>
                      )}

                      <tr className="bg-red-50">
                        <td
                          colSpan="6"
                          className="border border-black font-bold text-right p-2"
                        >
                          TOTAL INVOICE AMOUNT
                        </td>
                        <td className="border border-black p-2 text-right font-bold">
                          {t.sumOfRestaurantAndRoom.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Tax Breakdown Table */}
                  <div className="flex justify-end border-b border-l border-black">
                    <table className="w-1/2 border border-black text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-black p-1 text-center">
                            Taxable Amount
                          </th>
                          <th className="border border-black p-1 text-center">
                            CGST Rate
                          </th>
                          <th className="border border-black p-1 text-center">
                            CGST Amount
                          </th>
                          <th className="border border-black p-1 text-center">
                            SGST Rate
                          </th>
                          <th className="border border-black p-1 text-center">
                            SGST Amount
                          </th>
                          <th className="border border-black p-1 text-center">
                            Total Tax
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black p-1 text-right">
                            {t.taxableAmount.toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-center">
                            {(t.taxRate / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-right">
                            {(t.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-center">
                            {(t.taxRate / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-right">
                            {(t.taxAmount / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-right">
                            {t.taxAmount.toFixed(2)}
                          </td>
                        </tr>

                        {t?.planAmount > 0 && (
                          <tr>
                            <td className="border border-black p-1 text-right">
                              {t?.planAmount.toFixed(2)}
                            </td>
                            <td className="border border-black p-1 text-center">
                              {(t?.taxRateFoodPlan / 2).toFixed(2)}
                            </td>
                            <td className="border border-black p-1 text-right">
                              {(t?.taxAmountFoodPlan / 2).toFixed(2)}
                            </td>
                            <td className="border border-black p-1 text-center">
                              {(t?.taxRateFoodPlan / 2).toFixed(2)}
                            </td>
                            <td className="border border-black p-1 text-right">
                              {(t?.taxAmountFoodPlan / 2).toFixed(2)}
                            </td>
                            <td className="border border-black p-1 text-right">
                              {t?.taxAmountFoodPlan.toFixed(2)}
                            </td>
                          </tr>
                        )}

                        <tr className="bg-gray-100 font-bold">
                          <td className="border border-black p-1 text-right">
                            {(t.taxableAmount + t?.planAmount).toFixed(2)}
                          </td>
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1 text-right">
                            {(t.taxAmount / 2 + t?.taxAmountFoodPlan / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1"></td>
                          <td className="border border-black p-1 text-right">
                            {(t.taxAmount / 2 + t?.taxAmountFoodPlan / 2).toFixed(2)}
                          </td>
                          <td className="border border-black p-1 text-right">
                            {(t.taxAmount + t?.taxAmountFoodPlan).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <div className="flex">
                            <span className="w-32 font-bold">Settlement:</span>
                            <span>Cash</span>
                          </div>
                          <div className="flex">
                            <span className="w-32 font-bold">Prepared By:</span>
                            <span>{secondaryUser?.name}</span>
                          </div>
                          <div className="flex">
                            <span className="w-32 font-bold">Billed By:</span>
                            <span>Reception</span>
                          </div>
                          <div className="flex">
                            <span className="w-32 font-bold">Rooms:</span>
                            <span>
                              {selectedCheckOutData?.selectedRooms
                                ?.map((room) => room.roomName)
                                .join(", ")}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex">
                            <span className="w-32 font-bold">Total Rooms:</span>
                            <span>
                              {selectedCheckOutData?.selectedRooms?.length || 0}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="w-32 font-bold">Total Pax:</span>
                            <span>
                              {selectedCheckOutData?.selectedRooms?.reduce(
                                (acc, curr) => acc + Number(curr.pax || 0),
                                0
                              ) +
                                (selectedCheckOutData?.additionalPaxDetails?.length ||
                                  0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="p-4 mb-6">
                      <h4 className="font-bold mb-3 text-center border-b border-black">
                        Bank Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex">
                          <span className="w-32 font-bold">Bank Name:</span>
                          <span className="border-b border-dotted border-black flex-1 mx-2">
                            {organization?.configurations[0]?.bank?.acholder_name ||
                              ""}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-bold">A/C Number:</span>
                          <span className="border-b border-dotted border-black flex-1 mx-2">
                            {organization?.configurations[0]?.bank?.ac_no || ""}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-32 font-bold">Branch & IFSC:</span>
                          <span className="border-b border-dotted border-black flex-1 mx-2">
                            {organization?.configurations[0]?.bank?.branch || ""}{" "}
                            {organization?.configurations[0]?.bank?.branch && ","}
                            {organization?.configurations[0]?.bank?.ifsc || ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 mt-8">
                    <div className="text-center">
                      <div className="border-t border-black mt-16 pt-2">
                        Cashier Signature
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-black mt-16 pt-2 ">
                        Guest Signature
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Action Buttons - single shared bar */}
          <div className="no-print w-full flex justify-end">
            <div className="no-print flex flex-wrap gap-3 mb-4 p-4">
              <button
                onClick={() => handlePrint(false)}
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
              >
                📄 Download PDF
              </button>
              <button
                onClick={handleSplitPayment}
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
              >
                💳 Split Payment
              </button>
              {isForPreview && (
                <button
                  onClick={() =>
                    navigate("/sUsers/checkInList", {
                      state: {
                        selectedCheckOut,
                        selectedCustomer: null,
                        balanceToPay: combinedBalanceToPay,
                        kotData: allKotData,
                      },
                    })
                  }
                  className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
                >
                  ✅ Confirm
                </button>
              )}
              <button
                onClick={() => handlePrint(true)}
                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
              >
                🖨️ Print Invoice
              </button>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style jsx>{`
          @media screen {
            .print-header,
            .print-footer {
              position: static;
            }
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              margin: 0;
              background: white;
            }
            .min-h-screen {
              min-height: auto;
            }
            .bg-gray-50 {
              background: white;
            }
            .border-2 {
              border-width: 1px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
