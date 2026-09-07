

export const taxCalculator = (
  data,
  inclusive = false,
  formData = null,
  taxCalculationRoomId = null,
  includeFoodRateWithRoom,
  includePaxRateWithRoom,
) => {
  try {
    if (!data || typeof data !== "object") {
      console.error("Invalid data provided to taxCalculator");
      return null;
    }

    console.log(data)

    const { hsnDetails } = data;

    console.log("data", data);
    console.log("inclusive", inclusive);
    console.log("formData", formData);
    console.log("taxCalculationRoomId", taxCalculationRoomId);
    console.log("includeFoodRateWithRoom", includePaxRateWithRoom);

    const reducedAdditionalPaxAmount = Math.round(
      taxCalculationRoomId
        ? formData?.additionalPaxDetails?.reduce(
            (acc, item) =>
              item.roomId === taxCalculationRoomId
                ? acc + (Number(item.rate) || 0) * Number(data?.stayDays )
                : acc,
            0,
          ) || 0
        : 0
    );

    const reducedFoodPlanAmount = Math.round(
      taxCalculationRoomId
        ? formData?.foodPlan?.reduce(
            (acc, item) =>
              item.roomId === taxCalculationRoomId
                ? acc + (Number(item.rate) || 0) * Number(data?.stayDays )
                : acc,
            0,
          ) || 0
        : 0
    );

    const discountAmt = Number(data?.discountAmount || 0);
    const otherChargeAmt = Number(data?.otherChargeAmount || 0);

    const baseAmount = Number(data?.totalAmount || 0);
    console.log("baseAmount",includePaxRateWithRoom);
    const isOffline = formData?.bookingType === "offline";

    console.log(data)
    // totalAmount for tax slab detection
    // includeFoodRateWithRoom = true  → food already inside baseAmount, don't add again
    // includeFoodRateWithRoom = false → food is separate, add for correct slab detection
    let totalAmount = Math.round(baseAmount + (includePaxRateWithRoom ? 0 : reducedAdditionalPaxAmount ) )
    if (!includeFoodRateWithRoom && !isOffline) {
      totalAmount += reducedFoodPlanAmount;
    }
  
    let rate = includePaxRateWithRoom ? (data.priceLevelRate - (reducedAdditionalPaxAmount/data.stayDays)) : data.priceLevelRate;
     rate = includeFoodRateWithRoom ? (rate - reducedFoodPlanAmount/data.stayDays) : rate;
     console.log("rate", rate);
    // Tax slab detection
    let taxRate = 0;
    let applicableSlab = null;

    if (Array.isArray(hsnDetails?.rows)) {
      for (const row of hsnDetails.rows) {
        const slab = getApplicableTaxSlab(row, rate);
        if (slab) {
          applicableSlab = slab;
          taxRate = Number(slab.igstRate || 0);
          break;
        }
      }
    }

    if (
      !applicableSlab &&
      hsnDetails?.rows?.[hsnDetails?.rows?.length - 1]?.igstRate !== undefined
    ) {
      taxRate = Number(
        hsnDetails?.rows[hsnDetails?.rows?.length - 1]?.igstRate || 0
      );
    }

    // Room + pax tax
    const taxAmount = Math.round((totalAmount * taxRate) / 100);
    console.log("taxAmount", totalAmount);
    let amountWithTax = Math.round(
      inclusive ? totalAmount : totalAmount + taxAmount
    );


    // Food plan tax rate: offline always 5%, online same slab as room
    const foodPlanTaxRate = isOffline ? 5 : taxRate;
    // Additional pax with tax
    const additionalPaxAmountWithTax = Math.round(
      inclusive
        ? reducedAdditionalPaxAmount
        : reducedAdditionalPaxAmount +
            (reducedAdditionalPaxAmount * taxRate) / 100
    );

    let additionalPaxAmountWithOutTax = Math.round(
      inclusive
        ? reducedAdditionalPaxAmount / (1 + taxRate / 100)
        : reducedAdditionalPaxAmount
    );

    // Food plan tax handling
    // includeFoodRateWithRoom = true  → food tax already captured inside taxAmount
    //                                   (food is part of baseAmount which was taxed)
    //                                   report amounts as-is, foodPlanTaxAmount = 0
    // includeFoodRateWithRoom = false → food is separate, calculate its own tax
    let foodPlanAmountWithTax = 0;
    let foodPlanAmountWithOutTax = 0;
    let foodPlanTaxAmount = 0;

    if (includeFoodRateWithRoom) {
      foodPlanAmountWithTax    = reducedFoodPlanAmount;
      foodPlanAmountWithOutTax = reducedFoodPlanAmount;
      foodPlanTaxAmount        = 0;
    } else {
      foodPlanAmountWithTax = Math.round(
        inclusive
          ? reducedFoodPlanAmount
          : reducedFoodPlanAmount +
              (reducedFoodPlanAmount * foodPlanTaxRate) / 100
      );

      foodPlanAmountWithOutTax = Math.round(
        inclusive
          ? reducedFoodPlanAmount / (1 + foodPlanTaxRate / 100)
          : reducedFoodPlanAmount
      );

      foodPlanTaxAmount = Math.round(
        foodPlanAmountWithTax - foodPlanAmountWithOutTax
      );
    }
 amountWithTax = Math.round((amountWithTax + (otherChargeAmt || 0 ) ) - (discountAmt || 0 ));

    // Offline: food tax always added on top separately
    if (isOffline && !includeFoodRateWithRoom) {
      amountWithTax = Math.round(amountWithTax + foodPlanAmountWithTax);
    }

    // managing additional charge data 

   

    console.log("amountWithTax", amountWithTax);
    // amountWithOutTax: don't double count food if already in baseAmount
    const amountWithOutTax = Math.round(
      (baseAmount +
      reducedAdditionalPaxAmount +
      (includeFoodRateWithRoom ? 0 : reducedFoodPlanAmount)  + (data?.otherChargeWithOutTax || 0) - (data?.discountAmountWithOutTax || 0 ) )
    );

    // CGST/SGST/IGST split includes food tax when food is separate
    const totalTaxForSplit = Math.round(
      taxAmount + (includeFoodRateWithRoom ? 0 : foodPlanTaxAmount)
    );

    console.log(amountWithTax)
    console.log(amountWithOutTax)
    console.log(taxRate)
    console.log(foodPlanTaxRate)
    console.log(taxAmount)
    console.log(totalTaxForSplit)
    console.log(additionalPaxAmountWithTax)
    console.log(reducedAdditionalPaxAmount)
    console.log(foodPlanAmountWithTax)
    console.log(foodPlanAmountWithOutTax)
    console.log(foodPlanTaxAmount)
    console.log(includeFoodRateWithRoom)
    console.log(baseAmount)
    console.log(Math.round(baseAmount + taxAmount))

    return {
      amountWithTax,
      amountWithOutTax,
      taxRate:         Math.round(taxRate),
      foodPlanTaxRate: Math.round(foodPlanTaxRate),
      taxAmount:       Math.round(taxAmount),
      totalCgstAmt:    Math.round(totalTaxForSplit / 2),
      totalSgstAmt:    Math.round(totalTaxForSplit / 2),
      totalIgstAmt:    Math.round(totalTaxForSplit),
      additionalPaxAmountWithTax,
      additionalPaxAmountWithOutTax,
      foodPlanAmountWithTax,
      foodPlanAmountWithOutTax,
      foodPlanTaxAmount,
      includeFoodRateWithRoom: Boolean(includeFoodRateWithRoom),
      baseAmount:        Math.round(baseAmount),
      baseAmountWithTax: Math.round(baseAmount + taxAmount),
    };
  } catch (error) {
    console.error("Error in taxCalculator:", error);
    return {
      amountWithTax:       Number(data?.totalAmount || 0),
      taxRate:             0,
      taxAmount:           0,
      additionalPaxAmount: 0,
      foodPlanAmount:      0,
      baseAmount:          Number(data?.totalAmount || 0),
      totalBeforeTax:      Number(data?.totalAmount || 0),
    };
  }
};

