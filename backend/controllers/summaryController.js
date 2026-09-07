import { startOfDay, endOfDay, parseISO } from "date-fns";
import salesModel from "../models/salesModel.js";
import invoiceModel from "../models/invoiceModel.js";
import vanSaleModel from "../models/vanSaleModel.js";
import purchaseModel from "../models/purchaseModel.js";
import { aggregateSummary } from "../helpers/summaryHelper.js";
import debitNoteModel from "../models/debitNoteModel.js";
import creditNoteModel from "../models/creditNoteModel.js";
import OrganizationModel from "../models/OragnizationModel.js";
import RoomModel from "../models/roomModal.js";
import VoucherSeriesModel from "../models/VoucherSeriesModel.js";
import receiptModel from "../models/receiptModel.js";
import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getSelectedISTDateParts = (selectedDateInput) => {
  if (selectedDateInput) {
    const match = String(selectedDateInput).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      throw new Error("Invalid date format. Expected YYYY-MM-DD");
    }

    return {
      year: Number(match[1]),
      monthIndex: Number(match[2]) - 1,
      day: Number(match[3]),
    };
  }

  const nowIST = new Date(Date.now() + IST_OFFSET_MS);

  return {
    year: nowIST.getUTCFullYear(),
    monthIndex: nowIST.getUTCMonth(),
    day: nowIST.getUTCDate(),
  };
};

const getISTBoundaryDate = ({
  year,
  monthIndex,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
}) =>
  new Date(
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) -
      IST_OFFSET_MS,
  );

const getISTDateRanges = (selectedDateInput) => {
  const { year, monthIndex, day } = getSelectedISTDateParts(selectedDateInput);

  const selectedStartIST = getISTBoundaryDate({
    year,
    monthIndex,
    day,
  });

  const selectedEndIST = getISTBoundaryDate({
    year,
    monthIndex,
    day,
    hours: 23,
    minutes: 59,
    seconds: 59,
    milliseconds: 999,
  });

  const monthStartIST = getISTBoundaryDate({
    year,
    monthIndex,
    day: 1,
  });

  const monthEndIST = getISTBoundaryDate({
    year,
    monthIndex: monthIndex + 1,
    day: 0,
    hours: 23,
    minutes: 59,
    seconds: 59,
    milliseconds: 999,
  });

  return {
    selectedStartIST,
    selectedEndIST,
    monthStartIST,
    monthEndIST,
  };
};

