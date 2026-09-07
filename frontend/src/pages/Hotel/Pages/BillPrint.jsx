import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  GridIcon,
  PrinterIcon,
  CreditCardIcon,
  ShareIcon,
  CheckCircleIcon,
  CheckCircle,
  DownloadIcon,
} from "lucide-react";
import api from "@/api/api";

import TitleDiv from "@/components/common/TitleDiv";

import "jspdf-autotable";
import {
  handleBillPrintInvoice,
  handleBillDownloadPDF,
  generateBillPDFAsBase64,
} from "../PrintSide/generateBillPrintPDF";
import { calculateStayDays } from "../Helper/hotelHelper";
import Swal from "sweetalert2";
import { constructNow } from "date-fns";
const HotelBillPrint = () => {
  // Router and Redux state
  const location = useLocation();
  const organization = useSelector(
    (state) => state?.secSelectedOrganization?.secSelectedOrg,
  );

  const paymentDetails = useSelector((state) => state.paymentSlice);
  const navigate = useNavigate();
  const [paymentModeDetails, setPaymentModeDetails] = useState([]);

  const [showPageSelectModal, setShowPageSelectModal] = useState(false);
  const [rowPageAssignments, setRowPageAssignments] = useState({}); // { "billIdx-chargeIdx": pageNumber }
  const [pageSelectBillIdx, setPageSelectBillIdx] = useState(0); // which bill to show

  // Props from location state
  const selectedCheckOut = location.state?.selectedCheckOut || [];
  console.log(selectedCheckOut[0]);
  console.log(paymentDetails);

  const checkoutmode = location?.state?.checkoutMode || null;
  const cheinids = location?.state?.checkinIds;

  // const selectedCustomerId = location.state?.customerId;
  const isForPreview = location.state?.isForPreview;
  console.log("isForPreview", isForPreview);

  // Component state (global for fetch results used across docs)
  const [outStanding, setOutStanding] = useState([]);
  const [kotData, setKotData] = useState([]);
  const [showSplitPopUp, setShowSplitPopUp] = useState(false);
  const [selected, setSelected] = useState("default");
  const [activeMode, setActiveMode] = useState("default"); // tracks the applied split mode
  const printReference = useRef(null);

  useEffect(() => {
    const splitDetails =
      paymentDetails?.paymentDetails?.splitDetails ||
      location?.state?.splitDetailsAfterSave;
    console.log(splitDetails);
    if (paymentDetails?.paymentDetails?.paymentMode === "credit") {
      console.log("hai");
      setPaymentModeDetails([
        {
          customerName:
            paymentDetails?.paymentDetails?.selectedCreditor?.partyName,
          mode: "Credit",
          amount: paymentDetails?.paymentDetails?.cashAmount,
        },
      ]);
      return;
    }
    let restaurantAmount =
      paymentDetails?.paymentDetails?.selectedDataForPayment
        ?.restaurantSubTotal || 0;
    if (
      paymentDetails?.paymentDetails?.paymentMode === "single" &&
      Number(restaurantAmount) > 0
    ) {
      let split = [];

      split.push({
        customerName: splitDetails[0].customerName,
        mode: splitDetails[0].subsource || splitDetails[0].source,
        amount: Number(splitDetails[0]?.amount) - Number(restaurantAmount),
        under: "room",
      });
      split.push({
        customerName: splitDetails[0].customerName,
        mode: splitDetails[0].subsource || splitDetails[0].source,
        amount: Number(restaurantAmount),
        under: "food",
      });
      setPaymentModeDetails(split);
      return;
    }

    if (!splitDetails || !splitDetails.length) {
      setPaymentModeDetails([]);
      return;
    }

    console.log(splitDetails);

    const mergedMap = splitDetails?.map((item) => ({
      customerName: item.customerName,
      mode: item.subsource || item.source,
      amount: Number(item.amount),
      under: item.underCategory,
    }));

    console.log(mergedMap);
    console.log(mergedMap);
    console.log(splitDetails);
    setPaymentModeDetails(Object.values(mergedMap));
  }, [paymentDetails]);

  console.log(paymentModeDetails);

  // Fetch debit and KOT once for all docs shown
  const fetchDebitData = async (data) => {
    console.log(data[0]?.restaurantPaymentSplittingData);
    try {
      const res = await api.post(
        `/api/sUsers/fetchOutStandingAndFoodData/${organization._id}`,
        { data },
        { withCredentials: true },
      );
      if (res.data.success) {
        console.log("res.data.data", res.data.kotData);
        setOutStanding(res.data.data || []);
        setKotData(res.data.kotData || []);
      }
    } catch (error) {
      toast.error(error.message);
      console.error("Error fetching debit data:", error);
    }
  };

  useEffect(() => {
    if (selectedCheckOut?.length > 0) {
      console.log(isForPreview);
      if (!isForPreview) {
        const rawData =
          selectedCheckOut[0].restaurantPaymentSplittingData || [];
        // ✅ Convert to normal array
        let cleanData = rawData.map((item) =>
          item?.toObject ? item.toObject() : item._doc ? item._doc : item,
        );
        if (!cleanData.length && location?.state?.splitDetailsAfterSave) {
          console.log("ha");
          cleanData = location?.state?.splitDetailsAfterSave;
        }

        let mapData = [...cleanData];
        console.log(mapData);
        let splitArray = [];
        mapData?.forEach((item) => {
          splitArray.push({
            customerName: item.customerName || selectedCheckOut[0].customerName,
            mode: item.mode || item.subsource || item.type,
            amount: Number(item.amount),
            under: item.underCategory,
          });
        });
        const merged = Object.values(
          splitArray.reduce((acc, item) => {
            const key = `${item.customerName}-${item.mode}-${item.under}`;

            if (!acc[key]) {
              acc[key] = { ...item };
            } else {
              acc[key].amount += Number(item.amount);
            }

            return acc;
          }, {}),
        );

        console.log(merged);
        setPaymentModeDetails(merged);
      }
      console.log("hh");
      fetchDebitData(selectedCheckOut);
    }
  }, [selectedCheckOut]);

  // Split handlers
  const handleSplitPayment = () => setShowSplitPopUp(true);

  const handleSplit = () => {
    setShowSplitPopUp(false);
    setActiveMode(selected); // apply the selected mode without destroying data
  };

  // Utils
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Per-doc transforms
  // Per-doc transforms
  // Replace your transformDocToDateWiseLines function with this complete version:

  const transformDocToDateWiseLines = (doc) => {
    const result = [];

    (doc.selectedRooms || [])?.forEach((room) => {
      let roomStartDate = new Date(room.arrivalDate || doc.arrivalDate);

      const stayDays = doc.stayDays || 1;
      const fullDays = Math.floor(stayDays);
      const fractionalDay = stayDays - fullDays;

      const perDayAmount =
        Number(room.priceLevelRate || 0) ||
        Number(room.baseAmountWithTax || 0) / stayDays;

      const dayWisePrices = {};
      const dayWiseTax = {};

      const dateTariffs = room.dateTariffs || {};
      let activePrice = room?.priceLevelRate;
      console.log(room?.additionalPaxAmountWithTax);
      activePrice = doc?.addPaxWithRate
        ? room?.priceLevelRate -
          room?.additionalPaxAmountWithTax / room.stayDays
        : room?.priceLevelRate;
      console.log(stayDays);
      // Build per-day prices/taxes keyed by ISO date (YYYY-MM-DD)
      for (let i = 0; i < stayDays; i++) {
        console.log(roomStartDate);
        const d = new Date(roomStartDate);
        d.setDate(roomStartDate.getDate() + i);
        const key = d.toISOString().split("T")[0];
        if (dateTariffs[key] !== undefined) {
          activePrice = Number(dateTariffs[key]);
        }

        console.log(dayWisePrices, roomStartDate);

        dayWisePrices[key] = doc.addTaxWithRate
          ? Number(activePrice || 0) /
            (1 + Number(room?.taxPercentage || 0) / 100)
          : Number(activePrice || 0);

        dayWiseTax[key] = doc.addTaxWithRate
          ? Number(activePrice || 0) - dayWisePrices[key]
          : (Number(activePrice || 0) * Number(room?.taxPercentage || 0)) / 100;
      }

      const foodPlanTaxableAmount =
        Number(room.foodPlanAmountWithTax || 0) /
        (1 + Number(room.foodPlanTaxRate || 0) / 100);

      const foodPlanAmountWithTaxPerDay =
        Number(room.foodPlanAmountWithTax || 0) / stayDays;

      const foodPlanAmountWithOutTaxPerDay = (
        Number(foodPlanTaxableAmount || 0) / stayDays
      ).toFixed(2);

      console.log(foodPlanTaxableAmount - foodPlanAmountWithOutTaxPerDay);

      const foodPlanTax =
        foodPlanAmountWithTaxPerDay - foodPlanAmountWithOutTaxPerDay;
      console.log(foodPlanTax);
      console.log(foodPlanAmountWithOutTaxPerDay, foodPlanAmountWithTaxPerDay);
      // Additional pax, spread only across full days
      const totalAdditionalPaxWithTax = Number(
        room.additionalPaxAmountWithTax || 0,
      );
      const totalAdditionalPaxWithOutTax = Number(
        room.additionalPaxAmountWithOutTax || 0,
      );

      const additionalPaxDataWithTaxPerDay =
        fullDays > 0 ? totalAdditionalPaxWithTax / fullDays : 0;
      const additionalPaxDataWithOutTaxPerDay =
        fullDays > 0 ? totalAdditionalPaxWithOutTax / fullDays : 0;

      // Swapping logic: adjust full days count
      let fullDaysAre = fullDays;

      const normalizeToDate = (d) => {
        const nd = new Date(d);
        nd.setUTCHours(0, 0, 0, 0);
        return nd;
      };

      const swapDate = room?.swappingDateFrom
        ? new Date(room.swappingDateFrom).toISOString().split("T")[0]
        : "";
      console.log(swapDate);
      if (room.isSwapped && room.swappingDateFrom) {
        console.log(room.roomName);
        let swappingDate = normalizeToDate(room.swappingDateFrom);
        let arrivalDate = normalizeToDate(doc.arrivalDate);
        const currentSelectedRoomId = String(room?._id || "");
        const currentRoomId = String(room?.roomId?._id || room?.roomId || "");

        let swappedRoomObject = doc?.roomSwapHistory?.find(
          (r) =>
            r?.fromSelectedRoomId && currentSelectedRoomId
              ? String(r.fromSelectedRoomId) === currentSelectedRoomId
              : String(r?.fromRoomId?._id || r?.fromRoomId || "") === currentRoomId,
        );
        console.log(swappedRoomObject);
        if (swappedRoomObject?.toRoomId) {
          let swappedRoomData = doc?.selectedRooms.find(
            (r) =>
              swappedRoomObject?.toSelectedRoomId
                ? String(r?._id || "") === String(swappedRoomObject.toSelectedRoomId)
                : String(r?.roomId?._id || r?.roomId || "") ===
                  String(swappedRoomObject?.toRoomId?._id || swappedRoomObject?.toRoomId || "")
          );
          let isRoomSwappedData = doc?.roomSwapHistory?.find(
            (r) =>
              r?.toSelectedRoomId && currentSelectedRoomId
                ? String(r.toSelectedRoomId) === currentSelectedRoomId
                : String(r?.toRoomId?._id || r?.toRoomId || "") === currentRoomId
          )
      
          if (swappedRoomData?.isSwapped === false  && isRoomSwappedData) {
            arrivalDate = normalizeToDate(swappedRoomData.swappingDateFrom);
            arrivalDate.setDate(arrivalDate.getDate() - 1);
            roomStartDate = arrivalDate;
          }else{
            console.log(room)
            arrivalDate = normalizeToDate(doc.arrivalDate);
            roomStartDate = arrivalDate;
            swappingDate =  normalizeToDate(room.swappingDateFrom);
          }

        }

        fullDaysAre = Math.floor(
          (swappingDate - arrivalDate) / (1000 * 60 * 60 * 24),
        );

        if (fullDaysAre <= 0) {
          if (swapDate == doc.arrivalDate) {
            fullDaysAre = 0;
          } else {
            fullDaysAre = 1;
          }
        }
      }

      if (!room.isSwapped && room.swappingDateFrom) {
        console.log(room.roomName);
        const swappingDate = normalizeToDate(room.swappingDateFrom);
        const checkoutDate = normalizeToDate(doc.checkOutDate);

        fullDaysAre = Math.floor(
          (checkoutDate - swappingDate) / (1000 * 60 * 60 * 24),
        );

        console.log(fullDaysAre);

        if (fullDaysAre <= 0) {
          if (swapDate == doc.arrivalDate) {
            fullDaysAre = 1;
          } else {
            fullDaysAre = 0;
          }
        }
      }

      // Add full days (respect swap base date, read tariff via ISO key)
      for (let i = 0; i < fullDaysAre; i++) {
        const baseDate =
          room.swappingDateFrom && !room.isSwapped
            ? new Date(room.swappingDateFrom)
            : new Date(roomStartDate);
        const incrementNumber = i;
        // room.swappingDateFrom && !room.isSwapped
        //   ? i
        //   :i

        const currentDate = new Date(baseDate);
        currentDate.setDate(currentDate.getDate() + incrementNumber);

        const isoKey = currentDate.toISOString().split("T")[0];
        console.log(isoKey);
        const formattedDate = currentDate
          .toLocaleDateString("en-GB")
          .replace(/\//g, "-");
        const subArray = room?.otherChargeDetails.filter(
          (item) => item.action === "sub",
        );
        const addArray = room?.otherChargeDetails.filter(
          (item) => item.action === "add",
        );
        console.log(dayWisePrices[isoKey]);
        result.push({
          date: formattedDate,
          description: `Room Rent - Room ${room.roomName}`,
          docNo: doc.voucherNumber,
          amount: Number(dayWisePrices[isoKey]?.toFixed(2) || 0),
          baseAmountWithTax: perDayAmount,
          baseAmount: Number(dayWisePrices[isoKey]?.toFixed(2) || 0),
          taxAmount: Number(dayWiseTax[isoKey]?.toFixed(2) || 0),
          dayWisePrices,
          voucherNumber: doc.voucherNumber,
          roomName: room.roomName,
          hsn: room?.hsnDetails?.hsn,
          customerName: doc.customerId?.partyName,
          foodPlanAmountWithTax: foodPlanAmountWithTaxPerDay,
          foodPlanAmountWithOutTax: foodPlanAmountWithOutTaxPerDay,
          foodPlanTax: foodPlanTax,
          additionalPaxDataWithTax: additionalPaxDataWithTaxPerDay,
          additionalPaxDataWithOutTax: additionalPaxDataWithOutTaxPerDay,
          roomId: room?.roomId || room?._id,
          roomArrivalDate: formattedDate,
          isFullDay: true,
          addTaxWithRate: doc.addTaxWithRate,
          subArray,
          addArray,
        });
      }
      console.log(result);
      // Add fractional day (half day) – no additional pax
      if (fractionalDay > 0) {
        const baseDate =
          room.swappingDateFrom && !room.isSwapped
            ? new Date(room.swappingDateFrom)
            : new Date(roomStartDate);

        const fractionalDate = new Date(baseDate);
        fractionalDate.setDate(fractionalDate.getDate() + fullDaysAre);

        const isoKey = fractionalDate.toISOString().split("T")[0];
        const formattedFractionalDate = fractionalDate
          .toLocaleDateString("en-GB")
          .replace(/\//g, "-");

        result.push({
          date: formattedFractionalDate,
          description: `Room Rent - Room ${room.roomName} (Half Day)`,
          docNo: doc.voucherNumber,
          amount: Number(dayWisePrices[isoKey] || 0) * 0.5,
          baseAmountWithTax: perDayAmount * 0.5,
          baseAmount: Number(dayWisePrices[isoKey] || 0) * 0.5,
          taxAmount: Number(dayWiseTax[isoKey] || 0) * 0.5,
          voucherNumber: doc.voucherNumber,
          roomName: room.roomName,
          hsn: room?.hsnDetails?.hsn,
          customerName: doc.customerId?.partyName,
          foodPlanAmountWithTax: foodPlanAmountWithTaxPerDay * 0.5,
          foodPlanAmountWithOutTax: foodPlanAmountWithOutTaxPerDay * 0.5,
          foodPlanTax: foodPlanTax,
          additionalPaxDataWithTax: 0,
          additionalPaxDataWithOutTax: 0,
          roomId: room?.roomId || room?._id,
          isFullDay: false,
          checkoutDate: formattedFractionalDate,
        });
      }
    });

    return result;
  };

  const buildPerRoomRestaurantLinesForDoc = (doc) => {
    console.log("buildPerRoomRestaurantLinesForDoc", doc);
    const lines = [];

    // safer check-in number for current checkout doc
    const currentCheckInNumber =
      doc?.checkInId?.voucherNumber ||
      doc?.checkInNumber ||
      doc?.voucherNumber ||
      "";

    // all room ids of this checkout
    const roomIdSet = new Set(
      (doc.selectedRooms || [])
        .map((r) => String(r?.roomId || r?._id || r?.id))
        .filter(Boolean),
    );

    // keep only KOTs that belong to THIS checkout/check-in
    const currentDocKots = (kotData || []).filter((kot) => {
      const convertedFrom = kot?.convertedFrom || [];

      const belongsToThisCheckIn = convertedFrom.some(
        (cf) =>
          String(cf?.checkInNumber || "") === String(currentCheckInNumber),
      );

      return belongsToThisCheckIn;
    });

    const roomServiceTotals = {};
    const dineInTotals = {};
    console.log("currentDocKots", currentDocKots);

    currentDocKots.forEach((kot) => {
      const kotRoomId = String(kot?.kotDetails?.roomId || kot?.roomId || "");
      const tableNo =
        kot?.kotDetails?.tableNumber ||
        kot?.tableNumber ||
        kot?.customer?.tableNumber ||
        "";

      const type = String(kot?.type || "").toLowerCase();

      const amount = Number(
        kot?.finalAmount ?? kot?.subTotal ?? kot?.total ?? 0,
      );

      const salesNo = kot?.salesNumber || "-";

      const kotDateValue = kot?.date || kot?.createdAt || new Date();
      const d = new Date(kotDateValue);
      const formattedDate = `${String(d.getDate()).padStart(2, "0")}-${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}-${d.getFullYear()}`;

      // ROOM SERVICE:
      // has roomId matched with this checkout rooms AND no table number
      if (kotRoomId && roomIdSet.has(kotRoomId) && !tableNo) {
        if (!roomServiceTotals[kotRoomId]) {
          roomServiceTotals[kotRoomId] = {
            amount: 0,
            docNos: [],
            date: formattedDate,
          };
        }

        roomServiceTotals[kotRoomId].amount += amount;
        if (salesNo !== "-") roomServiceTotals[kotRoomId].docNos.push(salesNo);
        return;
      }

      // DINE IN / TAKEAWAY / DELIVERY:
      // only one common restaurant section for this doc
      const dineKey = tableNo || "Restaurant";

      if (!dineInTotals[dineKey]) {
        dineInTotals[dineKey] = {
          amount: 0,
          docNos: [],
          date: formattedDate,
        };
      }

      dineInTotals[dineKey].amount += amount;
      if (salesNo !== "-") dineInTotals[dineKey].docNos.push(salesNo);
    });

    // room service lines
    Object.keys(roomServiceTotals).forEach((roomId) => {
      const roomName =
        (doc.selectedRooms || []).find(
          (r) => String(r?.roomId || r?._id || r?.id) === roomId,
        )?.roomName || "Unknown Room";

      lines.push({
        date: roomServiceTotals[roomId].date,
        description: `Room Service - ${roomName}`,
        docNo: [...new Set(roomServiceTotals[roomId].docNos)].join(", ") || "-",
        amount: Number(roomServiceTotals[roomId].amount || 0),
        taxes: 0,
        advance: "",
        roomName,
        roomId,
        type: "roomService",
      });
    });

    // dine-in lines
    Object.keys(dineInTotals).forEach((tableNo) => {
      lines.push({
        date: dineInTotals[tableNo].date,
        description: `Restaurant Dine In - ${tableNo}`,
        docNo: [...new Set(dineInTotals[tableNo].docNos)].join(", ") || "-",
        amount: Number(dineInTotals[tableNo].amount || 0),
        taxes: 0,
        advance: "",
        roomName: "",
        roomId: "",
        type: "dineIn",
      });
    });

    return lines;
  };

  // Helpers to decide where to show advances
  const docOwnsAdvances = (doc) => {
    const originalId = doc?.originalCustomerId;
    const custId = doc?.customerId?._id || doc?.customerId;
    if (!custId) return false;
    // If originalId exists, match it; if not provided, treat as original/primary and allow
    return originalId ? String(originalId) === String(custId) : true;
  };

  const findFirstPrimaryIdx = (docs) => {
    const idx = (docs || []).findIndex((d) => docOwnsAdvances(d));
    return idx >= 0 ? idx : 0;
  };

  // Build bill payload per doc; gate advances via useAdvances
  const prepareBillDataForDoc = (doc, useAdvances) => {
    console.log(doc);
    // Lines from room stay
    const dateWiseLines = transformDocToDateWiseLines(doc);
    console.log(dateWiseLines);
    // Totals for room parts
    const planAmount = dateWiseLines.reduce(
      (t, i) => t + Number(i.foodPlanAmountWithOutTax || 0),
      0,
    );
    console.log(planAmount);
    const foodPlanTax = (
      dateWiseLines.reduce((t, i) => t + Number(i.foodPlanTax || 0), 0) / 2
    ).toFixed(2);

    console.log(foodPlanTax);

    const foodPlanAmountWithTax = dateWiseLines
      .reduce(
        (t, i) =>
          t +
          (Number(i.foodPlanAmountWithTax || 0) -
            Number(i.foodPlanAmountWithOutTax || 0)),
        0,
      )
      .toFixed(2);
    console.log(foodPlanAmountWithTax);
    console.log(planAmount);
    console.log(dateWiseLines);

    let roomTariffTotal = !doc?.addFoodPlanWithRate
      ? dateWiseLines.reduce((t, i) => t + Number(i.baseAmount || 0), 0)
      : dateWiseLines.reduce((t, i) => t + Number(i.baseAmount || 0), 0) -
        planAmount;

    //   const arrivalDate = normalizeDate(doc?.arrivalDate);
    //   const checkoutDate = normalizeDate(doc?.checkOutDate);

    //   if (!room?.swappingDateFrom) {
    //     return Math.max(Number(room?.stayDays || 0), 0);
    //   }

    //   const swappingDate = normalizeDate(room.swappingDateFrom);

    //   // Old room before swap
    //   if (room?.isSwapped) {
    //     return Math.max(
    //       Math.floor((swappingDate - arrivalDate) / (1000 * 60 * 60 * 24)),
    //       0,
    //     );
    //   }

    //   // New room after swap
    //   return Math.max(
    //     Math.floor((checkoutDate - swappingDate) / (1000 * 60 * 60 * 24)),
    //     0,
    //   );
    // };

    const additionalPaxAmount = (doc.selectedRooms || []).reduce(
      (total, room) => {
        const originalStayDays = Math.max(Number(room?.stayDays || 0), 0);
        const effectiveStayDays = calculateStayDays(
          doc,
          room,
          doc?.arrivalDate,
          doc?.checkOutDate,
          originalStayDays,
        );

        console.log(effectiveStayDays,room.roomName);

        const totalPaxWithoutTax = Number(
          room?.additionalPaxAmountWithOutTax || 0,
        );

        const paxPerDay =
          originalStayDays > 0 ? totalPaxWithoutTax / originalStayDays : 0;

        return total + paxPerDay * effectiveStayDays;
      },
      0,
    );
    console.log(dateWiseLines);
    console.log(roomTariffTotal);
    console.log(additionalPaxAmount);
    const roomTaxTotal = dateWiseLines.reduce(
      (t, i) => t + Number(i.taxAmount || 0),
      0,
    );
    roomTariffTotal = roomTariffTotal.toFixed(2);

    const additionalPaxTax = dateWiseLines.reduce(
      (t, i) =>
        t +
        Number(i.additionalPaxDataWithTax || 0) -
        Number(i.additionalPaxDataWithOutTax || 0),
      0,
    );
    console.log(roomTariffTotal);

    const sgstAmount = ((roomTaxTotal + additionalPaxTax) / 2).toFixed(2);
    const cgstAmount = ((roomTaxTotal + additionalPaxTax) / 2).toFixed(2);

    // Per-room restaurant lines (for this doc's rooms)
    const perRoomRestaurantLines = buildPerRoomRestaurantLinesForDoc(doc);
    const roomServiceTotal = perRoomRestaurantLines
      .filter((l) => l.type === "roomService")
      .reduce((t, l) => t + Number(l.amount || 0), 0);

    const dineInTotal = perRoomRestaurantLines
      .filter((l) => l.type === "dineIn")
      .reduce((t, l) => t + Number(l.amount || 0), 0);

    const newlyAppliedDiscount =
      paymentDetails?.paymentDetails?.restaurantSideDiscountAdjustmentArray
        ?.length > 0 &&
      paymentDetails?.paymentDetails?.restaurantSideDiscountAdjustmentArray?.reduce(
        (acc, curr) => acc + Number(curr.finalValue || 0),
        0,
      );
    console.log(newlyAppliedDiscount);

    const restaurantTotal =
      roomServiceTotal + dineInTotal - newlyAppliedDiscount;

    console.log("Room Service Total:", roomServiceTotal);
    console.log("Dine In Total:", dineInTotal);
    console.log("Restaurant Total:", restaurantTotal);
    console.log(perRoomRestaurantLines);
    console.log(perRoomRestaurantLines);

    const groupedRoomCharges = (() => {
      const charges = [];
      const groups = {};

      // Group charges by room
      dateWiseLines?.forEach((i) => {
        const k = i.roomName;
        if (!groups[k]) groups[k] = [];
        groups[k].push(i);
      });

      // Get array of room names to track first room
      const roomNames = Object.keys(groups);

      // Process each room's charges in order
      roomNames?.forEach((roomName, roomIndex) => {
        const roomDays = groups[roomName];

        // Get the original room data for this room
        const originalRoom = doc.selectedRooms?.find(
          (r) => r.roomName === roomName,
        );

        // Get tax percentages
        const roomTaxPercentage = originalRoom?.taxPercentage || 0;
        const halfRoomTaxPercentage = roomTaxPercentage / 2;

        // Get THIS specific room's arrival date
        const roomArrivalDate =
          roomDays[0]?.date || formatDate(doc.arrivalDate);

        // Separate full days and half days
        const fullDayCharges = roomDays.filter(
          (item) =>
            !item.description?.includes("Half Day") &&
            !item.description?.includes("Half Tariff"),
        );
        const halfDayCharges = roomDays.filter(
          (item) =>
            item.description?.includes("Half Day") ||
            item.description?.includes("Half Tariff"),
        );
        console.log(doc?.addFoodPlanWithRate);
        console.log(foodPlanAmountWithTax);

        // 1. Add FULL DAY room rent charges
        fullDayCharges?.forEach((item) => {
          charges.push({
            date: item.date,
            description: `Room Rent :${item.roomName}`,
            docNo: item.docNo || "-",
            amount: (
              item.baseAmount +
              Number(doc?.addFoodPlanWithRate ? 0 : item.foodPlanAmountWithTax)
            ).toFixed(2),
            taxes: (item.taxAmount || 0).toFixed(2),
            advance: "",
            roomName: item.roomName,
          });
        });
        console.log(fullDayCharges[0].addArray);

        // 2. Add CGST and SGST for FULL DAYS (if any)
        if (fullDayCharges.length > 0) {
          const fullDayTotalTax = fullDayCharges.reduce(
            (sum, i) => sum + (i.taxAmount || 0),
            0,
          );

          if (fullDayTotalTax > 0) {
            const fullDayCGST = fullDayTotalTax / 2;
            const fullDaySGST = fullDayTotalTax / 2;

            charges.push({
              // date: roomArrivalDate, // Use arrival date for full day taxes
              description: `CGST  @ ${halfRoomTaxPercentage}%`,
              docNo: "-",
              amount: 0,
              taxes: fullDayCGST.toFixed(2),
              advance: "",
              roomName,
            });

            charges.push({
              // date: roomArrivalDate, // Use arrival date for full day taxes
              description: `SGST  @ ${halfRoomTaxPercentage}%`,
              docNo: "-",
              amount: 0,
              taxes: fullDaySGST.toFixed(2),
              advance: "",
              roomName,
            });
          }
        }

        if (fullDayCharges[0].subArray.length > 0) {
          fullDayCharges[0].subArray.map((item, index) => {
            charges.push({
              // date: roomArrivalDate, // Use arrival date for full day taxes
              description: `Room Discount ${item?.option} @ ${item?.taxPercentage}%`,
              docNo: "-",
              amount: -item.finalValue.toFixed(2),
              taxes: item?.taxAmt.toFixed(2),
              advance: "",
              roomName,
            });
          });
        }

        if (fullDayCharges[0].addArray.length > 0) {
          fullDayCharges[0].addArray.map((item, index) => {
            charges.push({
              // date: roomArrivalDate, // Use arrival date for full day taxes
              description: `Other Charge ${item?.option} @ ${item?.taxPercentage}%`,
              docNo: "-",
              amount: item.finalValue.toFixed(2),
              taxes: item?.taxAmt.toFixed(2),
              advance: "",
              roomName,
            });
          });
        }

        // 3. Add HALF DAY room rent charges with CHECKOUT DATE
        halfDayCharges?.forEach((item) => {
          charges.push({
            date: item.date, // ✅ Use the actual half day date (checkout date)
            description: `Half Tariff :${item.roomName}`,
            docNo: item.docNo || "-",
            amount: (
              item.baseAmount +
              (doc?.addFoodPlanWithRate ? 0 : item.foodPlanAmountWithTax)
            ).toFixed(2),
            taxes: (item.taxAmount || 0).toFixed(2),
            advance: "",
            roomName: item.roomName,
          });
        });

        // 4. Add CGST and SGST for HALF DAYS with CHECKOUT DATE (if any)
        if (halfDayCharges.length > 0) {
          const halfDayTotalTax = halfDayCharges.reduce(
            (sum, i) => sum + (i.taxAmount || 0),
            0,
          );

          if (halfDayTotalTax > 0) {
            const halfDayCGST = halfDayTotalTax / 2;
            const halfDaySGST = halfDayTotalTax / 2;

            charges.push({
              // date: halfDayDate, // ✅ Use checkout date for half tariff taxes
              description: `CGST on Half Tariff@${halfRoomTaxPercentage}%`,
              docNo: "-",
              amount: 0,
              taxes: halfDayCGST.toFixed(2),
              advance: "",
              roomName,
            });

            charges.push({
              // date: halfDayDate, // ✅ Use checkout date for half tariff taxes
              description: `SGST on Half Tariff@${halfRoomTaxPercentage}%`,
              docNo: "-",
              amount: 0,
              taxes: halfDaySGST.toFixed(2),
              advance: "",
              roomName,
            });
          }
        }

        // 5. Add Additional Pax amount if applicable
        const totalAdditionalPaxWithoutTax = roomDays.reduce(
          (sum, i) => sum + (i.additionalPaxDataWithOutTax || 0),
          0,
        );

        const totalAdditionalPaxWithTax = roomDays.reduce(
          (sum, i) => sum + (i.additionalPaxDataWithTax || 0),
          0,
        );

        console.log(totalAdditionalPaxWithTax - totalAdditionalPaxWithoutTax);

        if (totalAdditionalPaxWithoutTax > 0) {
          charges.push({
            date: roomArrivalDate,
            description: `Extra Person`,
            docNo: "-",
            amount: totalAdditionalPaxWithoutTax,
            taxes: totalAdditionalPaxWithTax - totalAdditionalPaxWithoutTax,
            advance: "",
            roomName,
          });
        }

        // 6. Add CGST and SGST for Additional Pax (if any)
        const roomAdditionalPaxTax = roomDays.reduce((sum, i) => {
          const paxWithTax = i.additionalPaxDataWithTax || 0;
          const paxWithoutTax = i.additionalPaxDataWithOutTax || 0;
          return sum + (paxWithTax - paxWithoutTax);
        }, 0);

        if (roomAdditionalPaxTax > 0) {
          const totalPaxWithTax = roomDays.reduce(
            (sum, i) => sum + (i.additionalPaxDataWithTax || 0),
            0,
          );
          const additionalPaxTaxPercentage =
            totalAdditionalPaxWithoutTax > 0
              ? ((totalPaxWithTax - totalAdditionalPaxWithoutTax) /
                  totalAdditionalPaxWithoutTax) *
                100
              : 0;

          const halfAdditionalPaxTaxPercentage = additionalPaxTaxPercentage / 2;

          const paxCGST = roomAdditionalPaxTax / 2;
          const paxSGST = roomAdditionalPaxTax / 2;

          charges.push({
            // date: roomArrivalDate,
            description: `CGST on Extra Person@${halfAdditionalPaxTaxPercentage.toFixed(
              1,
            )}%`,
            docNo: "-",
            amount: 0,
            taxes: paxCGST.toFixed(2),
            advance: "",
            roomName,
          });

          charges.push({
            // date: roomArrivalDate,
            description: `SGST on Extra Person@${halfAdditionalPaxTaxPercentage.toFixed(
              1,
            )}%`,
            docNo: "-",
            amount: 0,
            taxes: paxSGST.toFixed(2),
            advance: "",
            roomName,
          });
        }

        // 7. Add Room Service charges for this specific room
        const roomServiceLines = perRoomRestaurantLines.filter(
          (l) => l.roomName === roomName && l.type === "roomService",
        );

        roomServiceLines?.forEach((serviceLine) => {
          if (Number(serviceLine.amount) > 0) {
            charges.push({
              date: serviceLine.date,
              description: serviceLine.description,
              docNo: serviceLine.docNo,
              amount: serviceLine.amount,
              taxes: 0,
              advance: "",
              roomName: roomName,
            });
          }
        });

        // ✅ 8. After FIRST room only, add ALL Dine In charges
        if (roomIndex === 0) {
          const dineInLines = perRoomRestaurantLines.filter(
            (l) => l.type === "dineIn",
          );
          console.log("Adding dine-in lines after first room:", dineInLines);

          dineInLines?.forEach((dineInLine) => {
            if (Number(dineInLine.amount) > 0) {
              charges.push({
                date: dineInLine.date,
                description: dineInLine.description,
                docNo: dineInLine.docNo,
                amount: dineInLine.amount,
                taxes: 0,
                advance: "",
                roomName: "", // Dine-in not tied to room
              });
            }
          });
        }
      }); // End of roomNames.forEach

      return charges;
    })();

    const allcheckinids = doc?.allCheckInIds;
    const allpartyid = doc?.partyArray;
    console.log(doc);
    console.log("allpartyid", outStanding);
    // Advances only on the decided bill
    let advanceEntries = useAdvances
      ? (outStanding || [])
          .filter(
            (t) =>
              doc?._id === t.billId ||
              doc?.bookingId?._id === t.billId ||
              doc?.checkInId?._id === t.billId,
          )
          .map((t) => ({
            date: formatDate(t.bill_date || t.billdate || new Date()),
            description: t.isCheckOut ? "CheckOut" : "Advance",
            docNo: t.bill_no || t.billno || "-",
            amount: -Math.abs(t.bill_amount || t.billamount || 0),
            taxes: "",
            advance: Math.abs(t.bill_amount || t.billamount || 0).toFixed(2),
          }))
      : [];

    let advanceTotal = useAdvances
      ? (outStanding || [])
          .filter(
            (t) =>
              doc?._id === t.billId ||
              doc?.bookingId?._id === t.billId ||
              doc?.checkInId?._id === t.billId,
          )
          .reduce(
            (sum, t) => sum + Number(t.bill_amount || t.billamount || 0),
            0,
          )
      : 0;

    if (paymentModeDetails?.credit !== undefined) {
      let reduceCheckoutTotal = advanceEntries.reduce(
        (sum, t) => sum + Number(t.advance || 0),
        0,
      );

      console.log(reduceCheckoutTotal);
      advanceEntries = advanceEntries.filter(
        (t) => t.description !== "CheckOut",
      );
      advanceTotal = advanceTotal - reduceCheckoutTotal;
    }
    console.log(advanceTotal);

    // Combine charges and compute balances
    const allCharges = [...groupedRoomCharges, ...advanceEntries];
    console.log(allCharges);
    let cumulativeBalance = 0;
    const chargesWithBalance = allCharges.map((charge) => {
      let currentAmount = Number(charge.amount || 0);
      const lineTaxes = Number(charge.taxes || 0);

      if (String(charge.description).includes("Room Rent")) {
        cumulativeBalance += currentAmount + lineTaxes;
      } else if (charge.description === "Advance") {
        cumulativeBalance += currentAmount;
      } else if (
        String(charge.description).includes("CGST ") ||
        String(charge.description).includes("SGST ")
      ) {
        // Room rent taxes already added with room rent, don't add again
      } else if (String(charge.description).includes("Food Plan")) {
        // Add food plan amount and its taxes
        cumulativeBalance += currentAmount + lineTaxes;
      } else if (String(charge.description).includes("Extra Person")) {
        // Add extra person amount and its taxes
        cumulativeBalance += currentAmount + lineTaxes;
      } else if (
        String(charge.description).includes("CGST") ||
        String(charge.description).includes("SGST")
      ) {
        // Other CGST/SGST already handled above, don't add
      } else {
        // Restaurant and other charges
        cumulativeBalance += currentAmount;
      }

      return {
        ...charge,
        balance: Number.isFinite(cumulativeBalance)
          ? cumulativeBalance.toFixed(2)
          : "0.00",
      };
    });
    console.log(doc);
    console.log(
      roomTariffTotal,
      planAmount,
      foodPlanAmountWithTax,
      sgstAmount,
      cgstAmount,
      restaurantTotal,
    );
    let otherChargeAmount = 0;
    if (
      doc?.otherChargeDetails &&
      Object.keys(doc?.otherChargeDetails).length > 0
    ) {
      otherChargeAmount = doc?.otherChargeAmount;
    }
    const grandTotal =
      Number(roomTariffTotal) +
      Number(additionalPaxAmount) +
      Number(planAmount) +
      // Number(foodPlanAmountWithTax) +
      Number(sgstAmount) +
      Number(cgstAmount) +
      Number(restaurantTotal) +
      otherChargeAmount -
      Number(
        paymentDetails?.paymentDetails?.discountAmount ||
          doc.discountAmount ||
          0,
      );
    const netPay = grandTotal - advanceTotal;

    // Compose hotel/guest info per doc
    const guestRooms = (doc.selectedRooms || [])
      .map((r) => r.roomName)
      .join(", ");
    const pax =
      (doc.selectedRooms || []).reduce(
        (acc, curr) => acc + Number(curr.pax || 0),
        0,
      ) || 1;

    const basePax =
      (doc.selectedRooms || []).reduce(
        (acc, curr) => acc + (curr.isSwapped ? 0 : Number(curr.pax || 0)),
        0,
      ) || 1;
    console.log(doc?.selectedRooms);

    console.log(doc.additionalPaxDetails);
    const additionalPaxCount = (doc.additionalPaxDetails || []).length;
    console.log(additionalPaxCount);

    const totalPax = basePax + additionalPaxCount;

    const convertNumberToWords = (amount) =>
      `${Math.round(amount || 0)} Rupees Only`;
    let partyName = doc?.guestId?.partyName;
    let partyAddress =
      doc?.guestDetailedAddress || doc?.guestId?.billingAddress || "";
    let partyPhone = doc?.guestMobileNumber || doc?.guestId?.mobileNumber || "";
    let partyGstNo = doc?.gstNo || doc?.customerId?.gstNo || "";
    let partyCompanyName = doc?.customerId?.partyName;
    console.log(partyGstNo);
    console.log(doc);
    if (
      paymentDetails?.paymentMode == "credit" &&
      paymentDetails?.paymentDetails?.selectedCreditor
    ) {
      partyName = paymentDetails?.paymentDetails?.selectedCreditor?.partyName;
      partyAddress =
        paymentDetails?.paymentDetails?.selectedCreditor?.billingAddress;
      partyPhone =
        paymentDetails?.paymentDetails?.selectedCreditor?.mobileNumber;
      partyGstNo = paymentDetails?.paymentDetails?.selectedCreditor?.gstNo;

      if (partyGstNo) {
        partyCompanyName =
          paymentDetails?.paymentDetails?.selectedCreditor?.partyName;
      }
    }
    let discount =
      paymentDetails?.paymentDetails?.discountAmount || doc.discountAmount || 0;
    console.log(discount);
    console.log(doc.discountAmount);
    let roomWiseDiscount = doc.selectedRooms.reduce((acc, curr) => {
      return acc + Number(curr.discountAmount || 0);
    }, 0);
    let otherChargesAmount = doc.selectedRooms.reduce((acc, curr) => {
      return acc + Number(curr.otherChargeAmount || 0);
    }, 0);
    console.log(doc);

    console.log(roomWiseDiscount, otherChargesAmount, discount);
    console.log(paymentDetails?.paymentDetails);
    console.log(doc);
    console.log(doc.createdDate);

    return {
      hotel: {
        name: organization?.name,
        address:
          `${organization?.flat || ""} ${organization?.road || ""} ${
            organization?.landmark || ""
          }`.trim() || "Erattayar road, Kattapana, Kerala India",
        phone: organization?.mobile,
        email: organization?.email,
        website: organization?.website,
        pan: organization?.pan,
        gstin: organization?.gstNum,
        sacCode: "996311",
        logo: organization?.logo,
      },
      guest: {
        name: partyName,
        roomNo: guestRooms,
        grcNo: doc?.grcno,
        billNo: doc?.voucherNumber,
        travelAgent: doc?.agentId?.partyName,
        address: partyAddress || "",
        phone: partyPhone || "",
        gstNo: partyGstNo || "",
        companyName: partyCompanyName || "",
      },
      stay: {
        billDate: formatDate(doc.createdDate || new Date()),
        arrival: `${formatDate(doc?.arrivalDate)} ${doc?.arrivalTime || ""}`,
        departure: `${formatDate(doc?.checkOutDate || new Date())} ${
          doc?.checkOutTime || new Date().toLocaleTimeString()
        }`,
        days: doc?.selectedRooms?.[0]?.stayDays,
        plan: doc?.foodPlan?.[0]?.foodPlan,
        pax: totalPax,
        tariff: doc?.selectedRooms?.[0]?.totalAmount || 0,
      },
      charges: chargesWithBalance,
      summary: {
        roomRent: (
          Number(roomTariffTotal || 0) +
          // Number(additionalPaxAmount || 0) +
          Number(otherChargesAmount || 0) -
          Number(roomWiseDiscount || 0)
        ).toFixed(2),
        discount: discount,
        sgst: Number(foodPlanTax) > 0 ? Number(sgstAmount) : sgstAmount,
        cgst: Number(foodPlanTax) > 0 ? Number(cgstAmount) : cgstAmount,
        restaurant: dineInTotal, // ✅ Only dine-in restaurant amount
        roomService: roomServiceTotal, // ✅ Only room service amount
        restaurantSideDiscount: newlyAppliedDiscount,
        foodPlan: planAmount,
        foodPlanAmountTax: Number(foodPlanAmountWithTax),
        additionalPax: additionalPaxAmount,
        otherChargeAmount,
        total: grandTotal,
        totalWords: convertNumberToWords(grandTotal),
      },

      payment: {
        mode: "Credit",
        total: grandTotal,
        advance: advanceTotal,
        netPay,
      },
      isCancelled: doc?.status == "cancelled" ? true : false,
    };
  };

  console.log("paymentModeDetails", paymentModeDetails);

  // Build all billData per doc; decide where advances appear
  // Apply activeMode filtering after building the full bill
  const bills = useMemo(() => {
    const docs = selectedCheckOut || [];

    if (!docs.length) return [];
    const firstPrimaryIdx = findFirstPrimaryIdx(docs);
    console.log(docs.length);

    return docs.map((doc, idx) => {
      // Rule: if this doc owns advances, show here; else show on firstPrimaryIdx
      const owns = docOwnsAdvances(doc);
      const useAdvances = owns ? true : idx === firstPrimaryIdx;
      const bill = prepareBillDataForDoc(doc, useAdvances);
      console.log(bill.isCancelled);
      // ── SPLIT MODE FILTERING ──────────────────────────────────────────────
      if (activeMode === "restaurant") {
        // Keep only restaurant / dine-in / room-service charges — NO advance
        bill.charges = bill.charges.filter((c) => {
          const desc = String(c.description);
          return (
            desc.includes("Restaurant") ||
            desc.includes("Room Service") ||
            desc.includes("Dine In")
          );
        });

        // Recalculate balance for filtered charges (no advance deduction)
        let bal = 0;
        bill.charges = bill.charges.map((charge) => {
          bal += Number(charge.amount || 0);
          return { ...charge, balance: bal.toFixed(2) };
        });
        console.log(bill.summary);

        // Zero out room-related summary fields
        bill.summary.roomRent = "0.00";
        bill.summary.sgst = "0.00";
        bill.summary.cgst = "0.00";
        bill.summary.foodPlan = 0;
        bill.summary.additionalPax = 0;
        bill.summary.otherChargeAmount = 0;

        console.log(bill.summary);

        const restaurantOnlyTotal =
          Number(bill.summary.restaurant || 0) +
          Number(bill.summary.roomService || 0);

        bill.summary.total = restaurantOnlyTotal;
        bill.summary.totalWords = `${Math.round(restaurantOnlyTotal)} Rupees Only`;
        bill.payment.total = restaurantOnlyTotal;
        // No advance deduction for restaurant bill
        bill.payment.advance = 0;
        bill.payment.netPay = restaurantOnlyTotal;
      } else if (activeMode === "room") {
        // Keep only room-related charges + advances; exclude restaurant / dine-in charges
        bill.charges = bill.charges.filter((c) => {
          const desc = String(c.description);
          return (
            !desc.includes("Restaurant") &&
            !desc.includes("Dine In") &&
            !desc.includes("Room Service")
          );
        });

        // Recalculate balance for filtered charges
        // Advance entries have a negative amount so they correctly reduce the running balance
        let bal = 0;

        bill.charges = bill.charges.map((charge) => {
          const amt = Number(charge.amount || 0);
          const tax = Number(charge.taxes || 0);
          if (
            String(charge.description).includes("Room Rent") ||
            String(charge.description).includes("Half Tariff")
          ) {
            bal += amt + tax;
          } else if (
            charge.description === "Advance" ||
            charge.description === "CheckOut"
          ) {
            // amount is already stored as a negative value, so += reduces balance
            bal += amt;
          } else if (
            String(charge.description).includes("CGST") ||
            String(charge.description).includes("SGST")
          ) {
            // already counted with room rent row, skip
          } else {
            bal += amt + tax;
          }
          return { ...charge, balance: bal.toFixed(2) };
        });

        // Zero out restaurant summary fields
        bill.summary.restaurant = 0;
        bill.summary.roomService = 0;
        console.log(bill);

        const roomOnlyTotal =
          Number(bill.summary.roomRent || 0) +
          Number(bill.summary.sgst || 0) +
          Number(bill.summary.cgst || 0) +
          Number(bill.summary.foodPlan || 0) +
          Number(bill.summary.otherChargeAmount || 0) +
          Number(bill.summary.additionalPax || 0);

        bill.summary.total = roomOnlyTotal;
        bill.summary.totalWords = `${Math.round(roomOnlyTotal)} Rupees Only`;
        bill.payment.total = roomOnlyTotal;
        // Subtract advance from room-only total for the net pay
        bill.payment.netPay = Math.max(0, roomOnlyTotal - bill.payment.advance);
      }
      // "default" → no filtering, return full bill as-is

      return bill;
    });
  }, [selectedCheckOut, outStanding, kotData, organization, activeMode]);

  console.log("bills", bills);

  const handlePrintPDF = (isPrint) => {
    const multi = bills && bills.length ? bills : [];
    if (!multi.length) return;
    console.log(paymentModeDetails);
    if (!isPrint) {
      handleBillDownloadPDF(
        multi,
        organization,
        paymentModeDetails,
        isForPreview,
        selected,
      ); // pass array
    } else {
      handleBillPrintInvoice(
        multi,
        organization,
        paymentModeDetails,
        isForPreview,
        selected,
      ); // pass array
    }
  };

  const handleShareBill = async (option, message, ccEmails, toEmail) => {
    if (!bills?.length) throw new Error("No bill data available");
    const firstBill = bills[0];

    if (option === "WhatsApp") {
      handleBillDownloadPDF(bills, organization, paymentModeDetails);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const encodedText = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedText}`, "_blank");
      return true;
    }

    if (option === "Mail") {
      // Generate PDF as base64
      const pdfBase64 = await generateBillPDFAsBase64(
        bills,
        organization,
        paymentModeDetails,
        isForPreview,
      );

      if (!pdfBase64) throw new Error("Failed to generate PDF");

      const res = await api.post(
        "/api/sUsers/send-bill-email",
        {
          toEmail,
          ccEmails,
          message,
          billNo: firstBill?.guest?.billNo,
          guestName: firstBill?.guest?.name,
          organizationName: organization?.name,
          pdfBase64,
          pdfFileName: `Bill-${firstBill?.guest?.billNo || "Invoice"}.pdf`,
        },
        { withCredentials: true },
      );

      if (!res.data?.success)
        throw new Error(res.data?.message || "Failed to send email");
      return true;
    }
  };

  const handleShareClick = async () => {
    if (!bills?.length) {
      toast.error("No bill data to share");
      return;
    }

    const firstBill = bills[0];
    const guestName = firstBill?.guest?.name || "Guest";
    const billNo = firstBill?.guest?.billNo || "";
    const roomNo = firstBill?.guest?.roomNo || "";
    const arrival = firstBill?.stay?.arrival || "";
    const departure = firstBill?.stay?.departure || "";
    const netPay = Number(firstBill?.payment?.netPay || 0).toLocaleString(
      "en-IN",
      { minimumFractionDigits: 2 },
    );
    const hotelName = organization?.name || "";
    const hotelPhone = organization?.mobile || "";

    const defaultMessage = `Dear ${guestName},

Thank you for choosing ${hotelName}!

Your Checkout Summary:
  Bill No    : ${billNo}
  Room No    : ${roomNo}
  Arrival    : ${arrival}
  Departure  : ${departure}
  Net Amount : ₹${netPay}

We hope you had a wonderful stay and look forward to welcoming you again.

For any queries, contact us at ${hotelPhone}.

Warm Regards,
${hotelName}`;

    const { value: option } = await Swal.fire({
      title: "Share through",
      input: "radio",
      inputOptions: { WhatsApp: "WhatsApp", Mail: "Mail" },
      confirmButtonText: "Next",
      confirmButtonColor: "#000000",
      showCancelButton: true,
      cancelButtonText: "Cancel",
      cancelButtonColor: "#dd3333",
      inputValidator: (v) => !v && "Please select an option!",
    });

    if (!option) return;

    let toEmail = "";
    let ccEmails = [];

    if (option === "Mail") {
      const { value: emailData, isDismissed } = await Swal.fire({
        title: "Email Details",
        html: `
          <div style="text-align:left; padding:10px;">
            <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">
              To Email <span style="color:red;">*</span>
            </label>
            <input
              id="swal-to"
              type="email"
              class="swal2-input"
              placeholder="guest@example.com"
              style="width:95%; margin:0 0 14px 0;"
            />
            <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">
              CC Emails <span style="color:gray; font-weight:normal;">(Optional)</span>
            </label>
            <input
              id="swal-cc"
              type="text"
              class="swal2-input"
              placeholder="cc1@example.com, cc2@example.com"
              style="width:95%; margin:0;"
            />
            <small style="color:gray; display:block; margin-top:6px;">
              💡 Separate multiple CC emails with commas
            </small>
          </div>
        `,
        showCancelButton: true,
        cancelButtonColor: "#dd3333",
        confirmButtonText: "Next",
        confirmButtonColor: "#000000",
        width: "540px",
        focusConfirm: false,
        preConfirm: () => {
          const to = document.getElementById("swal-to").value.trim();
          const cc = document.getElementById("swal-cc").value.trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!to) {
            Swal.showValidationMessage("Please enter recipient email");
            return false;
          }
          if (!emailRegex.test(to)) {
            Swal.showValidationMessage("Please enter a valid email address");
            return false;
          }
          if (cc) {
            const invalid = cc
              .split(",")
              .map((e) => e.trim())
              .filter((e) => e && !emailRegex.test(e));
            if (invalid.length) {
              Swal.showValidationMessage(
                `Invalid CC email(s): ${invalid.join(", ")}`,
              );
              return false;
            }
          }
          return { to, cc };
        },
      });

      if (isDismissed || !emailData) return;
      toEmail = emailData.to;
      ccEmails = emailData.cc
        ? emailData.cc
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : [];
    }

    const { value: finalMessage, isDismissed: msgDismissed } = await Swal.fire({
      title: "Compose Message",
      html: `
        <div style="text-align:left; padding:10px;">
          <label style="display:block; margin-bottom:6px; font-weight:bold; font-size:14px;">
            Message <span style="color:red;">*</span>
          </label>
          <textarea
            id="swal-message"
            class="swal2-textarea"
            style="width:95%; height:280px; padding:10px; font-size:13px; resize:vertical;"
          >${defaultMessage}</textarea>
        </div>
      `,
      showCancelButton: true,
      cancelButtonColor: "#dd3333",
      confirmButtonText: "Send",
      confirmButtonColor: "#000000",
      width: "660px",
      focusConfirm: false,
      preConfirm: () => {
        const msg = document.getElementById("swal-message").value;
        if (!msg?.trim()) {
          Swal.showValidationMessage("Please enter a message");
          return false;
        }
        return msg;
      },
    });

    if (msgDismissed || !finalMessage) return;

    Swal.fire({
      title: option === "Mail" ? "Sending Email..." : "Preparing WhatsApp...",
      html: `
        <div style="text-align:center; padding:16px;">
          <p>Please wait...</p>
          ${option === "Mail" && toEmail ? `<p style="color:gray; font-size:13px; margin-top:8px;">To: ${toEmail}</p>` : ""}
          ${ccEmails.length ? `<p style="color:gray; font-size:13px;">CC: ${ccEmails.join(", ")}</p>` : ""}
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      await handleShareBill(option, finalMessage, ccEmails, toEmail);
      Swal.fire({
        icon: "success",
        title: "Success!",
        text:
          option === "Mail"
            ? "Email sent successfully!"
            : "PDF downloaded! Opening WhatsApp...",
        confirmButtonColor: "#000000",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to share. Please try again.",
        confirmButtonColor: "#000000",
      });
    }
  };

  const handlePrintWithPageAssignment = () => {
    // Group charges by assigned page number per bill
    // Build a modified bills array where each bill has charges split across virtual "pages"
    const modifiedBills = bills.flatMap((bill, bIdx) => {
      // Collect page groups for this bill
      const pageGroups = {};
      (bill.charges || []).forEach((charge, cIdx) => {
        const key = `${bIdx}-${cIdx}`;
        const pageNum = rowPageAssignments[key] ?? 1;
        if (!pageGroups[pageNum]) pageGroups[pageNum] = [];
        pageGroups[pageNum].push(charge);
      });

      const sortedPages = Object.keys(pageGroups).sort(
        (a, b) => Number(a) - Number(b),
      );

      // One bill entry per assigned page
      return sortedPages.map((pg) => ({
        ...bill,
        charges: pageGroups[pg],
        _pageLabel: `Page ${pg}`,
      }));
    });

    handleBillPrintInvoice(
      modifiedBills,
      organization,
      paymentModeDetails,
      isForPreview,
    );
  };
  console.log(paymentModeDetails);
  console.log("bills", bills);
  return (
    <>
      <TitleDiv title="Bill Print" />

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
                onChange={() => setSelected("default")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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
                onChange={() => setSelected("room")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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
                onChange={() => setSelected("restaurant")}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded-full focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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

      <div
        className="font-sans bg-gray-100 p-5 min-h-screen"
        ref={printReference}
      >
        {/* Render one complete bill per selectedCheckOut doc */}
        {bills.map((billData, pageIdx) => (
          <div
            key={pageIdx}
            style={{
              maxWidth: "21cm",
              margin: "0 auto",
              padding: "0.5cm",
              backgroundColor: "white",
              fontFamily: "Arial, sans-serif",
              fontSize: "11px",
              lineHeight: "1.1",
              color: "#000",
              pageBreakAfter: pageIdx < bills.length - 1 ? "always" : "auto",
              position: "relative", // ← add
              overflow: "hidden", // ← add
            }}
          >
            {/* Watermark */}
            {isForPreview && !billData.isCancelled && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-45deg)",
                  fontSize: "80px",
                  fontWeight: "bold",
                  color: "rgba(0, 0, 0, 0.08)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 0,
                  userSelect: "none",
                  letterSpacing: "8px",
                  width: "200%",
                  textAlign: "center",
                }}
              >
                PROFORMA INVOICE
              </div>
            )}
            {billData.isCancelled && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-45deg)",
                  fontSize: "80px",
                  fontWeight: "bold",
                  color: "rgba(255, 0, 0, 0.18)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 0,
                  userSelect: "none",
                  letterSpacing: "8px",
                  width: "200%",
                  textAlign: "center",
                }}
              >
                CANCELLED INVOICE
              </div>
            )}
            {/* Header */}
            <div
              className="page-header flex"
              style={{
                textAlign: "center",
                borderBottom: "1px solid #000",
                paddingBottom: "8px",
                marginBottom: "10px",
              }}
            >
              <div style={{ flex: "0 0 120px" }}>
                {organization?.logo && (
                  <img
                    src={organization?.logo}
                    alt="Logo"
                    style={{ width: "120px", height: "auto" }}
                  />
                )}
              </div>
              <div className="ml-auto">
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                  }}
                >
                  {billData?.hotel?.name}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    marginBottom: "2px",
                    lineHeight: "1.2",
                  }}
                >
                  {billData?.hotel?.address?.split(",").map((line, index) => (
                    <div key={index}>{line.trim()}</div>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: "10px",
                    marginBottom: "2px",
                    lineHeight: "1.2",
                  }}
                >
                  Phone: {billData?.hotel?.phone}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    marginBottom: "3px",
                    lineHeight: "1.2",
                  }}
                >
                  E-mail: {billData?.hotel?.email} | Website{" "}
                  {billData?.hotel?.website}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    lineHeight: "1.1",
                  }}
                >
                  PAN NO: {billData?.hotel?.pan} | GSTIN:{" "}
                  {billData?.hotel?.gstin}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    lineHeight: "1.1",
                  }}
                >
                  SAC CODE-{billData?.hotel?.sacCode}
                </div>
              </div>
            </div>

            {/* Guest Info */}
            <div style={{ marginBottom: "10px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "10px",
                }}
              >
                <tbody>
                  {!isForPreview && (
                    <tr>
                      <td
                        style={{
                          width: "15%",
                          padding: "2px 0",
                          fontWeight: "bold",
                        }}
                      >
                        GRC No
                      </td>

                      <td style={{ width: "15%", padding: "2px 0" }}>
                        {billData?.guest?.grcNo}
                      </td>
                      <td
                        style={{
                          width: "15%",
                          padding: "2px 0",
                          fontWeight: "bold",
                        }}
                      >
                        Bill No
                      </td>
                      <td style={{ width: "15%", padding: "2px 0" }}>
                        {billData?.guest?.billNo}
                      </td>
                      <td
                        style={{
                          width: "10%",
                          padding: "2px 0",
                          fontWeight: "bold",
                        }}
                      >
                        Date
                      </td>
                      <td style={{ width: "30%", padding: "2px 0" }}>
                        {billData?.stay?.billDate}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                      GUEST
                    </td>
                    <td style={{ padding: "2px 0" }}>
                      {billData?.guest?.name}
                    </td>
                    <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                      Arrival
                    </td>
                    <td style={{ padding: "2px 0" }}>
                      {billData?.stay?.arrival}
                    </td>
                    <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                      Departure
                    </td>
                    <td style={{ padding: "2px 0" }}>
                      {billData?.stay?.departure}
                    </td>
                  </tr>

                  <tr>
                    {!isForPreview && (
                      <>
                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          Address
                        </td>
                        <td
                          colSpan="3"
                          style={{
                            padding: "2px 0",
                            fontSize: "10px",
                            lineHeight: "1.2",
                          }}
                        >
                          {billData?.guest?.address
                            ?.split(",")
                            .map((line, index) => (
                              <div key={index}>{line.trim()}</div>
                            ))}
                        </td>

                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          Plan
                        </td>
                        <td style={{ padding: "2px 0" }}>
                          {billData?.stay?.plan} Pax {billData?.stay?.pax}
                        </td>
                      </>
                    )}
                  </tr>

                  {!isForPreview && (
                    <>
                      <tr>
                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          Phone
                        </td>
                        <td style={{ padding: "2px 0" }}>
                          {billData?.guest?.phone}
                        </td>
                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          Tariff
                        </td>
                        <td style={{ padding: "2px 0" }}>
                          {billData?.stay?.tariff}
                        </td>
                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          No. of Days
                        </td>
                        <td style={{ padding: "2px 0" }}>
                          {billData?.stay?.days}
                        </td>
                      </tr>
                      <tr>
                        {billData?.guest?.gstNo && (
                          <>
                            <td
                              style={{ padding: "2px 0", fontWeight: "bold" }}
                            >
                              GST No
                            </td>
                            <td style={{ padding: "2px 0" }}>
                              {billData?.guest?.gstNo}
                            </td>
                          </>
                        )}
                        {billData?.guest?.travelAgent && (
                          <>
                            <td
                              style={{ padding: "2px 0", fontWeight: "bold" }}
                            >
                              Travel Agent
                            </td>
                            <td style={{ padding: "2px 0" }}>
                              {billData?.guest?.travelAgent}
                            </td>
                          </>
                        )}
                      </tr>
                    </>
                  )}
                  {billData?.guest?.gstNo && !isForPreview && (
                    <>
                      <tr>
                        <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                          Company
                        </td>
                        <td style={{ padding: "2px 0" }}>
                          {billData?.guest?.companyName}
                        </td>
                        <td colSpan="4"></td>
                      </tr>
                    </>
                  )}

                  <tr>
                    <td style={{ padding: "2px 0", fontWeight: "bold" }}>
                      Room No
                    </td>
                    <td style={{ padding: "2px 0" }}>
                      {billData?.guest?.roomNo}
                    </td>
                    <td colSpan="4"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Charges Table */}
            <div style={{ marginBottom: "10px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1px solid #000",
                  fontSize: "10px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "left",
                      }}
                    >
                      Date
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "left",
                      }}
                    >
                      Doc No
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "left",
                      }}
                    >
                      Description
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "right",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "right",
                      }}
                    >
                      Taxes
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "right",
                      }}
                    >
                      Advance
                    </th>
                    <th
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "right",
                      }}
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {billData?.charges?.map((charge, index) => (
                    <tr key={index}>
                      <td style={{ border: "1px solid #000", padding: "3px" }}>
                        {charge.date}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "3px",
                          textAlign: "center",
                        }}
                      >
                        {charge.docNo}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px" }}>
                        {charge.description}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "3px",
                          textAlign: "right",
                        }}
                      >
                        {Number(charge.amount || 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "3px",
                          textAlign: "right",
                        }}
                      >
                        {charge.taxes}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "3px",
                          textAlign: "right",
                        }}
                      >
                        {charge.advance}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "3px",
                          textAlign: "right",
                        }}
                      >
                        {charge.balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary + Payment */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "10px" }}>
              {/* Summary */}
              <div style={{ flex: "1" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #000",
                    fontSize: "11px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "left",
                          fontWeight: "bold",
                        }}
                      >
                        Summary
                      </th>
                      <th
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMode !== "restaurant" && (
                      <tr>
                        <td
                          style={{ border: "1px solid #000", padding: "4px" }}
                        >
                          Room Rent
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "4px",
                            textAlign: "right",
                          }}
                        >
                          {Number(
                            billData?.summary?.roomRent || 0,
                          ).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}
                    {activeMode !== "restaurant" &&
                      billData?.summary?.discount > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Discount
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {Number(
                              billData?.summary?.discount || 0,
                            ).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      )}

                    {activeMode !== "restaurant" &&
                      billData?.summary?.foodPlan > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Food Plan
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.foodPlan?.toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      )}
                    {activeMode !== "restaurant" &&
                      billData?.summary?.additionalPax > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Additional Pax
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {Number(
                              billData?.summary?.additionalPax || 0,
                            ).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      )}
                    {activeMode !== "restaurant" && billData?.summary?.sgst && (
                      <tr>
                        <td
                          style={{ border: "1px solid #000", padding: "4px" }}
                        >
                          SGST
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "4px",
                            textAlign: "right",
                          }}
                        >
                          {billData?.summary?.sgst?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}
                    {activeMode !== "restaurant" && billData?.summary?.cgst && (
                      <tr>
                        <td
                          style={{ border: "1px solid #000", padding: "4px" }}
                        >
                          CGST
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "4px",
                            textAlign: "right",
                          }}
                        >
                          {billData?.summary?.cgst?.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    )}
                    {activeMode !== "room" &&
                      billData?.summary?.restaurant > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Dine-In
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.restaurant?.toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      )}
                    {activeMode !== "room" &&
                      billData?.summary?.roomService > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Room Service
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.roomService?.toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      )}
                    {activeMode !== "room" &&
                      billData?.summary?.restaurantSideDiscount > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Restaurant Side Discount
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.restaurantSideDiscount?.toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      )}
                    {activeMode !== "restaurant" &&
                      billData?.summary?.otherChargeAmount > 0 && (
                        <tr>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            Other Charges
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.otherChargeAmount?.toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                              },
                            )}
                          </td>
                        </tr>
                      )}

                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "right",
                          fontWeight: "bold",
                        }}
                      >
                        {Number(billData?.summary?.total || 0).toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment */}
              <div style={{ flex: "1" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    border: "1px solid #000",
                    fontSize: "11px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f5f5f5" }}>
                      <th
                        colSpan="2"
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "left",
                          fontWeight: "bold",
                        }}
                      >
                        Payment Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        PAY MODE
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          fontWeight: "bold",
                          textAlign: "center",
                        }}
                      >
                        AMOUNT
                      </td>
                    </tr>
                    {/* {selected == "default" && ( */}
                    <>
                      {paymentModeDetails
                        .filter((item) =>
                          selected == "room"
                            ? item.under == "room"
                            : selected == "restaurant"
                              ? item.under == "food"
                              : true,
                        )
                        .map((item, index) => (
                          <tr key={index}>
                            <td
                              style={{
                                border: "1px solid #000",
                                padding: "4px",
                              }}
                            >
                              {item.customerName} ({item.mode.toUpperCase()}) -{" "}
                              {item.under == "food" ? "Restaurant" : "Room"}
                            </td>
                            <td
                              style={{
                                border: "1px solid #000",
                                padding: "4px",
                                textAlign: "right",
                              }}
                            >
                              {item.amount.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                    </>
                    {/* )} */}

                    {/* {(selected == "room" || selected == "restaurant") && (
                      <>
                        <tr>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                            }}
                          >
                            {selected == "room" ? "Room" : "Restaurant"}
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            {billData?.summary?.total.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </>
                    )} */}
                    <tr>
                      <td
                        style={{ border: "1px solid #000", padding: "4px" }}
                        colSpan="2"
                      >
                        <div style={{ fontSize: "10px", fontWeight: "bold" }}>
                          {billData?.summary?.totalWords}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      {!isForPreview ? (
                        <>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                              }}
                            >
                              Total :
                            </div>
                            {billData?.payment?.total &&
                              Number(billData?.payment?.advance) > 0 && (
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    marginBottom: "4px",
                                  }}
                                >
                                  Advance :
                                </div>
                              )}
                            <div style={{ fontWeight: "bold" }}>Net Pay :</div>
                          </td>

                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                              }}
                            >
                              {Number(billData?.payment?.total || 0).toFixed(2)}
                            </div>
                            {billData?.payment?.total &&
                              Number(billData?.payment?.advance) > 0 && (
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {Number(
                                    billData?.payment?.advance || 0,
                                  ).toFixed(2)}
                                </div>
                              )}
                            <div style={{ fontWeight: "bold" }}>
                              {Number(billData?.payment?.netPay || 0).toFixed(
                                2,
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            style={{ border: "1px solid #000", padding: "4px" }}
                          >
                            <div>Total :</div>
                            <div>Less Advance:</div>
                            <div style={{ fontWeight: "bold" }}>Net Pay :</div>
                          </td>
                          <td
                            style={{
                              border: "1px solid #000",
                              padding: "4px",
                              textAlign: "right",
                            }}
                          >
                            <div>
                              {Number(billData?.payment?.total || 0).toFixed(2)}
                            </div>
                            <div>
                              {Number(billData?.payment?.advance || 0).toFixed(
                                2,
                              )}
                            </div>
                            <div style={{ fontWeight: "bold" }}>
                              {Number(
                                Math.round(billData?.payment?.netPay || 0),
                              ).toFixed(2)}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ border: "1px solid #000" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
                <div
                  style={{
                    flex: "1",
                    padding: "8px",
                    borderRight: "1px solid #000",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  Please Deposit Your Room and Locker Keys
                </div>
                <div style={{ flex: "1", padding: "8px", fontSize: "10px" }}>
                  Regardless of charge instructions, I agree to be held
                  personally liable for the payment of total amount of bill.
                  Please collect receipt if you have paid cash.
                </div>
              </div>

              <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
                <div
                  style={{
                    flex: "1",
                    padding: "12px",
                    borderRight: "1px solid #000",
                    textAlign: "left",
                    fontSize: "10px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "15px" }}>
                    Prepared By
                  </div>
                  <div>FO</div>
                </div>
                <div
                  style={{
                    flex: "1",
                    padding: "12px",
                    borderRight: "1px solid #000",
                    textAlign: "left",
                    fontSize: "10px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "15px" }}>
                    Manager
                  </div>
                  <div
                    style={{
                      height: "15px",
                      borderBottom: "1px solid #000",
                      margin: "10px 0",
                    }}
                  ></div>
                </div>
                <div
                  style={{
                    flex: "1",
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "10px",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "15px" }}>
                    Guest Signature & Date
                  </div>
                  <div
                    style={{
                      height: "15px",
                      borderBottom: "1px solid #000",
                      margin: "10px 0",
                    }}
                  ></div>
                </div>
              </div>

              <div style={{ display: "flex" }}>
                <div
                  style={{
                    flex: "1",
                    padding: "8px",
                    borderRight: "1px solid #000",
                    fontStyle: "italic",
                    fontSize: "10px",
                  }}
                >
                  We hope you enjoyed your stay and would like to welcome you
                  back...
                </div>
                <div
                  style={{
                    padding: "8px",
                    fontSize: "10px",
                    textAlign: "center",
                    minWidth: "120px",
                  }}
                >
                  {isForPreview ? "Proforma Invoice" : "Original Bill"}
                  <br />
                  Page {pageIdx + 1}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Print Styles */}
        <style>{`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { margin: 0; padding: 0; }
            @page { margin: 0.5cm; size: A4; }
            .page-header { position: running(header); page-break-inside: avoid; break-inside: avoid; }
            .charges-table, .summary-section, .payment-section { page-break-inside: avoid; }
          }
        `}</style>
      </div>

      {/* Action buttons */}
      {/* <div className="no-print w-full flex justify-center">
        <div className="no-print flex flex-wrap gap-3 mb-4 p-4">
          <button
            onClick={() => handlePrintPDF(false)}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            📄 Download PDF
          </button>
          <button
            onClick={handleSplitPayment}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            💳 Arrange Print
          </button>
          <button
            onClick={handleSplitPayment}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            💳 Split Payment
          </button>

          <button
            onClick={handleShareClick}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
          >
            Share
          </button>

          {isForPreview && (
            <button
              onClick={() => {
                // For preview confirm, use first bill's netPay as balanceToPay

                let balanceToPay = 0;
                bills?.forEach((item) => (balanceToPay += item.payment.netPay));
                console.log(balanceToPay);
                const firstDoc = selectedCheckOut[0];
                navigate("/sUsers/checkInList", {
                  state: {
                    selectedCheckOut,
                    selectedCustomer: firstDoc?.customerId,
                    balanceToPay,
                    kotData,
                    checkoutmode,
                    cheinids,
                    isForPreview,
                  },
                });
              }}
              className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
            >
              ✅ Confirm
            </button>
          )}

          <button
            onClick={() => handlePrintPDF(true)}
            className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            🖨️ Print Invoice
          </button>
        </div>
      </div> */}
      <div className="no-print w-full flex justify-center">
        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700">
          {/* Primary action stands out */}
          <button
            onClick={() => handlePrintPDF(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                 bg-black text-white hover:opacity-80 active:scale-95 transition-all"
          >
            <DownloadIcon className="w-4 h-4" />
            Download PDF
          </button>

          <button
            onClick={() => handlePrintPDF(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                 border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <PrinterIcon className="w-4 h-4 text-gray-500" />
            Print Invoice
          </button>

          {/* Visual separator */}
          <div className="w-px bg-gray-200 dark:bg-zinc-700 self-stretch mx-1" />

          <button
            onClick={() => {
              // Initialize all rows to page 1 if not already set
              const init = { ...rowPageAssignments };
              bills.forEach((bill, bIdx) => {
                bill.charges?.forEach((_, cIdx) => {
                  const key = `${bIdx}-${cIdx}`;
                  if (init[key] === undefined) init[key] = 1;
                });
              });
              setRowPageAssignments(init);
              setPageSelectBillIdx(0);
              setShowPageSelectModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <GridIcon className="w-4 h-4 text-gray-500" />
            Arrange Print
          </button>

          <button
            onClick={handleSplitPayment}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <CreditCardIcon className="w-4 h-4 text-gray-500" />
            Split Payment
          </button>

          <div className="w-px bg-gray-200 dark:bg-zinc-700 self-stretch mx-1" />

          <button
            onClick={handleShareClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <ShareIcon className="w-4 h-4 text-gray-500" />
            Share
          </button>

          {isForPreview && (
            <button
              onClick={() => {
                // For preview confirm, use first bill's netPay as balanceToPay

                let balanceToPay = 0;
                bills?.forEach((item) => (balanceToPay += item.payment.netPay));
                console.log(balanceToPay);
                const firstDoc = selectedCheckOut[0];
                navigate("/sUsers/checkInList", {
                  state: {
                    selectedCheckOut,
                    selectedCustomer: firstDoc?.customerId,
                    balanceToPay,
                    kotData,
                    checkoutmode,
                    cheinids,
                    isForPreview,
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400
                 hover:bg-green-50 dark:hover:bg-green-900/20 active:scale-95 transition-all"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Confirm
            </button>
          )}
        </div>
      </div>
      {/* ── Page Selection Modal ── */}
      {showPageSelectModal && bills.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-zinc-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Page Assignment — Bill #
                  {bills[pageSelectBillIdx]?.guest?.billNo}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Enter a page number for each row. Rows with the same page
                  number will print together.
                </p>
              </div>
              <button
                onClick={() => setShowPageSelectModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Bill tabs if multiple bills */}
            {bills.length > 1 && (
              <div className="flex gap-1 px-5 pt-3">
                {bills.map((b, i) => (
                  <button
                    key={i}
                    onClick={() => setPageSelectBillIdx(i)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      pageSelectBillIdx === i
                        ? "bg-black text-white"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    Bill {i + 1} — {b?.guest?.name}
                  </button>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-auto flex-1 px-5 py-3">
              <table className="w-full text-xs border-collapse border border-gray-300 dark:border-zinc-600">
                <thead>
                  <tr className="bg-gray-100 dark:bg-zinc-800">
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-left">
                      Date
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-left">
                      Doc No
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-left">
                      Description
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-right">
                      Amount
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-right">
                      Taxes
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-right">
                      Advance
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-right">
                      Balance
                    </th>
                    <th className="border border-gray-300 dark:border-zinc-600 px-2 py-2 text-center w-20 bg-blue-50 dark:bg-blue-900/20">
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">
                        Page
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bills[pageSelectBillIdx]?.charges?.map(
                    (charge, chargeIdx) => {
                      const key = `${pageSelectBillIdx}-${chargeIdx}`;
                      const pageVal = rowPageAssignments[key] ?? 1;
                      return (
                        <tr
                          key={chargeIdx}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5">
                            {charge.date}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-center">
                            {charge.docNo}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5">
                            {charge.description}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-right">
                            {Number(charge.amount || 0).toFixed(2)}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-right">
                            {charge.taxes}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-right">
                            {charge.advance}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-right">
                            {charge.balance}
                          </td>
                          <td className="border border-gray-200 dark:border-zinc-700 px-2 py-1.5 text-center bg-blue-50/50 dark:bg-blue-900/10">
                            <input
                              type="number"
                              min="1"
                              value={pageVal}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  parseInt(e.target.value) || 1,
                                );
                                setRowPageAssignments((prev) => ({
                                  ...prev,
                                  [key]: val,
                                }));
                              }}
                              className="w-14 text-center border border-blue-300 dark:border-blue-600 rounded px-1 py-0.5
                                 text-xs bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500
                                 text-gray-900 dark:text-white"
                            />
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-zinc-700 gap-3">
              <button
                onClick={() => {
                  // Reset all to page 1
                  const reset = {};
                  bills.forEach((bill, bIdx) => {
                    bill.charges?.forEach((_, cIdx) => {
                      reset[`${bIdx}-${cIdx}`] = 1;
                    });
                  });
                  setRowPageAssignments(reset);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
              >
                Reset all to Page 1
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPageSelectModal(false)}
                  className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPageSelectModal(false);
                    handlePrintWithPageAssignment();
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-black text-white hover:opacity-80 flex items-center gap-1.5"
                >
                  <PrinterIcon className="w-4 h-4" />
                  Print with Page Split
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HotelBillPrint;
