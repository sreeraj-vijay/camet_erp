import invoiceModel from "../models/invoiceModel.js";
import receiptModel from "../models/receiptModel.js";
import paymentModel from "../models/paymentModel.js";
import salesModel from "../models/salesModel.js";
import stockTransferModel from "../models/stockTransferModel.js";
import TransactionModel from "../models/TransactionModel.js";
import vanSaleModel from "../models/vanSaleModel.js";
import purchaseModel from "../models/purchaseModel.js";
import VoucherSeriesModel from "../models/VoucherSeriesModel.js";
import OrganizationModel from "../models/OragnizationModel.js";
import { getNewSerialNumber } from "../helpers/secondaryHelper.js";
import { generateVoucherNumber } from "../helpers/voucherHelper.js";
import mongoose from "mongoose";
import { CheckOut } from "../models/bookingModal.js";

export const fetchData = async (type, cmp_id, serialNumber, res, userId) => {
  let model;
  let voucherType; // For series lookup

  switch (type) {
    case "invoices":
      model = invoiceModel;
      voucherType = "saleOrder";
      break;
    case "sales":
      model = salesModel;
      voucherType = "sales";
      break;
    case "vanSales":
      model = vanSaleModel;
      voucherType = "vanSale";
      break;
    case "purchase":
      model = purchaseModel;
      voucherType = "purchase";
      break;
    case "transactions":
      model = TransactionModel;
      voucherType = "transactions";
      break;
    case "stockTransfers":
      model = stockTransferModel;
      voucherType = "stockTransfer";
      break;
    case "receipt":
      model = receiptModel;
      voucherType = "receipt";
      break;
    case "payment":
      model = paymentModel;
      voucherType = "payment";
      break;
    default:
      return res.status(400).json({ message: "Invalid type parameter" });
  }

  try {
    let query = {
      cmp_id: new mongoose.Types.ObjectId(cmp_id),
    };

    // Special case for vanSales when userId is present
    if (type === "vanSales" && userId) {
      // Use userLevelSerialNumber for vanSales with userId
      if (serialNumber) {
        query.userLevelSerialNumber = { $gt: serialNumber };
        query.Secondary_user_id = new mongoose.Types.ObjectId(userId);
      }
    } else {
      // Default behavior for all other cases
      if (serialNumber) {
        query.serialNumber = { $gt: serialNumber };
      }
    }

    const data = await model.find(query).lean();

    if (data.length === 0) {
      return res.status(404).json({ message: `${type} not found` });
    }

    // Extract unique series_ids from all documents
    const seriesIds = [
      ...new Set(
        data
          .filter((doc) => doc.series_id)
          .map((doc) => doc.series_id.toString()),
      ),
    ];

    const checkoutNumber = [
      ...new Set(
        data
          .filter((doc) => doc.salesNumber)
          .map((doc) => doc.salesNumber.toString()),
      ),
    ];

    // Fetch all series documents in one query
    let seriesMap = new Map();
    if (seriesIds.length > 0) {
      const seriesDocuments = await VoucherSeriesModel.find({
        cmp_id: new mongoose.Types.ObjectId(cmp_id),
        voucherType: voucherType, // Use voucherType instead of type
        "series._id": {
          $in: seriesIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      }).lean();

      // Create a map for O(1) lookup: series_id -> series details
      seriesDocuments.forEach((seriesDoc) => {
        if (seriesDoc.series && Array.isArray(seriesDoc.series)) {
          seriesDoc.series.forEach((series) => {
            // Store only required fields
            seriesMap.set(series._id.toString(), {
              seriesName: series.seriesName,
              prefix: series.prefix,
              suffix: series.suffix,
              under: series.under ? series.under : "others",
            });
          });
        }
      });
    }

    let checkoutMap = new Map();

    if (type === "sales" && checkoutNumber.length > 0) {
      const checkout = await CheckOut.find({
        cmp_id: new mongoose.Types.ObjectId(cmp_id),
        voucherNumber: {
          $in: checkoutNumber,
        },
      })
        .select("voucherNumber selectedRooms -_id")
        .lean();

      checkout.forEach((doc) => {
        if (!doc?.voucherNumber) return;

        const selectedRooms = Array.isArray(doc.selectedRooms)
          ? doc.selectedRooms
          : [];

        const totalFoodPlanAmount = selectedRooms.reduce(
          (total, room) => total + Number(room?.foodPlanAmountWithTax || 0),
          0,
        );

        const taxableFoodPlanAmount = selectedRooms.reduce(
          (total, room) => total + Number(room?.foodPlanAmountWithOutTax || 0),
          0,
        );

        checkoutMap.set(doc.voucherNumber.toString(), {
          totalFoodPlanAmount,
          taxableFoodPlanAmount,
          foodPlanTaxAmount: totalFoodPlanAmount - taxableFoodPlanAmount,
        });
      });
    }

    // For receipt and payment, return full data without processing
    if (type === "receipt" || type === "payment") {
      const processedData = data.map((doc) => {
        const processedDoc = { ...doc };
        processedDoc.party.billData = doc.billData;
        delete processedDoc.billData;

        // Attach series details if available
        if (doc.series_id && seriesMap.has(doc.series_id.toString())) {
          processedDoc.seriesDetails = seriesMap.get(doc.series_id.toString());
        }

        return processedDoc;
      });

      return res.status(200).json({
        message: `${type} fetched`,
        data: processedData,
      });
    }

    // For other document types, process GodownList and Priceleveles
    const processedData = data.map((document) => {
      let processedDocument = { ...document };

      // Attach series details if available
      if (document.series_id && seriesMap.has(document.series_id.toString())) {
        processedDocument.seriesDetails = seriesMap.get(
          document.series_id.toString(),
        );
      }
      if (
        type === "sales" &&
        document.salesNumber &&
        checkoutMap.has(document.salesNumber.toString())
      ) {
        const foodPlanDetails = checkoutMap.get(
          document.salesNumber.toString(),
        );

        processedDocument.totalFoodPlanAmount =
          foodPlanDetails.totalFoodPlanAmount || 0;

        processedDocument.taxableFoodPlanAmount =
          foodPlanDetails.taxableFoodPlanAmount || 0;

        processedDocument.foodPlanTaxAmount =
          foodPlanDetails.foodPlanTaxAmount || 0;
      }
      // Skip processing if no items array
      if (!Array.isArray(document.items)) {
        return processedDocument;
      }

      processedDocument.items = document.items.map((item) => {
        const processedItem = { ...item };

        // Filter Priceleveles array to match document's priceLevel
        if (Array.isArray(item.Priceleveles) && document.priceLevel) {
          processedItem.Priceleveles = item.Priceleveles.filter(
            (price) => price.pricelevel === document.priceLevel,
          );
        }

        // Process GodownList if it exists
        if (Array.isArray(item.GodownList)) {
          if (item.hasGodownOrBatch === true) {
            processedItem.GodownList = item.GodownList.filter(
              (godown) => godown.added === true,
            );
          }
        }

        return processedItem;
      });

      return processedDocument;
    });

    return res.status(200).json({
      message: `${type} fetched`,
      data: processedData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

const round = (num) => Number(Number(num || 0).toFixed(2));

const calculateTaxAmount = (
  taxPercentage,
  roomPrice,
  addTaxWithRate,
  foodPlanArray,
  roomId,
  bookingType,
  stayDays,
  additionalPaxDetails,
  doc,
) => {
  let foodPlanTax = 5;
  //  addFoodPlanWithRate
  //         addPaxWithRate
  if (bookingType === "offline") {
    foodPlanTax = taxPercentage;
  }

  // Food plan total including tax
  let specificFoodPlanTotal =
    (foodPlanArray || []).reduce(
      (acc, item) =>
        item.roomId?.toString() === roomId?.toString()
          ? acc + Number(item.rate || 0)
          : acc,
      0,
    ) * Number(stayDays || 1);

  let specificAdditionalPaxDetails =
    (additionalPaxDetails || []).reduce(
      (acc, item) =>
        item.roomId?.toString() === roomId?.toString()
          ? acc + Number(item.rate || 0)
          : acc,
      0,
    ) * Number(stayDays || 1);

  // Food plan taxable amount
  let taxableSpecificFoodPlan = specificFoodPlanTotal / (1 + foodPlanTax / 100);
  const additionalPaxTaxableAmount =
    Number(specificAdditionalPaxDetails) / (1 + Number(taxPercentage) / 100);
  // additionalPax  taxable amount

  const additionalPaxTaxAmount =
    Number(specificAdditionalPaxDetails) - additionalPaxTaxableAmount;

  console.log(doc.addFoodPlanWithRate);
  console.log(doc.addPaxWithRate);

  let originalRoomPrice = roomPrice * Number(stayDays || 1);
  // Room amount including tax
  let amountWithTax = Math.max(
    0,
    Number(originalRoomPrice || 0) -
      ((doc.addFoodPlanWithRate ? Number(specificFoodPlanTotal || 0) : 0) +
        (doc.addPaxWithRate ? Number(specificAdditionalPaxDetails || 0) : 0)),
  );

  // Room taxable amount
  let taxableAmount = amountWithTax / (1 + taxPercentage / 100);

  // Room tax amount
  let roomTaxAmount = amountWithTax - taxableAmount + additionalPaxTaxAmount;

  // Food plan tax amount
  let foodPlanTaxAmount = specificFoodPlanTotal - taxableSpecificFoodPlan;
  // Food plan tax amount

  return {
    taxableAmount,
    roomTaxAmount,
    specificFoodPlanTotal: specificFoodPlanTotal,
    taxableSpecificFoodPlan,
    foodPlanTaxAmount,
    foodPlanTaxPercentage: foodPlanTax,
    additionalPaxWithTax: additionalPaxTaxableAmount + additionalPaxTaxAmount,
    additionalPaxWithoutTax: additionalPaxTaxableAmount,
    additionalPaxTaxAmount: additionalPaxTaxAmount,
  };
};

export const fetchDataHotel = async (
  type,
  cmp_id,
  serialNumber,
  res,
  userId,
) => {
  let model;
  let voucherType;

  switch (type) {
    case "invoices":
      model = invoiceModel;
      voucherType = "saleOrder";
      break;

    case "sales":
      model = salesModel;
      voucherType = "sales";
      break;

    case "vanSales":
      model = vanSaleModel;
      voucherType = "vanSale";
      break;

    case "purchase":
      model = purchaseModel;
      voucherType = "purchase";
      break;

    case "transactions":
      model = TransactionModel;
      voucherType = "transactions";
      break;

    case "stockTransfers":
      model = stockTransferModel;
      voucherType = "stockTransfer";
      break;

    case "receipt":
      model = receiptModel;
      voucherType = "receipt";
      break;

    case "payment":
      model = paymentModel;
      voucherType = "payment";
      break;

    default:
      return res.status(400).json({ message: "Invalid type parameter" });
  }

  try {
    let query = {
      cmp_id: new mongoose.Types.ObjectId(cmp_id),
    };

    if (type === "vanSales" && userId) {
      if (serialNumber) {
        query.userLevelSerialNumber = {
          $gt: serialNumber,
        };

        query.Secondary_user_id = new mongoose.Types.ObjectId(userId);
      }
    } else {
      if (serialNumber && type == "sales") {
        query.uniqueSaleNumber = {
          $gt: serialNumber,
        };
      } else {
        query.uniqueReceiptNumber = { $gt: serialNumber };
      }
    }

    console.log(model, query);

    const data = await model.find(query).lean();

    if (data.length === 0) {
      return res.status(404).json({ message: `${type} not found` });
    }

    // =========================
    // SERIES
    // =========================

    const seriesIds = [
      ...new Set(
        data
          .filter((doc) => doc.series_id)
          .map((doc) => doc.series_id.toString()),
      ),
    ];

    const checkoutNumber = [
      ...new Set(
        data
          .filter((doc) => doc.salesNumber)
          .map((doc) => doc.salesNumber.toString()),
      ),
    ];

    let seriesMap = new Map();

    if (seriesIds.length > 0) {
      const seriesDocuments = await VoucherSeriesModel.find({
        cmp_id: new mongoose.Types.ObjectId(cmp_id),

        voucherType,

        "series._id": {
          $in: seriesIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      }).lean();

      seriesDocuments.forEach((seriesDoc) => {
        if (seriesDoc.series && Array.isArray(seriesDoc.series)) {
          seriesDoc.series.forEach((series) => {
            seriesMap.set(series._id.toString(), {
              seriesName: series.seriesName,
              prefix: series.prefix,
              suffix: series.suffix,
              under: series.under || "others",
            });
          });
        }
      });
    }

    // =========================
    // CHECKOUT
    // =========================

    let checkoutMap = new Map();

    if (type === "sales" && checkoutNumber.length > 0) {
      const checkout = await CheckOut.find({
        cmp_id: new mongoose.Types.ObjectId(cmp_id),

        voucherNumber: {
          $in: checkoutNumber,
        },
      })
        .select(
          `
          voucherNumber
          selectedRooms
          _id
          foodPlan
          additionalPaxDetails
          addTaxWithRate
          bookingType
          stayDays
          paxTotal
          cmp_id
          Primary_user_id
          arrivalDate
          checkOutDate
          addTaxWithRate
          addTax
          addFoodPlanWithRate
          addPaxWithRate
          `,
        )
        .lean();
      await Promise.all(
        checkout.map(async (doc) => {
          console.log(doc);
          if (!doc?.voucherNumber) return;

          const selectedRooms = Array.isArray(doc.selectedRooms)
            ? doc.selectedRooms
            : [];

          let totalFoodPlanAmount = 0;

          let taxableFoodPlanAmount = 0;

          let newItemsArranged = await Promise.all(
            selectedRooms.map(async (room) => {
              let stayDays = await calculateStayDays(doc, room);
              if (stayDays === 0) {
                return null;
              }

              if (doc.voucherNumber == "SJRR/0325/26-27") {
                console.log({
                  room: room.roomName,
                  isSwapped: room.isSwapped,
                  swappingDateFrom: room.swappingDateFrom,
                  arrivalDate: doc.arrivalDate,
                  checkOutDate: doc.checkOutDate,
                });
                console.log("stayDays", stayDays, doc.voucherNumber);
              }

              if (room.priceLevelRate == 0) {
                return null;
              }

              let taxDetails = calculateTaxAmount(
                room.taxPercentage,
                room?.priceLevelRate,
                doc?.addTaxWithRate,
                doc?.foodPlan,
                room?.roomId,
                doc?.bookingType,
                stayDays,
                doc?.additionalPaxDetails,
                doc,
              );

              ((totalFoodPlanAmount =
                totalFoodPlanAmount +
                Number(taxDetails?.specificFoodPlanTotal)),
                (taxableFoodPlanAmount =
                  taxableFoodPlanAmount +
                  Number(taxDetails?.taxableSpecificFoodPlan)));
              return {
                _id: room._id,
                product_name: room?.roomName,

                cmp_id: doc?.cmp_id,

                balance_stock: 0,

                Primary_user_id: doc?.Primary_user_id,

                category: null,
                sub_category: null,

                unit: "NOS",

                GodownList: [],

                hsn_code: room?.hsnDetails?.hsn,

                cgst: (Number(room?.taxPercentage) / 2).toFixed(2),

                sgst: (Number(room?.taxPercentage) / 2).toFixed(2),

                igst: Number(room?.taxPercentage).toFixed(2),

                batchEnabled: false,
                gdnEnabled: false,

                Priceleveles: room.priceLevel,

                hasGodownOrBatch: false,

                totalCount: stayDays,

                totalActualCount: stayDays,

                total: room?.amountAfterTax,

                totalCgstAmt: (taxDetails?.roomTaxAmount / 2).toFixed(2),

                totalSgstAmt: (taxDetails?.roomTaxAmount / 2).toFixed(2),

                totalIgstAmt: (taxDetails?.roomTaxAmount).toFixed(2),

                totalCessAmt: 0,

                totalAddlCessAmt: 0,

                added: true,

                taxInclusive: true,

                under: "room",

                taxableAmount: taxDetails?.taxableAmount.toFixed(2),

                foodPlanTaxableAmount:
                  taxDetails?.taxableSpecificFoodPlan.toFixed(2),

                foodPlanTaxAmount:
                  (Math.floor(taxDetails?.foodPlanTaxAmount * 100) - 1) / 100,

                foodPlanTaxPercentage:
                  taxDetails?.foodPlanTaxPercentage.toFixed(2),

                foodPlanAmountWithTax:
                  taxDetails?.specificFoodPlanTotal.toFixed(2),

                additionalPaxWithTax:
                  taxDetails?.additionalPaxWithTax.toFixed(2),

                additionalPaxWithoutTax:
                  taxDetails?.additionalPaxWithoutTax.toFixed(2),
                additionalPaxTaxAmount:
                  taxDetails?.additionalPaxTaxAmount.toFixed(2),

                additionalPaxTaxPercentage: Number(room?.taxPercentage).toFixed(
                  2,
                ),

                paxTotal: doc?.paxTotal,
              };
            }),
          );
          newItemsArranged = newItemsArranged.filter(Boolean);

          // console.log("newItemsArranged", newItemsArranged);

          checkoutMap.set(doc.voucherNumber.toString(), {
            totalFoodPlanAmount,

            taxableFoodPlanAmount,

            foodPlanTaxAmount: round(
              totalFoodPlanAmount - taxableFoodPlanAmount,
            ),

            selectedRooms: newItemsArranged,
          });
        }),
      );
    }

    // =========================
    // RECEIPT / PAYMENT
    // =========================

    if (type === "receipt" || type === "payment") {
      const processedData = data.map((doc) => {
        const processedDoc = { ...doc };

        processedDoc.party.billData = doc.billData;

        delete processedDoc.billData;

        if (doc.series_id && seriesMap.has(doc.series_id.toString())) {
          processedDoc.seriesDetails = seriesMap.get(doc.series_id.toString());
        }

        return processedDoc;
      });

      return res.status(200).json({
        message: `${type} fetched`,
        data: processedData,
      });
    }

    // =========================
    // MAIN PROCESSING
    // =========================

    const processedData = data.map((document) => {
      let processedDocument = { ...document };

      if (document.series_id && seriesMap.has(document.series_id.toString())) {
        processedDocument.seriesDetails = seriesMap.get(
          document.series_id.toString(),
        );
      }

      if (
        type === "sales" &&
        document.salesNumber &&
        checkoutMap.has(document.salesNumber.toString())
      ) {
        const foodPlanDetails = checkoutMap.get(
          document.salesNumber.toString(),
        );

        processedDocument.totalFoodPlanAmount =
          foodPlanDetails.totalFoodPlanAmount || 0;

        processedDocument.taxableFoodPlanAmount =
          foodPlanDetails.taxableFoodPlanAmount || 0;

        processedDocument.foodPlanTaxAmount =
          foodPlanDetails.foodPlanTaxAmount || 0;

        processedDocument.items = foodPlanDetails.selectedRooms || [];
      } else {
        if (
          Array.isArray(processedDocument.items) &&
          processedDocument.items.length > 0
        ) {
          processedDocument.items.forEach((item) => {
            item.under = "restaurant";
          });
        }
      }

      // Skip if no items
      if (!Array.isArray(processedDocument.items)) {
        return processedDocument;
      }

      processedDocument.items = processedDocument.items.map((item) => {
        const processedItem = { ...item };

        // Filter price levels
        if (Array.isArray(item.Priceleveles) && document.priceLevel) {
          processedItem.Priceleveles = item.Priceleveles.filter(
            (price) => price.pricelevel === document.priceLevel,
          );
        }

        // Filter godown
        if (Array.isArray(item.GodownList)) {
          if (item.hasGodownOrBatch === true) {
            processedItem.GodownList = item.GodownList.filter(
              (godown) => godown.added === true,
            );
          }
        }

        return processedItem;
      });

      return processedDocument;
    });

    return res.status(200).json({
      message: `${type} fetched`,
      data: processedData,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
export const getApiLogs = async (cmp_id, dataName) => {
  const company = await OrganizationModel.findById(cmp_id)
    .lean()
    .select("name");

  const currentTime = new Date();
  const standardTime = currentTime.toISOString();
  const indianTime = currentTime.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  console.log(
    `${dataName} added By ${
      company.name || "N/A"
    }  (${cmp_id}) company at standard time ${standardTime} and indian time ${indianTime}`,
  );
};

export const createReceiptForSalesFully = async (cmp) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    console.log("🔵 Transaction started");

    const sales = await salesModel.find({ cmp_id: cmp }).session(session);
    console.log(`🔵 Found ${sales.length} sales`);

    const voucher = await VoucherSeriesModel.findOne({
      cmp_id: cmp,
      voucherType: "receipt",
    }).session(session);
    console.log("🔵 Voucher fetched:", voucher?._id);

    let count = 0;
    for (const sale of sales) {
      count++;
      console.log(`🔵 Processing sale ${count}:`, sale._id);
      try {
        await createReceipt(sale, count, cmp, session, voucher);
        console.log(`✅ Receipt created for sale ${count}`);
      } catch (innerErr) {
        // This catches what was previously swallowed
        console.error(
          `❌ FAILED at sale ${count}:`,
          innerErr.message,
          innerErr.code,
        );
        throw innerErr; // re-throw to abort
      }
    }

    console.log("🔵 Committing...");
    await session.commitTransaction();
    console.log("✅ Committed");
    return { success: true };
  } catch (error) {
    console.error("❌ Transaction error:", error.message, "code:", error.code);
    if (session.transaction.isActive) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

// const createReceipt = async (sale, count) => {
//  if(sale.partyType !== "party"){
//   return
//  }

//   const voucher = await VoucherSeriesModel.findOne({
//     cmp_id: orgId,
//     voucherType: "receipt",
//   }).session(session);

//   let under = sale.isPostToRoom ? "restaurant" : "hotel";

//   const series_idReceipt = voucher?.series
//     ?.find((s) => s.under === under)
//     ?._id.toString();

//   const serialNumber = await getNewSerialNumber(
//     ReceiptModel,
//     "serialNumber",
//     // session,
//   );

//   const receiptVoucher = await generateVoucherNumber(
//     (orgId = sale.cmp_id),
//     "sales",
//     "receipt",
//      series_idReceipt,
//     // session,
//   );

//   if(sale.paymentSplittingData?.length > 0){

//     sale.paymentSplittingData.forEach(async (data) => {

//     let billData = [{
//     _id: sale._id.toString(),
//     bill_no: sale.salesNumber,
//     billId: sale._id.toString(),
//     bill_date: sale.date,
//     bill_pending_amt: 0,
//     source: "sales",
//     settledAmount: data.amount,
//     remainingAmount: 0
//   }]
//   let selectedPArty = {...party,billData}
//   let paymentDetails = {
//     _id:data?.source,
//     cash_ledname: data.type == "cash" ? data?.subsource : null || "cash",
//     cash_name: data.type == "cash" ? data?.subsource : null || "cash",
//     bank_ledname: data.type == "bank" ? data?.subsource : null,
//     bank_name:  data.type == "bank" ? data?.subsource : null,
//   }

//       const receipt = new ReceiptModel({
//         date: sale.date,
//         voucherType: "receipt",
//         serialNumber: serialNumber,
//         receiptNumber: receiptVoucher.voucherNumber,
//         series_id: series_idReceipt,
//         usedSeriesNumber : receiptVoucher.usedSeriesNumber,
//         cmp_id: sale.cmp_id,
//         party: selectedPArty,
//         totalBillAmount: data.amount,
//         enteredAmount: data.amount,
//         advanceAmount: 0,
//         remainingAmount: 0,
//         paymentMethod: data.type == "cash" ? "Cash" : "Bank",
//         paymentDetails: paymentDetails,
//         note: null,

//       });

//   }

// }
// }
const createReceipt = async (sale, count, orgId, session) => {
  console.log("partyType", sale);
  if (sale.party.partyType !== "party") {
    return;
  }

  const voucher = await VoucherSeriesModel.findOne({
    cmp_id: orgId,
    voucherType: "receipt",
  }).session(session);

  let under = sale.isPostToRoom ? "restaurant" : "hotel";

  const series_idReceipt = voucher?.series
    ?.find((s) => s.under === under)
    ?._id.toString();

  if (sale.paymentSplittingData?.length > 0) {
    for (const data of sale.paymentSplittingData) {
      const serialNumber = 1;

      const receiptVoucher = await generateVoucherNumber(
        orgId,
        "receipt",
        series_idReceipt,
        session,
      );

      let billData = [
        {
          _id: sale._id.toString(),
          bill_no: sale.salesNumber,
          billId: sale._id.toString(),
          bill_date: sale.date,
          bill_pending_amt: 0,
          source: "sales",
          settledAmount: data.amount,
          remainingAmount: 0,
        },
      ];

      let selectedParty = {
        ...sale?.party,
        billData,
      };

      let paymentDetails = {
        _id: data?.source,

        cash_ledname: data.type === "cash" ? data?.subsource || "cash" : null,

        cash_name: data.type === "cash" ? data?.subsource || "cash" : null,

        bank_ledname: data.type === "bank" ? data?.subsource : null,

        bank_name: data.type === "bank" ? data?.subsource : null,
      };

      const receipt = new receiptModel({
        date: sale.date,
        voucherType: "receipt",

        serialNumber,

        receiptNumber: receiptVoucher.voucherNumber,

        series_id: series_idReceipt,

        usedSeriesNumber: receiptVoucher.usedSeriesNumber,

        Primary_user_id: sale.Primary_user_id,
        cmp_id: sale.cmp_id,

        party: selectedParty,

        totalBillAmount: data.amount,

        enteredAmount: data.amount,

        advanceAmount: 0,

        remainingAmount: 0,

        paymentMethod: data.type === "cash" ? "Cash" : "Online",

        paymentDetails,

        note: null,
      });

      await receipt.save({
        session,
      });
    }
  }
};

export const calculateStayDays = async (doc, room) => {
  let fullDaysAre = doc.stayDays;
  const normalizeToDate = (d) => {
    const nd = new Date(d);
    nd.setUTCHours(0, 0, 0, 0);
    return nd;
  };
  const swapDate = room?.swappingDateFrom
    ? new Date(room.swappingDateFrom).toISOString().split("T")[0]
    : "";


  if (room.isSwapped && room.swappingDateFrom) {
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

    if (swappedRoomObject?.toRoomId) {
      let swappedRoomData = doc?.selectedRooms.find(
        (r) =>
          swappedRoomObject?.toSelectedRoomId
            ? String(r?._id || "") === String(swappedRoomObject.toSelectedRoomId)
            : String(r?.roomId?._id || r?.roomId || "") ===
              String(swappedRoomObject?.toRoomId?._id || swappedRoomObject?.toRoomId || ""),
      );
      let isRoomSwappedData = doc?.roomSwapHistory?.find(
        (r) =>
          r?.toSelectedRoomId && currentSelectedRoomId
            ? String(r.toSelectedRoomId) === currentSelectedRoomId
            : String(r?.toRoomId?._id || r?.toRoomId || "") === currentRoomId,
      );

      if (swappedRoomData?.isSwapped === false && isRoomSwappedData) {
        arrivalDate = normalizeToDate(swappedRoomData.swappingDateFrom);
        arrivalDate.setDate(arrivalDate.getDate() - 1);
      } else {
        console.log(room);
        arrivalDate = normalizeToDate(doc.arrivalDate);
        swappingDate = normalizeToDate(room.swappingDateFrom);
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

    if (fullDaysAre <= 0) {
      if (swapDate == doc.arrivalDate) {
        fullDaysAre = 1;
      } else {
        fullDaysAre = 0;
      }
    }
  }

  return fullDaysAre;
};