export const getSummary = async (req, res) => {
  const {
    startOfDayParam,
    endOfDayParam,
    selectedVoucher,
    summaryType,
    selectedOption,
  } = req.query;

  try {
    const cmp_id = req.params.cmp_id;
    const companyObjectId = new mongoose.Types.ObjectId(cmp_id);

    // ---------------- DATE FILTER ----------------
    let dateFilter = {};
    if (startOfDayParam && endOfDayParam) {
      const startDate = parseISO(startOfDayParam);
      const endDate = parseISO(endOfDayParam);
      dateFilter = {
        date: {
          $gte: startOfDay(startDate),
          $lte: endOfDay(endDate),
        },
      };
    }

    const matchCriteria = {
      ...dateFilter,
      cmp_id: companyObjectId,
    };

    // ---------------- CONFIG ----------------
    const config = {
      "sales summary": {
        alltype: [
          { model: salesModel, billField: "salesNumber" },
          { model: vanSaleModel, billField: "salesNumber" },
          { model: creditNoteModel, billField: "creditNoteNumber" },
        ],
        sale: [{ model: salesModel, billField: "salesNumber" }],
        vansale: [{ model: vanSaleModel, billField: "salesNumber" }],
        creditnote: [{ model: creditNoteModel, billField: "creditNoteNumber" }],
      },

      "purchase summary": {
        alltype: [
          { model: purchaseModel, billField: "purchaseNumber" },
          { model: debitNoteModel, billField: "debitNoteNumber" },
        ],
        purchase: [{ model: purchaseModel, billField: "purchaseNumber" }],
        debitnote: [{ model: debitNoteModel, billField: "debitNoteNumber" }],
      },

      "order summary": {
        saleorder: [{ model: invoiceModel, billField: "orderNumber" }],
      },
    };

    const selectedSummary = config[summaryType.toLowerCase()];
    if (!selectedSummary) throw new Error("Invalid summaryType");

    const selectedModels = selectedSummary[selectedVoucher.toLowerCase()];
    if (!selectedModels) throw new Error("Invalid voucherType");

    // ---------------- GROUP ID ----------------
    let groupId = {};
    switch (selectedOption) {
      case "Ledger":
        groupId = {
          partyName: "$party.partyName",
          itemName: "$items.product_name",
        };
        break;
      case "Stock Category":
        groupId = { categoryName: "$categoryInfo.category" };
        break;
      case "Stock Group":
        groupId = { groupName: "$brandInfo.brand" };
        break;
      case "voucher":
      case "Stock Item":
      default:
        groupId = { itemName: "$items.product_name" };
    }

    const pipelines = [];

    // ---------------- AGGREGATION ----------------
    for (const { model, billField } of selectedModels) {
      pipelines.push(
        model.aggregate([
          { $match: matchCriteria },

          { $unwind: "$items" },

          // detect godown existence
          {
            $addFields: {
              hasGodown: {
                $gt: [{ $size: { $ifNull: ["$items.GodownList", []] } }, 0],
              },
            },
          },

          // unwind godown safely
          {
            $unwind: {
              path: "$items.GodownList",
              preserveNullAndEmptyArrays: true,
            },
          },

          // allow service OR added stock
          {
            $match: {
              $or: [{ hasGodown: false }, { "items.GodownList.added": true }],
            },
          },

          // category lookup
          {
            $lookup: {
              from: "categories",
              localField: "items.category",
              foreignField: "_id",
              as: "categoryInfo",
            },
          },
          {
            $unwind: {
              path: "$categoryInfo",
              preserveNullAndEmptyArrays: true,
            },
          },

          // brand lookup
          {
            $lookup: {
              from: "brands",
              localField: "items.brand",
              foreignField: "_id",
              as: "brandInfo",
            },
          },
          {
            $unwind: {
              path: "$brandInfo",
              preserveNullAndEmptyArrays: true,
            },
          },

          // group
          {
            $group: {
              _id: {
                ...groupId,
                voucherSeries: `$${billField}`,
              },

              gstNo: { $first: "$party.gstNo" },
              seriesid: { $first: "$series_id" },

              godownList: {
                $push: {
                  godown_id: "$items.GodownList.godown_id",
                  batch: "$items.GodownList.batch",

                  count: {
                    $cond: ["$hasGodown", "$items.GodownList.count", 1],
                  },

                  selectedPriceRate: {
                    $cond: [
                      "$hasGodown",
                      "$items.GodownList.selectedPriceRate",
                      "$items.rate",
                    ],
                  },

                  discountAmount: {
                    $ifNull: ["$items.GodownList.discountAmount", 0],
                  },

                  igstValue: {
                    $cond: [
                      "$hasGodown",
                      "$items.GodownList.igstValue",
                      "$items.igst",
                    ],
                  },

                  igstAmount: {
                    $cond: [
                      "$hasGodown",
                      "$items.GodownList.igstAmount",
                      "$items.totalIgstAmt",
                    ],
                  },

                  cessValue: {
                    $ifNull: ["$items.GodownList.cessValue", 0],
                  },

                  cessAmount: {
                    $ifNull: ["$items.GodownList.cessAmount", 0],
                  },

                  taxableAmount: {
                    $cond: [
                      "$hasGodown",
                      "$items.GodownList.taxableAmount",
                      "$items.total",
                    ],
                  },

                  individualTotal: {
                    $cond: [
                      "$hasGodown",
                      "$items.GodownList.individualTotal",
                      "$items.total",
                    ],
                  },

                  partyName: "$party.partyName",
                  hsn: "$items.hsn_code",
                  batchEnabled: "$items.batchEnabled",
                  gdnEnabled: "$items.gdnEnabled",
                },
              },

              itemMeta: {
                $first: {
                  billnumber: `$${billField}`,
                  billDate: {
                    $dateToString: {
                      format: "%d-%m-%Y",
                      date: "$date",
                    },
                  },
                  itemName: "$items.product_name",
                  item_mrp: "$items.item_mrp",
                  product_code: "$items.product_code",
                  categoryName: "$categoryInfo.category",
                  groupName: "$brandInfo.brand",
                },
              },
            },
          },
        ]),
      );
    }

    // ---------------- EXECUTE ----------------
    const output = await Promise.all(pipelines);
    const mergedResults = output.flat();

    // ---------------- POST PROCESS ----------------
    const groupedByParty = new Map();

    for (const record of mergedResults) {
      console.log("record", record);
      const filtername =
        selectedOption === "Ledger"
          ? record._id.partyName
          : selectedOption === "Stock Category"
            ? record._id.categoryName
            : selectedOption === "Stock Group"
              ? record._id.groupName
              : selectedOption === "voucher"
                ? record._id.voucherSeries
                : record._id.itemName;

      if (!groupedByParty.has(filtername)) {
        groupedByParty.set(filtername, {
          itemType: filtername,
          seriesID: record.seriesid,
          saleAmount: 0,
          sale: [],
        });
      }

      const partySummary = groupedByParty.get(filtername);

      const rate =
        record.godownList?.[0]?.selectedPriceRate ??
        record.itemMeta.item_mrp ??
        0;

      for (const g of record.godownList) {
        partySummary.sale.push({
          ...record.itemMeta,
          quantity: g.count,
          rate: Number(rate).toFixed(2),
          discount: g.discountAmount,
          taxPercentage: g.igstValue,
          taxAmount: g.igstAmount,
          gstNo: record.gstNo,
          hsn: g.hsn,
          netAmount: g.individualTotal,
          amount: g.taxableAmount,
          partyName: g.partyName,
        });

        partySummary.saleAmount += g.individualTotal || 0;
      }
    }

    const mergedsummary = Array.from(groupedByParty.values());

    // ---------------- RESPONSE ----------------
    if (mergedsummary.length > 0) {
      return res.status(200).json({
        message: "Summary data found",
        mergedsummary,
      });
    }

    return res.status(404).json({
      message: "No summary data found",
    });
  } catch (error) {
    console.error("getSummary error:", error);
    return res.status(500).json({
      status: false,
      message: "Error retrieving summary data",
      error: error.message,
    });
  }
};