const getApplicableTaxSlab = (row, totalAmount) => {
  try {
    const greaterThan = parseFloat(row.greaterThan);
    const uptoValue = row.upto;

    if (isNaN(greaterThan)) return null;

    let isApplicable = false;

    if (uptoValue === "" || uptoValue === null || uptoValue === undefined) {
      isApplicable = totalAmount > greaterThan;
    } else {
      const upto = parseFloat(uptoValue);
      if (isNaN(upto)) return null;
      isApplicable = totalAmount > greaterThan && totalAmount <= upto;
    }

    return isApplicable ? row : null;
  } catch (error) {
    console.error("Error in getApplicableTaxSlab:", error);
    return null;
  }
};

export const taxCalculatorForRestaurant = (
  tableData = [],
  inclusive = false,
) => {
  return tableData.map((item) => {
    const updatedGodownList = item.GodownList.map((godown) => {
      const price    = Number(item.price)     || 0;
      const igst     = Number(item.igst)      || 0;
      const cgst     = Number(item.cgst)      || 0;
      const sgst     = Number(item.sgst)      || 0;
      const count    = Number(godown.count)   || 1;
      const cess     = Number(item?.cess)     || 0;
      const addlCess = Number(item?.addl_cess)|| 0;

      const totalTaxRate = igst || cgst + sgst;
      let taxableAmount;
      let igstAmount, cgstAmount, sgstAmount, cessAmount, additionalCessAmount;
      let individualTotal;
      let basePrice = price;

      if (inclusive) {
        const totalAmount = price * count;
        basePrice    = Number((basePrice / (1 + totalTaxRate / 100)).toFixed(2));
        taxableAmount = (totalAmount * 100) / (100 + totalTaxRate);
        const totalTaxAmount = totalAmount - taxableAmount;

        igstAmount           = totalTaxAmount;
        cgstAmount           = totalTaxAmount / 2;
        sgstAmount           = totalTaxAmount / 2;
        cessAmount           = (taxableAmount * cess)     / 100;
        additionalCessAmount = (taxableAmount * addlCess) / 100;
        individualTotal      = totalAmount + cessAmount + additionalCessAmount;
      } else {
        taxableAmount        = price * count;
        const totalTaxAmount = (taxableAmount * totalTaxRate) / 100;

        igstAmount           = totalTaxAmount;
        cgstAmount           = totalTaxAmount / 2;
        sgstAmount           = totalTaxAmount / 2;
        cessAmount           = (taxableAmount * cess)     / 100;
        additionalCessAmount = (taxableAmount * addlCess) / 100;
        individualTotal      = taxableAmount + totalTaxAmount + cessAmount + additionalCessAmount;
      }

      return {
        ...godown,
        basePrice:            Number(basePrice),
        discountAmount:       0,
        discountPercentage:   0,
        discountType:         "none",
        taxableAmount:        Number(taxableAmount.toFixed(2)),
        cgstValue:            Number(cgst.toFixed(2)),
        sgstValue:            Number(sgst.toFixed(2)),
        igstValue:            Number(igst.toFixed(2)),
        cessValue:            Number(cess.toFixed(2)),
        addlCessValue:        Number(addlCess.toFixed(2)),
        igstAmount:           Number(igstAmount.toFixed(2)),
        cgstAmount:           Number(cgstAmount.toFixed(2)),
        sgstAmount:           Number(sgstAmount.toFixed(2)),
        cessAmount:           Number(cessAmount.toFixed(2)),
        additionalCessAmount: Number(additionalCessAmount.toFixed(2)),
        individualTotal:      Number(individualTotal.toFixed(2)),
        isTaxIncluded:        inclusive,
      };
    });

    const total           = updatedGodownList.reduce((sum, g) => sum + g.individualTotal,      0);
    const totalCgstAmt    = updatedGodownList.reduce((sum, g) => sum + g.cgstAmount,           0);
    const totalSgstAmt    = updatedGodownList.reduce((sum, g) => sum + g.sgstAmount,           0);
    const totalIgstAmt    = updatedGodownList.reduce((sum, g) => sum + g.igstAmount,           0);
    const totalCessAmt    = updatedGodownList.reduce((sum, g) => sum + g.cessAmount,           0);
    const totalAddlCessAmt= updatedGodownList.reduce((sum, g) => sum + g.additionalCessAmount, 0);

    return {
      ...item,
      GodownList:      updatedGodownList,
      total,
      totalCgstAmt,
      totalSgstAmt,
      totalIgstAmt,
      totalCessAmt,
      totalAddlCessAmt,
      added:           true,
      taxInclusive:    inclusive,
    };
  });
};

