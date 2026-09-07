import mongoose from "mongoose";
import receiptModel from "../models/receiptModel.js";
import TallyData from "../models/TallyData.js";
import Settlement from "../models/settlementModel.js";
import Party from "../models/partyModel.js";
import { Booking, CheckIn, CheckOut } from "../models/bookingModal.js";
import salesModel from "../models/salesModel.js";
import VoucherSeriesModel from "../models/VoucherSeriesModel.js";
import roomModal from "../models/roomModal.js";
import { generateVoucherNumber } from "../helpers/voucherHelper.js";
import {
  saveSettlementDataHotel,
  updateStatus as syncRoomStatus,
} from "../helpers/hotelHelper.js";
import { createReceiptsAndSettlements } from "../helpers/checkoutHelper.js";
import { handleRecalculateCheckOut } from "../helpers/saleCalculationHelper.js";
// =============================================================================
// convertCheckOutToSale
// =============================================================================
export const convertCheckOutToSale = async (req, res) => {
  const session = await mongoose.startSession();

  let isAnyPartial = false;
  let checkOutAfterSave = [];
  let createdCheckoutIds = [];
  let multiCheckoutResults = [];

  try {
    await session.withTransaction(async () => {
      const { cmp_id } = req.params;
      req.body.selectedCheckOut = await handleRecalculateCheckOut(
        req.body.selectedCheckOut,
        cmp_id,
      );

      let {
        paymentMethod,
        paymentDetails,
        selectedCheckOut = [],
        restaurantBaseSaleData = [],
        isPostToRoom = false,
        roomAssignments = null,
        checkoutMode,
        checkinIds,
        restaurantSideDiscountAdjustmentArray,
        checkoutRequestId,
      } = req.body;

      if (!checkoutRequestId) {
        throw new Error("Missing checkout request id");
      }
      // ── Validations ──────────────────────────────────────────────────────
      if (!cmp_id) throw new Error("Missing cmp_id");
      if (!Array.isArray(selectedCheckOut) || selectedCheckOut.length === 0)
        throw new Error("No checkout selected");
      if (!["single", "multiple"].includes(checkoutMode))
        throw new Error("Invalid checkout mode");
      if (!paymentDetails) throw new Error("Missing payment details");

      const paymentMode = paymentDetails?.paymentMode;
      if (!["single", "split", "credit"].includes(paymentMode))
        throw new Error("Invalid payment mode");

      let effectiveRestaurantBaseSaleData = Array.isArray(
        restaurantBaseSaleData,
      )
        ? [...restaurantBaseSaleData]
        : [];

      // ── Step 1: Restaurant discount / advance adjustments ────────────────
      if (restaurantSideDiscountAdjustmentArray?.length > 0) {
        await handleAdvanceAndDiscountSettlementInRestaurant(
          restaurantSideDiscountAdjustmentArray,
          selectedCheckOut,
          cmp_id,
          session,
        );

        const restaurantSaleIds = effectiveRestaurantBaseSaleData
          .map((sale) => sale?._id)
          .filter(Boolean);

        if (restaurantSaleIds.length > 0) {
          const refreshedRestaurantSales = await salesModel
            .find({
              _id: { $in: restaurantSaleIds },
              cmp_id,
              isCancelled: false,
            })
            .session(session);

          const refreshedSaleMap = new Map(
            refreshedRestaurantSales.map((sale) => [String(sale._id), sale]),
          );

          effectiveRestaurantBaseSaleData = restaurantSaleIds
            .map((saleId) => refreshedSaleMap.get(String(saleId)))
            .filter(Boolean);
        }
      }

      const split = paymentDetails?.splitDetails || [];
      const additionalCharges = paymentDetails?.additionalChargeArray || [];
      const splitDetails = split;

      const restaurantTotal =
        effectiveRestaurantBaseSaleData.length > 0
          ? effectiveRestaurantBaseSaleData.reduce(
              (acc, item) => acc + Number(item.finalAmount || 0),
              0,
            )
          : 0;

      // ── Step 2: Voucher series ───────────────────────────────────────────
      const specificVoucherSeries = await hotelVoucherSeries(
        cmp_id,
        session,
        "sales",
        false,
      );
      console.log("specificVoucherSeries", specificVoucherSeries);

      // ── Step 3: Pre-fetch bookings + checkins (avoid N+1 in loop) ────────
      const bookingVoucherNumbers = selectedCheckOut
        .map((item) => item?.bookingId?.voucherNumber || item?.bookingId)
        .filter(Boolean);

      const checkinVoucherNumbers = selectedCheckOut
        .map((item) => item?.voucherNumber)
        .filter(Boolean);

      const [allBookings, allCheckins] = await Promise.all([
        Booking.find({
          voucherNumber: { $in: bookingVoucherNumbers },
          cmp_id,
        }).session(session),
        CheckIn.find({
          voucherNumber: { $in: checkinVoucherNumbers },
          cmp_id,
        }).session(session),
      ]);

      const bookingMap = new Map(allBookings.map((b) => [b.voucherNumber, b]));
      const checkinMap = new Map(allCheckins.map((c) => [c.voucherNumber, c]));

      let results = [];
      let salesarray = [];

      // ======================================================================
      // MAIN LOOP — one iteration per checkout item
      // ======================================================================
      for (const item of selectedCheckOut) {
        const bookingVoucherNumber =
          item?.bookingId?.voucherNumber || item?.bookingId;
        const checkingVoucherNumber = item?.voucherNumber;

        const matchedBooking = bookingMap.get(bookingVoucherNumber);
        const matchedCheckin = checkinMap.get(checkingVoucherNumber);

        let otherCharges = additionalCharges;
        let totalOtherChargeAmount = otherCharges.reduce(
          (acc, charge) => acc + Number(charge?.finalValue || 0),
          0,
        );

        const selectedPartyId = item?.customerId?._id || item?.customerId;
        if (!selectedPartyId)
          throw new Error("Missing customerId._id in checkout item");

        const itemTotal = Number(item.grandTotal || 0);

        const partyData = await getSelectedParty(
          selectedPartyId,
          cmp_id,
          session,
        );
        const party = mapPartyData(partyData);

        // ── Payment amount calculation ───────────────────────────────────
        // ── Payment amount calculation ───────────────────────────────────
        let cashAmt = 0;
        let onlineAmt = 0;
        let finalPaymentMethod = "";
        let paidAmount = 0;
        let applicableSplits = [];
        let remarks = "";

        if (paymentMode === "single") {
          cashAmt = Number(paymentDetails?.cashAmount || 0);
          onlineAmt = Number(paymentDetails?.onlineAmount || 0);
          remarks = paymentDetails?.remarks ?? "";

          finalPaymentMethod =
            cashAmt > 0 ? "cash" : onlineAmt > 0 ? "bank" : "unknown";

          paidAmount = cashAmt + onlineAmt;
        } else if (paymentMode === "split") {
          const splitDetails = paymentDetails?.splitDetails || [];

          applicableSplits = splitDetails.map((splitItem) => ({
            ...splitItem,
            amount: Number(splitItem.amount || 0),
          }));

          const nonCreditSplits = applicableSplits.filter(
            (s) => s.sourceType !== "credit",
          );

          paidAmount = nonCreditSplits.reduce(
            (sum, s) => sum + Number(s.amount || 0),
            0,
          );

          cashAmt = nonCreditSplits
            .filter((s) => s.sourceType === "cash")
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);

          onlineAmt = nonCreditSplits
            .filter((s) => ["bank", "upi", "card"].includes(s.sourceType))
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);

          finalPaymentMethod =
            cashAmt > 0 ? "cash" : onlineAmt > 0 ? "bank" : "credit";
        } else if (isPostToRoom || paymentMode === "credit") {
          cashAmt = Number(paymentDetails?.cashAmount || 0);
          finalPaymentMethod = "credit";
          paidAmount = Number(paymentDetails?.cashAmount || 0);
        }

        const pendingAmount =
          itemTotal - (paidAmount + Number(item?.totalAdvance || 0));

        // ── Build paymentSplittingArray ──────────────────────────────────
        const { arr: paymentSplittingArray, restaurantSplitArray } =
          await createPaymentSplittingArray(
            paymentDetails,
            cashAmt,
            onlineAmt,
            applicableSplits,
            restaurantTotal,
            effectiveRestaurantBaseSaleData,
            session,
          );

        const hotelSplitTotal = paymentSplittingArray.reduce(
          (sum, s) => sum + Number(s.amount || 0),
          0,
        );
        const isHotelAmountZero = hotelSplitTotal === 0;
        console.log("paymentSplittingArray", paymentSplittingArray);
        console.log("restaurantSplitArray", restaurantSplitArray);

        const checkInId = item?._id;
        const roomsBeingCheckedOut = item?.selectedRooms || [];
        const originalCheckIn =
          await CheckIn.findById(checkInId).session(session);

        if (!originalCheckIn)
          throw new Error(`Check-in ${checkInId} not found`);

        // validation side
        if (String(originalCheckIn.status || "").toLowerCase() === "checkout") {
          throw new Error(
            `Check-in ${originalCheckIn.voucherNumber || checkInId} is already checked out`,
          );
        }

        console.log("roomsBeingCheckedOut",roomsBeingCheckedOut)

        if (
          !Array.isArray(roomsBeingCheckedOut) ||
          roomsBeingCheckedOut.length === 0
        ) {
          throw new Error(
            `No rooms selected for check-in ${originalCheckIn.voucherNumber || checkInId}`,
          );
        }

        // ── Sale voucher number ──────────────────────────────────────────
        const saleNumber = await generateVoucherNumber(
          cmp_id,
          "sales",
          specificVoucherSeries._id.toString(),
          session,
        );

        const isThisPartial =
          item.isPartialCheckout ||
          roomsBeingCheckedOut.length <
            (originalCheckIn.selectedRooms?.length || 0);

        if (isThisPartial) isAnyPartial = true;

        const roomIdsBeingCheckedOut = roomsBeingCheckedOut.map(
          (room) => room._id?.toString() || room.toString(),
        );
        const remainingRooms = (originalCheckIn.selectedRooms || []).filter(
          (room) => !roomIdsBeingCheckedOut.includes(room._id.toString()),
        );

        const roomTotal = itemTotal;

        // ── Checkout amount types (for display) ──────────────────────────
        let checkoutamounttypes = [];
        if (paymentMode !== "credit") {
          checkoutamounttypes = paymentSplittingArray
            .filter((s) => s.underCategory !== "food")
            .map((s) => ({
              paymentId: s.paymentId,
              customerName: s.customerName,
              mode: s.subsource,
              amount: Number(s.amount || 0),
            }));
        } else {
          checkoutamounttypes = [
            {
              paymentId: paymentSplittingArray[0]?.paymentId || null,
              customerName: paymentDetails.selectedCreditor?.partyName,
              mode: "credit",
              amount: Number(paymentDetails.cashAmount || 0),
            },
          ];
        }

        console.log("checkoutamounttypes", checkoutamounttypes);

        // Restaurant payment totals for CheckOut doc
        const paymentTotals = paymentSplittingArray.reduce(
          (acc, s) => {
            const type = s.sourceType;
            const amount = Number(s.amount || 0);
            if (type === "cash") acc.cash += amount;
            else if (type === "upi") acc.upi += amount;
            else if (type === "bank") acc.bank += amount;
            else if (type === "card") acc.card += amount;
            else if (type === "credit") acc.credit += amount;
            return acc;
          },
          { cash: 0, upi: 0, bank: 0, card: 0, credit: 0 },
        );
        const { cash, upi, bank, card, credit } = paymentTotals;

        // ── Create CheckOut document ─────────────────────────────────────
        const checkOutDoc = await CheckOut.create(
          [
            {
              ...item,
              _id: undefined,
              cmp_id,
              Primary_user_id: req.owner || req.pUserId,
              voucherNumber: saleNumber?.voucherNumber,
              checkInId,
              checkoutRequestId,
              bookingId: item?.bookingId?._id || item?.bookingId,
              customerId: selectedPartyId,
              customerName: item?.customerId?.partyName || party?.customerName,
              selectedRooms: roomsBeingCheckedOut,
              totalAmount: itemTotal,
              roomTotal: Number(item.roomTotal || 0),
              grandTotal: Number(item.grandTotal || 0),
              balanceToPay: pendingAmount < 0 ? 0 : pendingAmount,
              specificFoodPlanTotal: Number(item.specificFoodPlanTotal || 0),
              taxableSpecificFoodPlan: Number(
                item.taxableSpecificFoodPlan || 0,
              ),
              foodPlanTaxAmount: Number(item.foodPlanTaxAmount || 0),
              additionalPaxWithTax: Number(item.additionalPaxWithTax || 0),
              additionalPaxWithoutTax: Number(
                item.additionalPaxWithoutTax || 0,
              ),
              additionalPaxTaxAmount: Number(item.additionalPaxTaxAmount || 0),
              additionalPaxCount: Number(item.additionalPaxCount || 0),
              isPartialCheckout: isThisPartial,
              originalCheckInId: checkInId,
              discountAmount: Number(item?.discountAmount || 0),
              paymenttypeDetails: { cash, bank, upi, card, credit },
              checkoutpaymenttypedetails: checkoutamounttypes,
              checkoutType:
                checkoutMode === "single"
                  ? "singleCheckout"
                  : "individualCheckout",
            },
          ],
          { session },
        );

        const createdDoc = checkOutDoc[0];
        createdCheckoutIds.push(createdDoc._id);

        const amount = Number(item.grandTotal || 0);

        // ── Create hotel Sale voucher ────────────────────────────────────
        const savedVoucherData = await createSalesVoucher(
          cmp_id,
          specificVoucherSeries,
          saleNumber,
          req,
          [item],
          party,
          partyData,
          paymentSplittingArray,
          session,
          checkInId,
          createdDoc._id,
          amount,
          otherCharges,
          totalOtherChargeAmount,
        );

        salesarray = savedVoucherData;

        // ── Create hotel TallyData ───────────────────────────────────────
        // SPLIT  → one TallyData per room split source
        //          cash/bank → bill_pending_amt = 0  (paid immediately)
        //          credit    → bill_pending_amt = amount (stays outstanding)
        // SINGLE/CREDIT → one TallyData for full amount
        //          createReceiptsAndSettlements reduces pending after receipts

        let tallyRows = [];
        if (!isHotelAmountZero) {
          if (paymentMode === "split") {
            for (const splitEntry of paymentSplittingArray) {
              const isCredit = splitEntry.type === "credit";
              const splitPartyId = isCredit
                ? splitEntry.customer // credit party
                : selectedPartyId; // room payer
              console.log("splitEntry", splitEntry);
              const rows = await createTallyEntry(
                cmp_id,
                req,
                splitPartyId,
                [item],
                savedVoucherData[0],
                Number(splitEntry.amount || 0), // bill_amount
                splitEntry.type === "credit"
                  ? Number(splitEntry.amount || 0)
                  : 0, // pending only for credit
                session,
                "checkout",
                splitEntry.paymentId,
              );
              tallyRows.push(...rows);
            }
          } else {
            // single or credit → one TallyData, pending = full amount
            const rows = await createTallyEntry(
              cmp_id,
              req,
              selectedPartyId,
              [item],
              savedVoucherData[0],
              amount, // bill_amount
              amount, // bill_pending_amt ← createReceiptsAndSettlements reduces this
              session,
              "checkout",
              null,
            );
            tallyRows.push(...rows);
          }
        }
        // ── Update booking receipts to point to new sale ─────────────────
        await updateReceiptForRooms(
          item?.voucherNumber,
          item?.bookingId?.voucherNumber || item?.bookingId,
          saleNumber?.voucherNumber,
          savedVoucherData[0]?._id,
          session,
        );

        // ── Update CheckIn status ────────────────────────────────────────
        if (isThisPartial && remainingRooms.length > 0) {
          await CheckIn.updateOne(
            { _id: checkInId },
            {
              $set: {
                selectedRooms: remainingRooms,
                status: "checkIn",
                isPartiallyCheckedOut: true,
              },
              $push: {
                partialCheckoutHistory: {
                  date: new Date(),
                  roomsCheckedOut: roomsBeingCheckedOut.map((room) => ({
                    roomId: room._id,
                    roomName: room.roomName,
                  })),
                  saleVoucherNumber: saleNumber?.voucherNumber,
                },
              },
            },
            { session },
          );
          await updateStatus(roomsBeingCheckedOut, "dirty", session);
        } else {
          if (checkoutMode === "single") {
            const updateResult = await CheckIn.updateMany(
              { _id: { $in: checkinIds }, status: { $ne: "checkOut" } },
              { $set: { status: "checkOut", checkOutDate: new Date() } },
              { session },
            );

            if (updateResult.modifiedCount !== checkinIds.length) {
              throw new Error("One or more check-ins are already checked out");
            }
          } else {
            const updateResult = await CheckIn.updateOne(
              { _id: checkInId, status: { $ne: "checkOut" } },
              { $set: { status: "checkOut", checkOutDate: new Date() } },
              { session },
            );

            if (updateResult.modifiedCount === 0) {
              throw new Error("This check-in is already checked out");
            }
          }
          await updateStatus(roomsBeingCheckedOut, "dirty", session);
        }

        results.push({
          saleNumber,
          salesRecord: savedVoucherData[0],
          tallyId: tallyRows?.[0]?._id,
          tallyRows,
          checkInId,
          checkOutId: createdDoc._id,
          isPartial: isThisPartial,
          paymentMode,
          itemTotal,
          paidAmount,
          pendingAmount,
          applicableSplitsCount: applicableSplits.length,

          splitSummary: [
            ...paymentSplittingArray.map((s) => ({
              section: "hotel",
              type: s.type,
              sourceType: s.sourceType,
              subsource: s.subsource,
              amount: Number(s.amount || 0),
              underCategory: s.underCategory || "room",
              source: s.source,
              customer: s.customer,
              customerName: s.customerName || null,
              isCredit: s.sourceType === "credit" || s.type === "credit",
            })),
            ...restaurantSplitArray.map((s) => ({
              section: "restaurant",
              type: s.type,
              sourceType: s.sourceType,
              subsource: s.subsource,
              amount: Number(s.amount || 0),
              underCategory: s.underCategory || "food",
              source: s.source,
              customer: s.customer,
              customerName: s.customerName || null,
              isCredit: s.sourceType === "credit" || s.type === "credit",
            })),
          ],

          totalNonCredit: [...paymentSplittingArray, ...restaurantSplitArray]
            .filter((s) => (s.sourceType || s.type) !== "credit")
            .reduce((sum, s) => sum + Number(s.amount || 0), 0),

          totalCredit: [...paymentSplittingArray, ...restaurantSplitArray]
            .filter((s) => (s.sourceType || s.type) === "credit")
            .reduce((sum, s) => sum + Number(s.amount || 0), 0),
        });
      }
      // ======================================================================
      // END OF MAIN LOOP
      // ======================================================================

      // ── Step 4: Create receipts and settlements ──────────────────────────
      // Single mode  → hotel receipt + restaurant receipt created
      // Split mode   → hotel pending=0 so hotel receipt skipped,
      //                restaurant receipt created from paymentSplittingData
      // Credit mode  → skipped entirely

      const totalHotelAmount = results.reduce((sum, result) => {
        const hotelAmount = (result.splitSummary || [])
          .filter((s) => s.section === "hotel")
          .reduce((acc, s) => acc + Number(s.amount || 0), 0);

        return sum + hotelAmount;
      }, 0);

      if (!isPostToRoom && paymentMode !== "credit" && totalHotelAmount > 0) {
        const customerPartyDoc = await getSelectedParty(
          selectedCheckOut[0]?.customerId?._id ||
            selectedCheckOut[0]?.customerId,
          cmp_id,
          session,
        );

        const guestPartyDoc = await getSelectedParty(
          selectedCheckOut[0]?.guestId?._id ||
            selectedCheckOut[0]?.guestId ||
            selectedCheckOut[0]?.customerId?._id ||
            selectedCheckOut[0]?.customerId,
          cmp_id,
          session,
        );

        const hotelTallyDoc = await TallyData.findById(
          results[0]?.tallyId,
        ).session(session);
        const hotelSales = results
          .map((result) => result?.salesRecord)
          .filter(Boolean);
        const hotelTallyDataList = results
          .flatMap((result) => result?.tallyRows || [])
          .filter(Boolean);

        if (!hotelTallyDoc && hotelTallyDataList.length === 0)
          throw new Error("Hotel TallyData not found after createTallyEntry");

        const specificVoucherSeriesReceipt = await hotelVoucherSeries(
          cmp_id,
          session,
          "receipt",
          false,
        );
        const specificVoucherSeriesReceiptRestaurant = await hotelVoucherSeries(
          cmp_id,
          session,
          "receipt",
          true,
        );

        console.log("hotelTallyData", hotelTallyDoc);

        await createReceiptsAndSettlements({
          paymentMode,
          paymentDetails,
          hotelSale: results[0]?.salesRecord,
          hotelTallyData: hotelTallyDoc,
          hotelSales,
          hotelTallyDataList,
          restaurantBaseSaleData: effectiveRestaurantBaseSaleData,
          customerPartyData: mapPartyData(customerPartyDoc),
          guestPartyData: mapPartyData(guestPartyDoc),
          cmp_id,
          specificVoucherSeries: specificVoucherSeriesReceipt,
          specificVoucherSeriesRestaurant:
            specificVoucherSeriesReceiptRestaurant,
          req,
          session,
        });
      }

      // ── Step 5: REMOVED ──────────────────────────────────────────────────
      // Credit-inside-split TallyData is now created per-split inside the
      // main loop above (tallyRows block, isCredit branch).
      // Keeping this block would create duplicate TallyData entries.

      multiCheckoutResults = results;
    });

    // ── Populate after transaction ───────────────────────────────────────────
    if (createdCheckoutIds.length > 0) {
      checkOutAfterSave = await CheckOut.find({
        _id: { $in: createdCheckoutIds },
      })
        .populate("customerId")
        .populate("guestId")
        .populate("agentId")
        .populate("isHotelAgent")
        .populate("selectedRooms.selectedPriceLevel")
        .populate("bookingId")
        .populate("checkInId")
        .lean();
    }

    res.status(200).json({
      success: true,
      message: isAnyPartial
        ? "Partial checkout(s) completed. Remaining rooms stay checked-in."
        : "Checkout(s) converted to Sales successfully",
      data: {
        results: multiCheckoutResults,
        checkOutAfterSave,
      },
    });
  } catch (error) {
    console.error("Error converting checkout:", error);
    if (error.code === 11000) {
  return res.status(409).json({
    success: false,
    message: "Checkout already processed. Please refresh.",
  });
}
    const isCheckoutConflict =
      error.message?.includes("already checked out") ||
      error.message?.includes("No rooms selected") ||
      error.message?.includes("Duplicate rooms selected");

    res.status(isCheckoutConflict ? 409 : 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    await session.endSession();
  }
};