export const getSummaryReport = async (req, res) => {
  try {
    const cmp_id = req.params.cmp_id;
    const companyObjectId = new mongoose.Types.ObjectId(cmp_id);

    const {
      start,
      end,
      voucherType,
      serialNumber,
      summaryType,
      selectedOption,
    } = req.query;

    let dateFilter = {};
    if (start && end) {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      dateFilter = {
        date: {
          $gte: startOfDay(startDate),
          $lte: endOfDay(endDate),
        },
      };
    }
    const matchCriteria = {
      ...dateFilter,
      cmp_id: companyObjectId,
    };

    // Define summary type mappings
    const summaryTypeMap = {
      sale: [{ model: salesModel, numberField: "salesNumber", type: "sale" }],
      saleOrder: [
        { model: invoiceModel, numberField: "orderNumber", type: "saleOrder" },
      ],
      vanSale: [
        { model: vanSaleModel, numberField: "salesNumber", type: "vanSale" },
      ],
      purchase: [
        {
          model: purchaseModel,
          numberField: "purchaseNumber",
          type: "purchase",
        },
      ],
      debitNote: [
        {
          model: debitNoteModel,
          numberField: "debitNoteNumber",
          type: "debitNote",
        },
      ],
      creditNote: [
        {
          model: creditNoteModel,
          numberField: "creditNoteNumber",
          type: "creditNote",
        },
      ],
    };

    // Handle special case for "sale" which should include both sale and vanSale
    let modelsToQuery = [];
    //alltype is only for sale and purchase
    if (voucherType === "allType") {
      if (summaryType === "Sales Summary") {
        modelsToQuery = [
          ...summaryTypeMap.sale,
          ...summaryTypeMap.vanSale,
          ...summaryTypeMap.creditNote,
        ];
      } else if (summaryType === "Purchase Summary") {
        modelsToQuery = [
          ...summaryTypeMap.purchase,
          ...summaryTypeMap.debitNote,
        ];
      }
    } else {
      modelsToQuery = voucherType ? summaryTypeMap[voucherType] : "";
    }
    if (!modelsToQuery || modelsToQuery.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid voucher type selected",
      });
    }
    if (selectedOption === "MonthWise") {
      const monthNames = [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const summaryPromises = modelsToQuery.map(async ({ model, type }) => {
        const isCredit = type === "creditNote" || type === "debitNote";

        const result = await model.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: { $month: "$date" },
              total: {
                $sum: {
                  $toDouble: {
                    $ifNull: ["$finalAmount", "$enteredAmount", 0],
                  },
                },
              },
              count: { $sum: 1 },
            },
          },
          {
            $addFields: {
              name: {
                $arrayElemAt: [monthNames, { $toInt: "$_id" }],
              },
              isCredit: isCredit,
              sourceType: type,
              transactions: [],
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
              total: 1,
              count: 1,
              isCredit: 1,
              sourceType: 1,
              transactions: 1,
            },
          },
        ]);

        return result;
      });

      const results = await Promise.all(summaryPromises);
      const flattenedResults = results.flat();

      if (flattenedResults.length > 0) {
        return res
          .status(200)
          .json({ message: "Summary data found", flattenedResults });
      } else {
        return res
          .status(404)
          .json({ message: "No summary data found", flattenedResults: [] });
      }
    }

    // Create transaction promises based on selected voucher type
    const summaryPromises = modelsToQuery.map(({ model, numberField, type }) =>
      aggregateSummary(
        model,
        matchCriteria,
        numberField,
        type,
        selectedOption,
        serialNumber,
      ),
    );
    const results = await Promise.all(summaryPromises);

    // Flatten results while adding a source identifiers
    const flattenedResults = results.flat();

    if (flattenedResults.length > 0) {
      return res
        .status(200)
        .json({ message: "Summary data found", flattenedResults });
    } else {
      return res
        .status(404)
        .json({ message: "No summary data found", flattenedResults: [] });
    }
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/// get summary of hotel

