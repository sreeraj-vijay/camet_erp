export const calculateDiscountValues = ({
  total,
  inputValue,
  inputType,
  taxPercentage = 0,
  additionalChargeIncludeTax = false,
}) => {
  const baseAmount = Number(total || 0);
  const enteredValue = Number(inputValue || 0);
  const taxRate = Number(taxPercentage || 0);

  let discountAmount = 0;

  if (inputType === "percentage") {
    discountAmount = (baseAmount * Math.min(enteredValue, 100)) / 100;
  } else {
    discountAmount = Math.min(enteredValue, baseAmount);
  }

  discountAmount = Number(discountAmount.toFixed(2));

  let taxAmt = 0;
  let finalValue = 0;

  if (additionalChargeIncludeTax) {
    // amount includes tax
    taxAmt = Number(((discountAmount * taxRate) / (100 + taxRate)).toFixed(2));

    finalValue = discountAmount;
  } else {
    // amount excludes tax
    taxAmt = Number(((discountAmount * taxRate) / 100).toFixed(2));

    finalValue = Number((discountAmount + taxAmt).toFixed(2));
  }

  return {
    value: discountAmount,
    taxAmt,
    finalValue,
  };
};

export const calculateOtherCharges = async ({
  total,
  inputValue,
  inputType,
  taxPercentage = 0,
  discountBasedOnGrossAmount = false,
  formData,
  charge = {}, // 👈 pass selected charge object
  additionalChargeIncludeTax,
}) => {
  const selectedRooms = formData?.selectedRooms || [];
  let value = Number(inputValue || 0);

  if (!value || value <= 0) {
    return {
      rowId: Date.now() + Math.random(),
      _id: charge?._id || "",
      option: charge?.name || "",
      value: 0,
      action: "sub",
      taxPercentage: Number(charge?.taxPercentage || 0),
      taxAmt: 0,
      hsn: charge?.hsn || "",
      finalValue: 0,
      amountType: inputType,
    };
  }

  // ✅ GROSS MODE
  if (discountBasedOnGrossAmount) {
    const baseTotal = Number(total || 0);

    const discountValue =
      inputType === "percentage" ? (baseTotal * value) / 100 : value;

    const taxableValue =
      taxPercentage > 0
        ? (discountValue * 100) / (100 + Number(taxPercentage || 0))
        : discountValue;

    const taxAmt = discountValue - taxableValue;

    return {
      rowId: Date.now() + Math.random(),
      _id: charge?._id || "",
      option: charge?.name || "",
      value,
      action: "sub",
      taxPercentage: Number(charge?.taxPercentage || 0),
      taxAmt: Number(taxAmt.toFixed(2)),
      hsn: charge?.hsn || "",
      finalValue: Number(discountValue.toFixed(2)),
      amountType: inputType,
    };
  }

  // ✅ ITEM-WISE MODE (PROPORTIONAL)
  const items = selectedRooms.map((room) => {
    const taxable = Number(
      room?.amountWithOutTax ??
        room?.baseAmount ??
        Number(room?.priceLevelRate || 0) * Number(room?.stayDays || 0),
    );

    const taxRate = Number(room?.taxPercentage || 0);
    const originalTax = room?.taxAmount ?? (taxable * taxRate) / 100;

    return {
      roomId: room?.roomId,
      roomName: room?.roomName,
      taxable,
      taxRate,
      originalTax,
    };
  });

  const totalTaxable = items.reduce((sum, item) => sum + item.taxable, 0);

  if (totalTaxable <= 0) {
    return {
      rowId: Date.now() + Math.random(),
      _id: charge?._id || "",
      option: charge?.name || "",
      value,
      action: "sub",
      taxPercentage: Number(charge?.taxPercentage || 0),
      taxAmt: 0,
      hsn: charge?.hsn || "",
      finalValue: 0,
      amountType: inputType,
    };
  }

  const totalDiscount =
    inputType === "percentage" ? (totalTaxable * value) / 100 : value;

  let assignedDiscount = 0;

  const itemWiseDiscount = items.map((item, index) => {
    let discountAmount = 0;

    if (index === items.length - 1) {
      discountAmount = totalDiscount - assignedDiscount;
    } else {
      const share = item.taxable / totalTaxable;
      discountAmount = Number((totalDiscount * share).toFixed(2));
      assignedDiscount += discountAmount;
    }

    if (discountAmount > item.taxable) {
      discountAmount = item.taxable;
    }

    const taxableAfterDiscount = item.taxable - discountAmount;
    const newTaxAmt = (taxableAfterDiscount * item.taxRate) / 100;

    const taxReduction = item.originalTax - newTaxAmt;
    const discountImpact = discountAmount + taxReduction;

    return {
      roomId: item.roomId,
      roomName: item.roomName,
      originalTaxable: Number(item.taxable.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxableAfterDiscount: Number(taxableAfterDiscount.toFixed(2)),
      taxRate: item.taxRate,
      originalTaxAmt: Number(item.originalTax.toFixed(2)),
      taxAmt: Number(taxReduction.toFixed(2)),
      finalValue: Number((taxableAfterDiscount + newTaxAmt).toFixed(2)),
      discountImpact: Number(discountImpact.toFixed(2)),
    };
  });

  const totalTaxAmt = itemWiseDiscount.reduce(
    (sum, item) => sum + item.taxAmt,
    0,
  );

  const totalDiscountImpact = itemWiseDiscount.reduce(
    (sum, item) => sum + item.discountImpact,
    0,
  );

  return {
    rowId: Date.now() + Math.random(),
    _id: charge?._id || "",
    option: charge?.name || "",
    value,
    action: "sub",
    taxPercentage: Number(charge?.taxPercentage || 0),
    taxAmt: Number(totalTaxAmt.toFixed(2)),
    hsn: charge?.hsn || "",
    finalValue: Number(totalDiscountImpact.toFixed(2)),
    amountType: inputType,
  };
};

export const getTaxPercentage = (amount, hsnDetails) => {
  const matchedRow = hsnDetails?.rows?.find((row) => {
    const greaterThan = Number(row.greaterThan || 0);
    const upto = Number(row.upto || Infinity);

    return amount > greaterThan && amount <= upto;
  });

  if (!matchedRow) return null;

  return {
    igst: Number(matchedRow.igstRate || 0),
    cgst: Number(matchedRow.cgstRate || 0),
    sgst: Number(matchedRow.sgstUtgstRate || 0),
    totalTax:
      Number(matchedRow.cgstRate || 0) + Number(matchedRow.sgstUtgstRate || 0),
  };
};

export const reArrangeFoodPlan = (foodPlan = [], roomId) => {
  console.log("foodPlan", roomId);
  return foodPlan.map((foodData) => ({
    ...foodData,
    roomId: roomId,
  }));
};

export const reArrangeAdditionalPaxDetails = (additionalPax = [], roomId) => {
  return additionalPax.map((paxData) => ({
    ...paxData,
    roomId: roomId,
  }));
};

export const calculateStayDays = (doc, room, arrival, checkOut, days) => {
  let fullDaysAre = days;
  console.log(room, arrival, checkOut, days);
  console.log(doc);
  const normalizeToDate = (d) => {
    const nd = new Date(d);
    nd.setUTCHours(0, 0, 0, 0);
    return nd;
  };
console.log(room)
  if(room?.roomName == "E1"){
    console.log(room)
    console.log(doc?.roomSwapHistory)
  }

  const swapDate = room?.swappingDateFrom
    ? new Date(room.swappingDateFrom).toISOString().split("T")[0]
    : "";
  if (room.isSwapped && room.swappingDateFrom) {
    let swappingDate = normalizeToDate(room.swappingDateFrom);
    let arrivalDate = normalizeToDate(arrival);
    const currentSelectedRoomId = String(room?._id || "");
    const currentRoomId = String(room?.roomId?._id || room?.roomId || "");

    let swappedRoomObject = doc?.roomSwapHistory?.find(
      (r) =>
        r?.fromSelectedRoomId && currentSelectedRoomId
          ? String(r.fromSelectedRoomId) === currentSelectedRoomId
          : String(r?.fromRoomId?._id || r?.fromRoomId || "") === currentRoomId,
    );

    console.log(swappedRoomObject)

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
        console.log(room)
        arrivalDate = normalizeToDate(swappedRoomData.swappingDateFrom);
        arrivalDate.setDate(arrivalDate.getDate() - 1);
      } else {
        console.log(room);
           arrivalDate = normalizeToDate(arrivalDate);
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
      console.log(fullDaysAre);
  }

  if (!room.isSwapped && room.swappingDateFrom) {
    console.log(room.roomName);
    const swappingDate = normalizeToDate(room.swappingDateFrom);
    const checkoutDate = normalizeToDate(checkOut);

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
console.log(fullDaysAre)
  return fullDaysAre;
};

export const getRoomStayStartDate = (doc, room, arrival) => {
  if (!room?.isSwapped && room?.swappingDateFrom) {
    return room.swappingDateFrom;
  }

  const currentSelectedRoomId = String(room?._id || "");
  const currentRoomId = String(room?.roomId?._id || room?.roomId || "");
  const incomingSwap = doc?.roomSwapHistory?.find((swap) =>
    swap?.toSelectedRoomId
      ? String(swap.toSelectedRoomId) === currentSelectedRoomId
      : String(swap?.toRoomId?._id || swap?.toRoomId || "") === currentRoomId,
  );

  return incomingSwap?.swapDate || incomingSwap?.selectedDate || arrival;
};

export const makeItemComplimentary = (item) => ({
  ...item,
  total: Number(item.basePrice) * Number(item.quantity),
  taxableAmount: Number(item.basePrice) * Number(item.quantity),

  cgstValue: 0,
  sgstValue: 0,
  igstValue: 0,
  cessValue: 0,
  addlCessValue: 0,

  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  cessAmount: 0,
  additionalCessAmount: 0,

  totalCgstAmt: 0,
  totalSgstAmt: 0,
  totalIgstAmt: 0,
  totalCessAmt: 0,
  totalAddlCessAmt: 0,

  individualTotal: Number(item.basePrice),

  GodownList: item.GodownList.map((godown) => ({
    ...godown,
    taxableAmount: Number(godown.quantity) * Number(godown.quantity),

    cgstValue: 0,
    sgstValue: 0,
    igstValue: 0,
    cessValue: 0,
    addlCessValue: 0,

    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    cessAmount: 0,
    additionalCessAmount: 0,

    individualTotal: Number(godown.quantity) * Number(godown.quantity),
  })),
});