// =============================================================================
// handleAdvanceAndDiscountSettlementInRestaurant
// =============================================================================
export const handleAdvanceAndDiscountSettlementInRestaurant = async (
  settlementData,
  selectedCheckOut,
  cmp_id,
  session,
) => {
  try {
    if (!Array.isArray(settlementData) || settlementData.length === 0)
      return true;
    if (!Array.isArray(selectedCheckOut) || selectedCheckOut.length === 0) {
      throw new Error("selectedCheckOut is required");
    }
    if (!cmp_id) throw new Error("Missing cmp_id");

    const safeSub = (value, deduct) => {
      const result = Number(value || 0) - Number(deduct || 0);
      return result > 0 ? result : 0;
    };

    const adjustSplitArray = (splitArray = [], deductAmount = 0) => {
      let remainingDeduction = Number(deductAmount || 0);

      const updatedSplits = (Array.isArray(splitArray) ? splitArray : [])
        .map((split) => {
          const currentAmount = Number(split.amount || 0);

          if (remainingDeduction <= 0) {
            return {
              ...split,
              amount: parseFloat(currentAmount.toFixed(2)),
            };
          }

          const deductNow = Math.min(currentAmount, remainingDeduction);
          const newAmount = currentAmount - deductNow;
          remainingDeduction -= deductNow;

          return {
            ...split,
            amount: parseFloat(newAmount.toFixed(2)),
          };
        })
        .filter((split) => Number(split.amount || 0) > 0);

      const updatedTotal = updatedSplits.reduce(
        (sum, split) => sum + Number(split.amount || 0),
        0,
      );

      return {
        updatedSplits,
        updatedTotal: parseFloat(updatedTotal.toFixed(2)),
      };
    };

    for (const item of settlementData) {
      const saleId = item?.saleId;
      if (!saleId) continue;

      const finalValue = Number(item.finalValue || 0);
      const advanceAmount = Number(item.advanceAmount || 0);
      const totalAmountToDeduct = finalValue + advanceAmount;

      if (totalAmountToDeduct <= 0) continue;

      const saleDoc = await salesModel
        .findOne({
          _id: saleId,
          cmp_id,
          isCancelled: false,
        })
        .session(session);

      if (!saleDoc) {
        throw new Error(`Restaurant sale not found: ${saleId}`);
      }

      let updatedAdditionalCharges = Array.isArray(saleDoc.additionalCharges)
        ? [...saleDoc.additionalCharges]
        : [];

      let updatedTotalAdditionalCharges = Number(
        saleDoc.totalAdditionalCharges || 0,
      );

      if (finalValue > 0) {
        const discountObject = {
          _id: item._id,
          option: "discount",
          value: item.value,
          action: "sub",
          taxPercentage: item.taxPercentage,
          taxAmt: item.taxAmt,
          hsn: item.hsn,
          finalValue,
        };

        updatedAdditionalCharges.push(discountObject);
        updatedTotalAdditionalCharges += finalValue;
      }

      const subTotal = Number(saleDoc.subTotal || 0);
      const updatedFinalAmount = safeSub(
        subTotal,
        updatedTotalAdditionalCharges,
      );

      const existingPaymentSplits = Array.isArray(saleDoc.paymentSplittingData)
        ? saleDoc.paymentSplittingData
        : [];

      const { updatedSplits, updatedTotal } = adjustSplitArray(
        existingPaymentSplits,
        totalAmountToDeduct,
      );

      await salesModel.updateOne(
        { _id: saleId },
        {
          $set: {
            additionalCharges: updatedAdditionalCharges,
            totalAdditionalCharges: updatedTotalAdditionalCharges,
            finalAmount: updatedFinalAmount,
            totalWithAdditionalCharges: updatedFinalAmount,
            totalPaymentSplits: updatedTotal,
            paymentSplittingData: updatedSplits,
          },
        },
        { session },
      );

      const saleTallies = await TallyData.find({
        billId: saleId,
        isCancelled: false,
      }).session(session);

      for (const tally of saleTallies) {
        const currentBillAmount = Number(tally.bill_amount || 0);
        const currentPendingAmount = Number(tally.bill_pending_amt || 0);

        const newBillAmount = safeSub(currentBillAmount, totalAmountToDeduct);
        const newPendingAmount = safeSub(
          currentPendingAmount,
          totalAmountToDeduct,
        );

        await TallyData.updateOne(
          { _id: tally._id },
          {
            $set: {
              bill_amount: newBillAmount,
              bill_pending_amt: newPendingAmount,
            },
          },
          { session },
        );

        const matchedReceipt = await receiptModel
          .findOne({
            "billData._id": tally._id,
            isCancelled: false,
          })
          .session(session);

        if (matchedReceipt) {
          const billRow = matchedReceipt.billData.find(
            (b) => String(b._id) === String(tally._id),
          );

          if (billRow) {
            const oldSettledAmount = Number(billRow.settledAmount || 0);
            const oldTotalBillAmount = Number(
              matchedReceipt.totalBillAmount || 0,
            );
            const oldEnteredAmount = Number(matchedReceipt.enteredAmount || 0);

            const receiptSettledReduction = Math.min(
              totalAmountToDeduct,
              oldSettledAmount,
            );

            const updatedBillPending = newPendingAmount;
            const updatedSettledAmount = safeSub(
              oldSettledAmount,
              receiptSettledReduction,
            );
            const updatedBillRemaining =
              updatedBillPending > 0 ? updatedBillPending : 0;

            const updatedReceiptTotalBill = safeSub(
              oldTotalBillAmount,
              totalAmountToDeduct,
            );

            const updatedReceiptEntered = safeSub(
              oldEnteredAmount,
              receiptSettledReduction,
            );

            const updatedReceiptRemaining =
              updatedReceiptTotalBill > updatedReceiptEntered
                ? updatedReceiptTotalBill - updatedReceiptEntered
                : 0;

            await receiptModel.updateOne(
              {
                _id: matchedReceipt._id,
                "billData._id": tally._id,
              },
              {
                $set: {
                  totalBillAmount: updatedReceiptTotalBill,
                  enteredAmount: updatedReceiptEntered,
                  remainingAmount: updatedReceiptRemaining,
                  "billData.$.bill_pending_amt": updatedBillPending,
                  "billData.$.settledAmount": updatedSettledAmount,
                  "billData.$.remainingAmount": updatedBillRemaining,
                },
              },
              { session },
            );
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      "Error in handleAdvanceAndDiscountSettlementInRestaurant:",
      error.message,
    );
    throw error;
  }
};
// =============================================================================
// hotelVoucherSeries
// =============================================================================
async function hotelVoucherSeries(cmp_id, session, from, isRestaurant = false) {
  const SaleVoucher = await VoucherSeriesModel.findOne({
    cmp_id,
    voucherType: from,
  }).session(session);
  console.log("Checking", from, isRestaurant, cmp_id);
  if (!SaleVoucher) throw new Error("Sale voucher not found");

  const specificVoucherSeries = SaleVoucher.series.find(
    (series) => series.under === (isRestaurant ? "restaurant" : "hotel"),
  );
  if (!specificVoucherSeries) throw new Error("No hotel voucher series found");

  return specificVoucherSeries;
}

// =============================================================================
// getSelectedParty
// =============================================================================
async function getSelectedParty(selected, cmp_id, session) {
  const selectedParty = await Party.findOne({ cmp_id, _id: selected })
    .populate("accountGroup")
    .session(session);
  if (!selectedParty) throw new Error("Party not found");
  return selectedParty;
}

// =============================================================================
// mapPartyData
// =============================================================================
function mapPartyData(selectedParty) {
  return {
    _id: selectedParty._id,
    partyName: selectedParty.partyName,
    accountGroup_id: selectedParty.accountGroup?._id,
    accountGroupName: selectedParty.accountGroup?.accountGroup,
    subGroup_id: selectedParty.subGroup_id || null,
    subGroupName: selectedParty.subGroupName || null,
    mobileNumber: selectedParty.mobileNumber || null,
    country: selectedParty.country || null,
    state: selectedParty.state || null,
    pin: selectedParty.pin || null,
    emailID: selectedParty.emailID || null,
    gstNo: selectedParty.gstNo || null,
    party_master_id: selectedParty.party_master_id || null,
    billingAddress: selectedParty.billingAddress || null,
    shippingAddress: selectedParty.shippingAddress || null,
    accountGroup: selectedParty.accountGroup?.toString() || null,
    totalOutstanding: selectedParty.totalOutstanding || 0,
    latestBillDate: selectedParty.latestBillDate || null,
    newAddress: selectedParty.newAddress || {},
  };
}

// =============================================================================
// createPaymentSplittingArray
// =============================================================================
async function createPaymentSplittingArray(
  paymentDetails,
  cashAmt,
  onlineAmt,
  applicableSplits = [],
  restaurantTotal,
  restaurantBaseSaleData,
  session,
) {
  const arr = [];
  const paymentMode = paymentDetails?.paymentMode;
  const restaurantSplitArray = [];

  const getCustomerId = (customer) => customer?._id ?? customer ?? undefined;

  if (paymentMode === "split" && applicableSplits.length > 0) {
    for (const split of applicableSplits) {
      const splitSourceType = split.sourceType;
      const isCredit = splitSourceType === "credit";
      const resolvedCustomerId = getCustomerId(split.customer);
      const resolvedSourceId = isCredit ? resolvedCustomerId : split.source;

      if (!resolvedSourceId) {
        throw new Error(
          `Missing source id for split sourceType=${splitSourceType}, underCategory=${split.underCategory}`,
        );
      }

      const splitObj = {
        paymentId: new mongoose.Types.ObjectId(),
        type: splitSourceType,
        amount: Number(split.amount || 0),
        ref_id: resolvedSourceId,
        customer: resolvedCustomerId,
        customerName: split.customerName,
        remarks: split.remarks ?? null,
        source: resolvedSourceId,
        sourceType: splitSourceType,
        subsource: split.subsource ?? splitSourceType,
        transactionNo: split.transactionNo ?? "",
        underCategory: split.underCategory,
        upiNo: split.upiNo ?? "",
        splitSaleId: split.splitSaleId || split.saleId || null,
      };

      if (split.underCategory === "room") {
        arr.push(splitObj);
      } else if (split.underCategory === "food") {
        restaurantSplitArray.push(splitObj);
      }
    }
  } else if (paymentMode === "credit") {
    const totalCreditAmount = Number(paymentDetails?.cashAmount || 0);
    const hotelCreditAmt = parseFloat(
      (totalCreditAmount - restaurantTotal).toFixed(2),
    );
    const creditorId = paymentDetails?.selectedCreditor?._id;
    const creditorName = paymentDetails?.selectedCreditor?.partyName;

    arr.push({
      type: "credit",
      amount: hotelCreditAmt,
      ref_id: creditorId,
      reference_name: creditorName,
      customer: getCustomerId(paymentDetails?.selectedCreditor),
      customerName: creditorName,
      remarks: paymentDetails?.remarks ?? null,
      source: creditorId,
      sourceType: "credit",
      subsource: creditorName,
      transactionNo: "",
      underCategory: "room",
      upiNo: "",
      paymentId: new mongoose.Types.ObjectId(),
    });

    restaurantSplitArray.push({
      type: "credit",
      amount: restaurantTotal,
      ref_id: creditorId,
      reference_name: creditorName,
      customer: getCustomerId(paymentDetails?.selectedCreditor),
      customerName: creditorName,
      remarks: paymentDetails?.remarks ?? null,
      source: creditorId,
      sourceType: "credit",
      subsource: creditorName,
      transactionNo: "",
      underCategory: "food",
      upiNo: "",
      paymentId: new mongoose.Types.ObjectId(),
    });
  } else {
    const split = paymentDetails?.splitDetails?.[0] ?? {};

    if (cashAmt > 0) {
      const hotelCashAmt = Math.max(0, cashAmt - restaurantTotal);
      const restaurantCashAmt = Math.min(cashAmt, restaurantTotal);

      if (hotelCashAmt > 0) {
        arr.push({
          type: "cash",
          amount: parseFloat(hotelCashAmt.toFixed(2)),
          ref_id: paymentDetails?.selectedCash,
          customer: getCustomerId(split?.customer),
          customerName: split?.customerName ?? null,
          remarks: split?.remarks ?? null,
          source: paymentDetails?.selectedCash,
          sourceType: "cash",
          subsource:
            paymentDetails?.cashSubsource ?? split?.subsource ?? "Cash",
          transactionNo: split?.transactionNo ?? "",
          underCategory: "room",
          upiNo: split?.upiNo ?? "",
          paymentId: new mongoose.Types.ObjectId(),
        });
      }

      if (restaurantCashAmt > 0) {
        restaurantSplitArray.push({
          type: "cash",
          amount: parseFloat(restaurantCashAmt.toFixed(2)),
          ref_id: paymentDetails?.selectedCash,
          customer: getCustomerId(split?.customer),
          customerName: split?.customerName ?? null,
          remarks: split?.remarks ?? null,
          source: paymentDetails?.selectedCash,
          sourceType: "cash",
          subsource:
            paymentDetails?.cashSubsource ?? split?.subsource ?? "Cash",
          transactionNo: split?.transactionNo ?? "",
          underCategory: "food",
          upiNo: split?.upiNo ?? "",
          paymentId: new mongoose.Types.ObjectId(),
        });
      }
    }

    if (onlineAmt > 0) {
      const restaurantAlreadyCovered = Math.min(cashAmt, restaurantTotal);
      const restaurantOnlineAmt = parseFloat(
        Math.min(
          onlineAmt,
          Math.max(0, restaurantTotal - restaurantAlreadyCovered),
        ).toFixed(2),
      );
      const hotelOnlineAmt = parseFloat(
        (onlineAmt - restaurantOnlineAmt).toFixed(2),
      );

      if (hotelOnlineAmt > 0) {
        arr.push({
          type: "bank",
          amount: hotelOnlineAmt,
          ref_id: paymentDetails?.selectedBank,
          customer: getCustomerId(split?.customer),
          customerName: split?.customerName ?? null,
          remarks: split?.remarks ?? null,
          source: paymentDetails?.selectedBank,
          sourceType: "bank",
          subsource:
            paymentDetails?.bankSubsource ?? split?.subsource ?? "Bank",
          transactionNo: split?.transactionNo ?? "",
          underCategory: "room",
          upiNo: split?.upiNo ?? "",
          paymentId: new mongoose.Types.ObjectId(),
        });
      }

      if (restaurantOnlineAmt > 0) {
        restaurantSplitArray.push({
          type: "bank",
          amount: restaurantOnlineAmt,
          ref_id: paymentDetails?.selectedBank,
          customer: getCustomerId(split?.customer),
          customerName: split?.customerName ?? null,
          remarks: split?.remarks ?? null,
          source: paymentDetails?.selectedBank,
          sourceType: "bank",
          subsource:
            paymentDetails?.bankSubsource ?? split?.subsource ?? "Bank",
          transactionNo: split?.transactionNo ?? "",
          underCategory: "food",
          upiNo: split?.upiNo ?? "",
          paymentId: new mongoose.Types.ObjectId(),
        });
      }
    }
  }

  // distribute restaurant splits into restaurant sale docs
  if (restaurantBaseSaleData.length > 0 && restaurantTotal > 0) {
    let splitsToDistribute = [];

    if (paymentMode === "split" && restaurantSplitArray.length > 0) {
      splitsToDistribute = restaurantSplitArray.map((s) => ({ ...s }));
    } else if (paymentMode === "credit") {
      const creditorId = paymentDetails?.selectedCreditor?._id;
      const creditorName = paymentDetails?.selectedCreditor?.partyName;

      splitsToDistribute.push({
        type: "credit",
        amount: restaurantTotal,
        ref_id: creditorId,
        reference_name: creditorName,
        customer: getCustomerId(paymentDetails?.selectedCreditor),
        customerName: creditorName,
        remarks: paymentDetails?.remarks ?? null,
        source: creditorId,
        sourceType: "credit",
        subsource: creditorName,
        transactionNo: "",
        underCategory: "food",
        upiNo: "",
        splitSaleId: null,
        paymentId: new mongoose.Types.ObjectId(),
      });
    } else {
      splitsToDistribute = restaurantSplitArray.map((s) => ({ ...s }));
    }

    // if splitSaleId exists, use exact mapping
    const hasMappedSaleIds = splitsToDistribute.some((s) => s.splitSaleId);

    if (hasMappedSaleIds) {
      const groupedRestaurantSplits = new Map();

      for (const split of splitsToDistribute) {
        const targetSaleId = String(split.splitSaleId || "");
        if (!targetSaleId) continue;

        if (!groupedRestaurantSplits.has(targetSaleId)) {
          groupedRestaurantSplits.set(targetSaleId, []);
        }

        groupedRestaurantSplits.get(targetSaleId).push({ ...split });
      }

      for (const saleItem of restaurantBaseSaleData) {
        const saleKey = String(saleItem._id);
        const itemSplits = groupedRestaurantSplits.get(saleKey) || [];
        const totalPaymentSplits = itemSplits.reduce(
          (sum, s) => sum + Number(s.amount || 0),
          0,
        );

        await salesModel.findOneAndUpdate(
          { _id: saleItem._id },
          {
            $set: {
              paymentSplittingData: itemSplits,
              totalPaymentSplits: parseFloat(totalPaymentSplits.toFixed(2)),
            },
          },
          { session, new: true },
        );
      }
    } else {
      // fallback old logic if splitSaleId not sent
      if (restaurantBaseSaleData.length === 1) {
        await salesModel.findOneAndUpdate(
          { _id: restaurantBaseSaleData[0]._id },
          {
            $set: {
              paymentSplittingData: splitsToDistribute,
              totalPaymentSplits: parseFloat(
                splitsToDistribute
                  .reduce((sum, s) => sum + Number(s.amount || 0), 0)
                  .toFixed(2),
              ),
            },
          },
          { session, new: true },
        );
      } else {
        let remainingSplits = splitsToDistribute.map((s) => ({ ...s }));

        for (const saleItem of restaurantBaseSaleData) {
          let remaining = Number(saleItem.finalAmount || 0);
          const itemSplits = [];

          for (const split of remainingSplits) {
            if (remaining <= 0) break;
            if (Number(split.amount || 0) <= 0) continue;

            const splitAmount = Number(split.amount || 0);

            if (splitAmount <= remaining) {
              itemSplits.push({ ...split, amount: splitAmount });
              remaining = parseFloat((remaining - splitAmount).toFixed(2));
              split.amount = 0;
            } else {
              itemSplits.push({ ...split, amount: remaining });
              split.amount = parseFloat((splitAmount - remaining).toFixed(2));
              remaining = 0;
            }
          }

          remainingSplits = remainingSplits.filter(
            (s) => Number(s.amount || 0) > 0,
          );

          const totalPaymentSplits = itemSplits.reduce(
            (sum, s) => sum + Number(s.amount || 0),
            0,
          );

          await salesModel.findOneAndUpdate(
            { _id: saleItem._id },
            {
              $set: {
                paymentSplittingData: itemSplits,
                totalPaymentSplits: parseFloat(totalPaymentSplits.toFixed(2)),
              },
            },
            { session, new: true },
          );
        }
      }
    }
  }

  return { arr, restaurantSplitArray };
}

// =============================================================================
// createSalesVoucher
// =============================================================================
async function createSalesVoucher(
  cmp_id,
  specificVoucherSeries,
  saleNumber,
  req,
  selectedCheckOut,
  party,
  selectedParty,
  paymentSplittingArray,
  session,
  checkInId = null,
  checkOutId = null,
  amount = 0,
  otherCharges,
  totalOtherChargeAmount,
  isPostToRoom = false,
) {
  const AlreadyExistingItems = selectedCheckOut.flatMap(
    (item) => item.selectedRooms,
  );
  let items = [];

  AlreadyExistingItems.forEach((room) => {
    items.push({
      product_name: room.roomName,
      product_code: room.roomName,
      cmp_id: room.cmp_id,
      Primary_user_id: room.primary_user_id,
      brand: room.roomType?._id || null,
      category: null,
      sub_category: null,
      unit: "Nos",
      item_mrp: Number(room.priceLevelRate) || 0,
      rate: Number(room.priceLevelRate) || 0,
      taxableAmount: Number(room.amountWithOutTax) || 0,
      total: Number(room.amountWithOutTax) || 0,
      netAmount: Number(room.amountAfterTax) || 0,
      totalCgstAmt: Number(room.totalCgstAmt) || 0,
      totalSgstAmt: Number(room.totalSgstAmt) || 0,
      totalIgstAmt: Number(room.totalIgstAmt) || 0,
      GodownList: [],
      batchEnabled: false,
      gdnEnabled: false,
      quantity: room.stayDays,
      hsn_code: room?.hsnDetails?.hsn,
      cgst: Number(room?.taxPercentage) / 2 || 0,
      sgst: Number(room?.taxPercentage) / 2 || 0,
      igst: room?.taxPercentage || 0,
      Priceleveles: room?.priceLevel || [],
      product_master_id: null,
    });
  });

  const convertedFrom = selectedCheckOut.map((item) => ({
    voucherNumber: item.voucherNumber,
    checkInNumber: item.voucherNumber,
  }));

  return await salesModel.create(
    [
      {
        date: new Date(req.body?.selectedSaleDate) || new Date(),
        selectedDate: new Date().toLocaleDateString(),
        voucherType: "sales",
        serialNumber: saleNumber.usedSeriesNumber,
        userLevelSerialNumber: saleNumber.usedSeriesNumber,
        salesNumber: saleNumber.voucherNumber,
        series_id: specificVoucherSeries._id.toString(),
        usedSeriesNumber: saleNumber.usedSeriesNumber,
        Primary_user_id: req.pUserId || req.owner,
        cmp_id,
        Secondary_user_id: req.sUserId,
        party,
        partyAccount: selectedParty.accountGroup?.accountGroup,
        items,
        address: selectedParty.billingAddress,
        finalAmount: Math.abs(amount - totalOtherChargeAmount),
        subTotal: amount,
        paymentSplittingData: paymentSplittingArray,
        convertedFrom,
        checkInId,
        checkOutId,
        additionalCharges: otherCharges,
        totalAdditionalCharges: -totalOtherChargeAmount,
        totalWithAdditionalCharges: Math.abs(amount - totalOtherChargeAmount),
        totalPaymentSplits: Math.abs(amount - totalOtherChargeAmount),
      },
    ],
    { session },
  );
}

// =============================================================================
// createTallyEntry
// =============================================================================
async function createTallyEntry(
  cmp_id,
  req,
  selectedParty,
  selectedCheckOut,
  savedVoucher,
  amount, // bill_amount
  pendingAmt, // bill_pending_amt  ← NEW param
  session,
  from = "other",
  paymentId,
) {
  const selectedOne = await Party.findOne({ _id: selectedParty }).session(
    session,
  );

  return await TallyData.create(
    [
      {
        Primary_user_id: req.pUserId || req.owner,
        cmp_id,
        party_id: selectedOne?._id,
        party_name: selectedOne?.partyName,
        mobile_no: selectedOne?.mobileNumber,
        bill_date: new Date(),
        bill_no: savedVoucher?.salesNumber,
        billId: savedVoucher?._id,
        bill_amount: amount,
        bill_pending_amt: pendingAmt, // ← was always `amount` before
        accountGroup: selectedOne?.accountGroup.toString(),
        user_id: req.sUserId,
        advanceAmount: 0,
        advanceDate: new Date(),
        classification: "Dr",
        source: "sales",
        paymentId,
        ...(from === "checkout" ? { cantChange: true } : {}),
      },
    ],
    { session },
  );
}

// =============================================================================
// saveSettlement — legacy helper (kept for non-checkout use)
// =============================================================================
async function saveSettlement(
  paymentDetails,
  selectedParty,
  selectedCashOrBank,
  cmp_id,
  savedVoucher,
  paidAmount,
  paymentMethod,
  req,
  session,
) {
  const selectedOne = await Party.findOne({ _id: selectedParty });
  await saveSettlemenntDataHotel(
    selectedOne,
    cmp_id,
    paymentMethod,
    "sales",
    savedVoucher?.salesNumber,
    savedVoucher?._id,
    paidAmount,
    new Date(),
    selectedOne?.partyName,
    selectedCashOrBank,
    "Sales",
    req,
    session,
  );
}

// =============================================================================
// updateReceiptForRooms
// =============================================================================
export const updateReceiptForRooms = async (
  bookingNumber,
  checkInNumber,
  saleNumber,
  saleId,
  session,
) => {
  const bookingNumberStr = String(bookingNumber);
  const checkInNumberStr = String(checkInNumber);

  const receiptArray = await receiptModel
    .find({
      "billData.bill_no": { $in: [bookingNumberStr, checkInNumberStr] },
    })
    .session(session);

  await Promise.all(
    receiptArray.map(async (receipt) => {
      receipt.billData = receipt.billData.map((bill) => {
        if (
          bill.bill_no === bookingNumberStr ||
          bill.bill_no === checkInNumberStr
        ) {
          return {
            ...bill,
            _id: new mongoose.Types.ObjectId(saleId),
            bill_no: saleNumber,
            billId: saleId,
          };
        }
        return bill;
      });
      await receipt.save({ session });
    }),
  );
};

// =============================================================================
// updateStatus — marks rooms dirty/available after checkout
// =============================================================================
export const updateStatus = async (roomData, status, session) => {
  await syncRoomStatus(roomData, status, session);
};