export const fetchDashboardConsolidatedTotals = async (req, res) => {
  try {
    const { primaryUserId } = req.params;
    const { date } = req.query;
    const { selectedStartIST, selectedEndIST, monthStartIST } =
      getISTDateRanges(date);

    const primaryUserObjectId = new mongoose.Types.ObjectId(primaryUserId);

    const [salesResult, receiptResult, restaurantDirectSummary] =
      await Promise.all([
        salesModel.aggregate([
          {
            $match: {
              Primary_user_id: primaryUserObjectId,
              isComplimentary: { $ne: true },
              date: { $lte: selectedEndIST },
            },
          },
          {
            $group: {
              _id: null,

              totalRevenue: {
                $sum: "$finalAmount",
              },

              totalTax: {
                $sum: {
                  $reduce: {
                    input: { $ifNull: ["$items", []] },
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        { $ifNull: ["$$this.totalIgstAmt", 0] },
                      ],
                    },
                  },
                },
              },
            },
          },
        ]),
        receiptModel.aggregate([
          {
            $match: {
              Primary_user_id: primaryUserObjectId,
              isCancelled: { $ne: true },
            },
          },
          {
            $addFields: {
              normalizedPaymentMethod: {
                $toLower: { $ifNull: ["$paymentMethod", ""] },
              },
            },
          },
          {
            $facet: {
              monthlyTotal: [
                {
                  $match: {
                    date: { $gte: monthStartIST, $lte: selectedEndIST },
                  },
                },
                {
                  $group: {
                    _id: null,
                    total: { $sum: "$enteredAmount" },
                  },
                },
              ],
              dailyTotal: [
                {
                  $match: {
                    date: { $gte: selectedStartIST, $lte: selectedEndIST },
                  },
                },
                {
                  $group: {
                    _id: null,
                    total: { $sum: "$enteredAmount" },
                  },
                },
              ],
              cashBankDaily: [
                {
                  $match: {
                    date: { $gte: selectedStartIST, $lte: selectedEndIST },
                    enteredAmount: { $gt: 0 },
                    normalizedPaymentMethod: { $ne: "credit" },
                  },
                },
                {
                  $group: {
                    _id: {
                      $cond: [
                        { $eq: ["$normalizedPaymentMethod", "cash"] },
                        "cash",
                        "bank",
                      ],
                    },
                    total: { $sum: "$enteredAmount" },
                  },
                },
              ],
              cashBankMonthly: [
                {
                  $match: {
                    date: { $gte: monthStartIST, $lte: selectedEndIST },
                    enteredAmount: { $gt: 0 },
                    normalizedPaymentMethod: { $ne: "credit" },
                  },
                },
                {
                  $group: {
                    _id: {
                      $cond: [
                        { $eq: ["$normalizedPaymentMethod", "cash"] },
                        "cash",
                        "bank",
                      ],
                    },
                    total: { $sum: "$enteredAmount" },
                  },
                },
              ],
              cashBankAllTime: [
                {
                  $match: {
                    date: { $lte: selectedEndIST },
                    enteredAmount: { $gt: 0 },
                    normalizedPaymentMethod: { $ne: "credit" },
                  },
                },
                {
                  $group: {
                    _id: {
                      $cond: [
                        { $eq: ["$normalizedPaymentMethod", "cash"] },
                        "cash",
                        "bank",
                      ],
                    },
                    total: { $sum: "$enteredAmount" },
                  },
                },
              ],
            },
          },
        ]),
        getRestaurantDirectCollectionSummary({
          primaryUserObjectId,
          selectedStartIST,
          selectedEndIST,
          monthStartIST,
        }),
      ]);

    // ── Helper: [{_id: "cash", total: X}] → { cash: X, bank: Y }
    const toMap = (arr) => {
      const map = { cash: 0, bank: 0 };
      (arr || []).forEach(({ _id, total }) => {
        map[_id] = total;
      });
      return map;
    };

    const receiptSummary = receiptResult[0] || {};
    const daily = toMap(receiptSummary.cashBankDaily);
    const monthly = toMap(receiptSummary.cashBankMonthly);
    const allTime = toMap(receiptSummary.cashBankAllTime);

    return res.status(200).json({
      totalRevenue: salesResult[0]?.totalRevenue ?? 0,
      totalTax: salesResult[0]?.totalTax ?? 0,
      finalRevenue:
        Number(salesResult[0]?.totalRevenue) - Number(salesResult[0]?.totalTax),
      monthlyCollection:
        (receiptSummary.monthlyTotal?.[0]?.total ?? 0) +
        (restaurantDirectSummary.monthly.total ?? 0),
      dailyCollection:
        (receiptSummary.dailyTotal?.[0]?.total ?? 0) +
        (restaurantDirectSummary.daily.total ?? 0),
      cashCollection: {
        allTime:
          allTime.cash + (restaurantDirectSummary.allTime.cashTotal ?? 0),
        monthly:
          monthly.cash + (restaurantDirectSummary.monthly.cashTotal ?? 0),
        daily: daily.cash + (restaurantDirectSummary.daily.cashTotal ?? 0),
      },
      bankCollection: {
        allTime:
          allTime.bank + (restaurantDirectSummary.allTime.bankTotal ?? 0),
        monthly:
          monthly.bank + (restaurantDirectSummary.monthly.bankTotal ?? 0),
        daily: daily.bank + (restaurantDirectSummary.daily.bankTotal ?? 0),
      },
    });
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Enable dayjs timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

export const fetchDashboardCompanyRevenueBreakdown = async (req, res) => {
  try {
    const { primaryUserId } = req.params;
    const { date } = req.query;

    if (!primaryUserId) {
      return res.status(400).json({
        message: "Primary user ID is required",
      });
    }

    if (!date) {
      return res.status(400).json({
        message: "Date is required",
      });
    }

    const primaryUserObjectId = new mongoose.Types.ObjectId(primaryUserId);

    // =========================================================
    // IST DATE RANGES
    // =========================================================

    const selectedDate = dayjs.tz(date, "YYYY-MM-DD", "Asia/Kolkata");

    if (!selectedDate.isValid()) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    const startOfDayIST = selectedDate.startOf("day").toDate();

    const endOfDayIST = selectedDate.endOf("day").toDate();

    const startOfMonthIST = selectedDate.startOf("month").toDate();

    const startOfYearIST = selectedDate.startOf("year").toDate();

    console.log("Dashboard revenue date ranges:", {
      requestedDate: date,

      startOfDayIST,
      endOfDayIST,

      startOfMonthIST,
      startOfYearIST,
    });

    // =========================================================
    // COMPANY-WISE REVENUE
    // =========================================================

    const companyWiseRevenue = await OrganizationModel.aggregate([
      // -----------------------------------------------------
      // Get companies belonging to the user
      // -----------------------------------------------------
      {
        $match: {
          owner: primaryUserObjectId,
        },
      },

      // -----------------------------------------------------
      // Get sales for each company
      // -----------------------------------------------------
      {
        $lookup: {
          from: salesModel.collection.name,

          let: {
            companyId: "$_id",
          },

          pipeline: [
            // ------------------------------------------------
            // Get sales from beginning of current year
            // until selected date
            // ------------------------------------------------
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$cmp_id", "$$companyId"],
                    },

                    {
                      $eq: ["$Primary_user_id", primaryUserObjectId],
                    },

                    {
                      $ne: ["$isComplimentary", true],
                    },

                    {
                      $gte: ["$date", startOfYearIST],
                    },

                    {
                      $lte: ["$date", endOfDayIST],
                    },
                  ],
                },
              },
            },

            // ------------------------------------------------
            // Calculate daily/monthly/yearly revenue
            // ------------------------------------------------
            {
              $group: {
                _id: null,

                // ==========================================
                // DAILY REVENUE
                // ==========================================
                dailyRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: ["$date", startOfDayIST],
                          },
                          {
                            $lte: ["$date", endOfDayIST],
                          },
                        ],
                      },

                      {
                        $ifNull: ["$finalAmount", 0],
                      },

                      0,
                    ],
                  },
                },

                dailyTax: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: ["$date", startOfDayIST],
                          },
                          {
                            $lte: ["$date", endOfDayIST],
                          },
                        ],
                      },

                      {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "item",
                            in: { $ifNull: ["$$item.totalIgstAmt", 0] },
                          },
                        },
                      },

                      0,
                    ],
                  },
                },

                // ==========================================
                // MONTHLY REVENUE
                // ==========================================
                monthlyRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: ["$date", startOfMonthIST],
                          },
                          {
                            $lte: ["$date", endOfDayIST],
                          },
                        ],
                      },

                      {
                        $ifNull: ["$finalAmount", 0],
                      },

                      0,
                    ],
                  },
                },

                monthlyTax: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: ["$date", startOfMonthIST],
                          },
                          {
                            $lte: ["$date", endOfDayIST],
                          },
                        ],
                      },

                      {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "item",
                            in: { $ifNull: ["$$item.totalIgstAmt", 0] },
                          },
                        },
                      },

                      0,
                    ],
                  },
                },

                // ==========================================
                // YEARLY REVENUE
                // ==========================================
                yearlyRevenue: {
                  $sum: {
                    $ifNull: ["$finalAmount", 0],
                  },
                },

                yearlyTax: {
                  $sum: {
                    $sum: {
                      $map: {
                        input: { $ifNull: ["$items", []] },
                        as: "item",
                        in: { $ifNull: ["$$item.totalIgstAmt", 0] },
                      },
                    },
                  },
                },
              },
            },
          ],

          as: "revenueData",
        },
      },

      // -----------------------------------------------------
      // Format company result
      // -----------------------------------------------------
      {
        $project: {
          _id: 0,

          cmp_id: "$_id",

          companyName: {
            $ifNull: ["$name", "Unknown Company"],
          },

          // ================================================
          // DAILY
          // ================================================
          dailyRevenue: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.dailyRevenue", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          dailyTax: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.dailyTax", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          // ================================================
          // MONTHLY
          // ================================================
          monthlyRevenue: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.monthlyRevenue", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          monthlyTax: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.monthlyTax", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          // ================================================
          // YEARLY
          // ================================================
          yearlyRevenue: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.yearlyRevenue", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },

          yearlyTax: {
            $round: [
              {
                $ifNull: [
                  {
                    $arrayElemAt: ["$revenueData.yearlyTax", 0],
                  },
                  0,
                ],
              },
              2,
            ],
          },
        },
      },

      // -----------------------------------------------------
      // Sort companies by yearly revenue
      // -----------------------------------------------------
      {
        $sort: {
          yearlyRevenue: -1,
          companyName: 1,
        },
      },
    ]);

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.status(200).json({
      message: "Company-wise revenue fetched successfully",

      companyWiseRevenue,
    });
  } catch (error) {
    console.error("fetchDashboardCompanyRevenueBreakdown error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
const buildRestaurantDirectSalesPipeline = ({
  primaryUserObjectId,
  dateMatch = null,
  endDate = null,
  companyExpr = { $eq: ["$Primary_user_id", primaryUserObjectId] },
  groupByCompany = false,
}) => {
  const pipeline = [
    {
      $match: {
        Primary_user_id: primaryUserObjectId,
        isComplimentary: { $ne: true },
        isCancelled: { $ne: true },
        ...(endDate ? { date: { $lte: endDate } } : {}),
      },
    },
    {
      $lookup: {
        from: VoucherSeriesModel.collection.name,
        let: { saleSeriesId: "$series_id", saleCmpId: "$cmp_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$cmp_id", "$$saleCmpId"] },
            },
          },
          { $unwind: "$series" },
          {
            $match: {
              $expr: { $eq: ["$series._id", "$$saleSeriesId"] },
            },
          },
          {
            $project: {
              _id: 0,
              under: { $toLower: "$series.under" },
            },
          },
        ],
        as: "seriesMeta",
      },
    },
    {
      $addFields: {
        saleUnder: { $arrayElemAt: ["$seriesMeta.under", 0] },
        hasCheckInNumber: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$convertedFrom", []] },
                  as: "converted",
                  cond: {
                    $and: [
                      {
                        $ne: [
                          { $ifNull: ["$$converted.checkInNumber", null] },
                          null,
                        ],
                      },
                      { $ne: ["$$converted.checkInNumber", ""] },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $match: {
        $expr: companyExpr,
        saleUnder: "restaurant",
        hasCheckInNumber: false,
      },
    },
  ];

  if (dateMatch) {
    pipeline.push({
      $match: {
        date: dateMatch,
      },
    });
  }

  pipeline.push(
    { $unwind: "$paymentSplittingData" },
    {
      $match: {
        "paymentSplittingData.type": { $ne: "credit" },
        "paymentSplittingData.amount": { $gt: 0 },
      },
    },
    {
      $group: {
        _id: groupByCompany ? "$cmp_id" : null,
        cashTotal: {
          $sum: {
            $cond: [
              { $eq: ["$paymentSplittingData.type", "cash"] },
              "$paymentSplittingData.amount",
              0,
            ],
          },
        },
        bankTotal: {
          $sum: {
            $cond: [
              { $eq: ["$paymentSplittingData.type", "cash"] },
              0,
              "$paymentSplittingData.amount",
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        cashTotal: { $ifNull: ["$cashTotal", 0] },
        bankTotal: { $ifNull: ["$bankTotal", 0] },
        total: {
          $add: [
            { $ifNull: ["$cashTotal", 0] },
            { $ifNull: ["$bankTotal", 0] },
          ],
        },
      },
    },
  );

  return pipeline;
};

const getRestaurantDirectCollectionSummary = async ({
  primaryUserObjectId,
  selectedStartIST,
  selectedEndIST,
  monthStartIST,
}) => {
  const [summary] = await salesModel.aggregate([
    {
      $facet: {
        daily: buildRestaurantDirectSalesPipeline({
          primaryUserObjectId,
          dateMatch: { $gte: selectedStartIST, $lte: selectedEndIST },
        }),
        monthly: buildRestaurantDirectSalesPipeline({
          primaryUserObjectId,
          dateMatch: { $gte: monthStartIST, $lte: selectedEndIST },
        }),
        allTime: buildRestaurantDirectSalesPipeline({
          primaryUserObjectId,
          endDate: selectedEndIST,
        }),
      },
    },
  ]);

  return {
    daily: summary?.daily?.[0] ?? { cashTotal: 0, bankTotal: 0, total: 0 },
    monthly: summary?.monthly?.[0] ?? { cashTotal: 0, bankTotal: 0, total: 0 },
    allTime: summary?.allTime?.[0] ?? { cashTotal: 0, bankTotal: 0, total: 0 },
  };
};

const getCompanyWiseCollectionBreakdown = async ({
  primaryUserId,
  dateMatch,
}) => {
  const primaryUserObjectId = new mongoose.Types.ObjectId(primaryUserId);

  return OrganizationModel.aggregate([
    {
      $match: {
        owner: primaryUserObjectId,
      },
    },
    {
      $lookup: {
        from: receiptModel.collection.name,
        let: { companyId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$cmp_id", "$$companyId"] },
                  { $eq: ["$Primary_user_id", primaryUserObjectId] },
                  { $gte: ["$date", dateMatch.$gte] },
                  { $lte: ["$date", dateMatch.$lte] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          {
            $addFields: {
              normalizedPaymentMethod: {
                $toLower: { $ifNull: ["$paymentMethod", ""] },
              },
            },
          },
          {
            $match: {
              enteredAmount: { $gt: 0 },
              normalizedPaymentMethod: { $ne: "credit" },
            },
          },
          {
            $group: {
              _id: null,
              cashTotal: {
                $sum: {
                  $cond: [
                    { $eq: ["$normalizedPaymentMethod", "cash"] },
                    "$enteredAmount",
                    0,
                  ],
                },
              },
              bankTotal: {
                $sum: {
                  $cond: [
                    { $eq: ["$normalizedPaymentMethod", "cash"] },
                    0,
                    "$enteredAmount",
                  ],
                },
              },
            },
          },
        ],
        as: "receiptCollectionData",
      },
    },
    {
      $lookup: {
        from: salesModel.collection.name,
        let: { companyId: "$_id" },
        pipeline: buildRestaurantDirectSalesPipeline({
          primaryUserObjectId,
          dateMatch,
          companyExpr: { $eq: ["$cmp_id", "$$companyId"] },
        }),
        as: "restaurantDirectCollectionData",
      },
    },
    {
      $project: {
        _id: 0,
        cmp_id: "$_id",
        companyName: { $ifNull: ["$name", "Unknown Company"] },
        cashTotal: {
          $round: [
            {
              $add: [
                {
                  $ifNull: [
                    { $arrayElemAt: ["$receiptCollectionData.cashTotal", 0] },
                    0,
                  ],
                },
                {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$restaurantDirectCollectionData.cashTotal",
                        0,
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
            2,
          ],
        },
        bankTotal: {
          $round: [
            {
              $add: [
                {
                  $ifNull: [
                    { $arrayElemAt: ["$receiptCollectionData.bankTotal", 0] },
                    0,
                  ],
                },
                {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$restaurantDirectCollectionData.bankTotal",
                        0,
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
            2,
          ],
        },
        total: {
          $round: [
            {
              $add: [
                {
                  $add: [
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: ["$receiptCollectionData.cashTotal", 0],
                        },
                        0,
                      ],
                    },
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            "$restaurantDirectCollectionData.cashTotal",
                            0,
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
                {
                  $add: [
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: ["$receiptCollectionData.bankTotal", 0],
                        },
                        0,
                      ],
                    },
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            "$restaurantDirectCollectionData.bankTotal",
                            0,
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
            2,
          ],
        },
      },
    },
    { $sort: { total: -1, companyName: 1 } },
  ]);
};

export const fetchDashboardCompanyDailyCollectionBreakdown = async (
  req,
  res,
) => {
  try {
    const { primaryUserId } = req.params;
    const { date } = req.query;
    const { selectedStartIST, selectedEndIST } = getISTDateRanges(date);

    const companyWiseCollection = await getCompanyWiseCollectionBreakdown({
      primaryUserId,
      dateMatch: { $gte: selectedStartIST, $lte: selectedEndIST },
    });

    return res.status(200).json({
      message: "Company-wise daily collection fetched successfully",
      companyWiseCollection,
    });
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchDashboardCompanyMonthlyCollectionBreakdown = async (
  req,
  res,
) => {
  try {
    const { primaryUserId } = req.params;
    const { date } = req.query;
    const { monthStartIST, selectedEndIST } = getISTDateRanges(date);

    const companyWiseCollection = await getCompanyWiseCollectionBreakdown({
      primaryUserId,
      dateMatch: { $gte: monthStartIST, $lte: selectedEndIST },
    });

    return res.status(200).json({
      message: "Company-wise monthly collection fetched successfully",
      companyWiseCollection,
    });
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchDashboardRoomCountSummary = async (req, res) => {
  try {
    const { primaryUserId } = req.params;
    const primaryUserObjectId = new mongoose.Types.ObjectId(primaryUserId);

    const companyWiseRoomCount = await OrganizationModel.aggregate([
      {
        $match: {
          owner: primaryUserObjectId,
        },
      },
      {
        $lookup: {
          from: RoomModel.collection.name,
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$cmp_id", "$$companyId"] },
                    { $eq: ["$primary_user_id", primaryUserObjectId] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                roomCount: { $sum: 1 },
                availableCount: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["available", "vacant"]] },
                      1,
                      0,
                    ],
                  },
                },
                blockedCount: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "blocked"] }, 1, 0],
                  },
                },
                availableRooms: {
                  $push: {
                    $cond: [
                      { $in: ["$status", ["available", "vacant"]] },
                      "$roomName",
                      null,
                    ],
                  },
                },
                blockedRooms: {
                  $push: {
                    $cond: [{ $eq: ["$status", "blocked"] }, "$roomName", null],
                  },
                },
              },
            },
            {
              $project: {
                roomCount: 1,
                availableCount: 1,
                blockedCount: 1,
                availableRooms: {
                  $filter: {
                    input: "$availableRooms",
                    as: "roomName",
                    cond: { $ne: ["$$roomName", null] },
                  },
                },
                blockedRooms: {
                  $filter: {
                    input: "$blockedRooms",
                    as: "roomName",
                    cond: { $ne: ["$$roomName", null] },
                  },
                },
              },
            },
          ],
          as: "roomData",
        },
      },
      {
        $project: {
          _id: 0,
          cmp_id: "$_id",
          companyName: { $ifNull: ["$name", "Unknown Company"] },
          roomCount: {
            $ifNull: [{ $arrayElemAt: ["$roomData.roomCount", 0] }, 0],
          },
          availableCount: {
            $ifNull: [{ $arrayElemAt: ["$roomData.availableCount", 0] }, 0],
          },
          blockedCount: {
            $ifNull: [{ $arrayElemAt: ["$roomData.blockedCount", 0] }, 0],
          },
          availableRooms: {
            $ifNull: [{ $arrayElemAt: ["$roomData.availableRooms", 0] }, []],
          },
          blockedRooms: {
            $ifNull: [{ $arrayElemAt: ["$roomData.blockedRooms", 0] }, []],
          },
        },
      },
      { $sort: { roomCount: -1, companyName: 1 } },
    ]);

    const totalRooms = companyWiseRoomCount.reduce(
      (sum, company) => sum + Number(company.roomCount || 0),
      0,
    );
    const totalAvailableRooms = companyWiseRoomCount.reduce(
      (sum, company) => sum + Number(company.availableCount || 0),
      0,
    );
    const totalBlockedRooms = companyWiseRoomCount.reduce(
      (sum, company) => sum + Number(company.blockedCount || 0),
      0,
    );

    return res.status(200).json({
      message: "Room count summary fetched successfully",
      totalRooms,
      totalAvailableRooms,
      totalBlockedRooms,
      companyWiseRoomCount,
    });
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchDashboardPropertySalesSummary = async (req, res) => {
  try {
    const { primaryUserId } = req.params;
    const { date } = req.query;
    const { selectedEndIST } = getISTDateRanges(date);
    const primaryUserObjectId = new mongoose.Types.ObjectId(primaryUserId);

    const companyWisePropertySales = await OrganizationModel.aggregate([
      {
        $match: {
          owner: primaryUserObjectId,
        },
      },
      {
        $lookup: {
          from: salesModel.collection.name,
          let: { companyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$cmp_id", "$$companyId"] },
                    { $eq: ["$Primary_user_id", primaryUserObjectId] },
                    { $ne: ["$isComplimentary", true] },
                    { $lte: ["$date", selectedEndIST] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: VoucherSeriesModel.collection.name,
                let: { saleSeriesId: "$series_id", saleCmpId: "$cmp_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$cmp_id", "$$saleCmpId"] },
                    },
                  },
                  { $unwind: "$series" },
                  {
                    $match: {
                      $expr: { $eq: ["$series._id", "$$saleSeriesId"] },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      under: { $toLower: "$series.under" },
                    },
                  },
                ],
                as: "seriesMeta",
              },
            },
            {
              $addFields: {
                saleUnder: { $arrayElemAt: ["$seriesMeta.under", 0] },
              },
            },
            {
              $group: {
                _id: null,

                hotelSales: {
                  $sum: {
                    $cond: [
                      { $eq: ["$saleUnder", "hotel"] },
                      { $ifNull: ["$finalAmount", 0] },
                      0,
                    ],
                  },
                },

                hotelTax: {
                  $sum: {
                    $cond: [
                      { $eq: ["$saleUnder", "hotel"] },
                      {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "item",
                            in: { $ifNull: ["$$item.totalIgstAmt", 0] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },

                restaurantSales: {
                  $sum: {
                    $cond: [
                      { $eq: ["$saleUnder", "restaurant"] },
                      { $ifNull: ["$finalAmount", 0] },
                      0,
                    ],
                  },
                },

                restaurantTax: {
                  $sum: {
                    $cond: [
                      { $eq: ["$saleUnder", "restaurant"] },
                      {
                        $sum: {
                          $map: {
                            input: { $ifNull: ["$items", []] },
                            as: "item",
                            in: { $ifNull: ["$$item.totalIgstAmt", 0] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: "propertySalesData",
        },
      },
      {
        $project: {
          _id: 0,
          cmp_id: "$_id",
          companyName: { $ifNull: ["$name", "Unknown Company"] },

          hotelSales: {
            $round: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$propertySalesData.hotelSales", 0] },
                  0,
                ],
              },
              2,
            ],
          },

          hotelTax: {
            $round: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$propertySalesData.hotelTax", 0] },
                  0,
                ],
              },
              2,
            ],
          },

          restaurantSales: {
            $round: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$propertySalesData.restaurantSales", 0] },
                  0,
                ],
              },
              2,
            ],
          },

          restaurantTax: {
            $round: [
              {
                $ifNull: [
                  { $arrayElemAt: ["$propertySalesData.restaurantTax", 0] },
                  0,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $addFields: {
          totalSales: {
            $round: [{ $add: ["$hotelSales", "$restaurantSales"] }, 2],
          },
        },
      },
      { $sort: { totalSales: -1, companyName: 1 } },
    ]);

    console.log("companyWisePropertySales", companyWisePropertySales);

    const totalHotelSales = companyWisePropertySales.reduce(
      (sum, company) => sum + Number(company.hotelSales || 0),
      0,
    );
    const totalHotelTax = companyWisePropertySales.reduce(
      (sum, company) => sum + Number(company.hotelTax || 0),
      0,
    );
    const totalRestaurantSales = companyWisePropertySales.reduce(
      (sum, company) => sum + Number(company.restaurantSales || 0),
      0,
    );
    const totalRestaurantTax = companyWisePropertySales.reduce(
      (sum, company) => sum + Number(company.restaurantTax || 0),
      0,
    );
    const totalPropertySales = totalHotelSales + totalRestaurantSales;

    return res.status(200).json({
      message: "Property sales summary fetched successfully",
      totalPropertySales: Number(totalPropertySales.toFixed(2)),
      totalHotelSales: Number(totalHotelSales.toFixed(2)),
      totalHotelTax: Number(totalHotelTax.toFixed(2)),
      totalHotelSaleWithOutTax:
        Number(totalHotelSales.toFixed(2)) - Number(totalHotelTax.toFixed(2)),
      totalRestaurantSales: Number(totalRestaurantSales.toFixed(2)),
      totalRestaurantTax: Number(totalRestaurantTax.toFixed(2)),
      totalRestaurantSaleWithOutTax:
        Number(totalRestaurantSales.toFixed(2)) -
        Number(totalRestaurantTax.toFixed(2)),
      companyWisePropertySales,
    });
  } catch (error) {
    console.log("error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
