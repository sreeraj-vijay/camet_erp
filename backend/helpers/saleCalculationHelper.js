const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const normalizeUTCDate = (d) => {
  const nd = new Date(d);
  return new Date(
    Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth(), nd.getUTCDate()),
  );
};

export const calculateStayDays = (doc, room) => {
  const arrival = normalizeUTCDate(doc.arrivalDate);
  const checkout = normalizeUTCDate(doc.checkOutDate);

  if (!room?.swappingDateFrom) {
    const diffDays = Math.floor((checkout - arrival) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : Number(doc?.stayDays || 1);
  }

  const swap = normalizeUTCDate(room.swappingDateFrom);

  let start;
  let end;

  if (room.isSwapped) {
    start = arrival;
    end = swap;
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
              String(swappedRoomObject?.toRoomId?._id || swappedRoomObject?.toRoomId || ""),
      );
      let isRoomSwappedData = doc?.roomSwapHistory?.find(
        (r) =>
          r?.toSelectedRoomId && currentSelectedRoomId
            ? String(r.toSelectedRoomId) === currentSelectedRoomId
            : String(r?.toRoomId?._id || r?.toRoomId || "") === currentRoomId,
      );

      if (swappedRoomData?.isSwapped === false && isRoomSwappedData) {
        start = normalizeUTCDate(swappedRoomData.swappingDateFrom);
        start.setDate(start.getDate() - 1);
      } else {
        console.log(room);
        start = normalizeUTCDate(doc.arrivalDate);
        end = normalizeUTCDate(room.swappingDateFrom);
      }
    }
  } else {
    start = swap;
    end = checkout;
  }

  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

const getEffectiveRoomPrice = (room, roomStayDays) => {
  const nightlyRate =
    Number(room?.priceLevelRate || 0) ||
    Number(room?.baseAmount || 0) / Math.max(Number(room?.stayDays || 1), 1) ||
    0;

  return round2(nightlyRate * roomStayDays);
};

export const calculateTaxAmount = (
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
  const nights = Number(stayDays || 0);

  if (nights <= 0) {
    return {
      taxableAmount: 0,
      roomTaxAmount: 0,
      specificFoodPlanTotal: 0,
      taxableSpecificFoodPlan: 0,
      foodPlanTaxAmount: 0,
      foodPlanTaxPercentage: 0,
      additionalPaxWithTax: 0,
      additionalPaxWithoutTax: 0,
      additionalPaxTaxAmount: 0,
      additionalPaxCount: 0,
    };
  }

  let foodPlanTax = 5;
  if (bookingType === "offline") {
    foodPlanTax = Number(taxPercentage || 0);
  }

  const foodPlanPerNight = (foodPlanArray || []).reduce((acc, item) => {
    return item.roomId?.toString() === roomId?.toString()
      ? acc + Number(item.rate || 0)
      : acc;
  }, 0);

  const specificFoodPlanTotal = round2(foodPlanPerNight * nights);

  const additionalPaxPerNight = (additionalPaxDetails || []).reduce(
    (acc, item) => {
      return item.roomId?.toString() === roomId?.toString()
        ? acc + Number(item.rate || 0)
        : acc;
    },
    0,
  );

  const specificAdditionalPaxDetails = round2(additionalPaxPerNight * nights);

  const additionalPaxCount =
    ((additionalPaxDetails || []).filter(
      (item) => item.roomId?.toString() === roomId?.toString(),
    ).length || 0) * nights;

  const taxableSpecificFoodPlan =
    specificFoodPlanTotal > 0
      ? round2(specificFoodPlanTotal / (1 + foodPlanTax / 100))
      : 0;

  const foodPlanTaxAmount = round2(
    specificFoodPlanTotal - taxableSpecificFoodPlan,
  );

  const originalRoomPrice = round2(Number(roomPrice || 0));

  const amountWithTax = round2(
    Math.max(
      0,
      originalRoomPrice -
        ((doc?.addFoodPlanWithRate ? Number(specificFoodPlanTotal || 0) : 0) +
          (doc?.addPaxWithRate
            ? Number(specificAdditionalPaxDetails || 0)
            : 0)),
    ),
  );

  const taxableAmount =
    amountWithTax > 0
      ? round2(amountWithTax / (1 + Number(taxPercentage || 0) / 100))
      : 0;

  const roomTaxAmount = round2(amountWithTax - taxableAmount);

  const additionalPaxWithoutTax =
    specificAdditionalPaxDetails > 0
      ? round2(
          Number(specificAdditionalPaxDetails) /
            (1 + Number(taxPercentage || 0) / 100),
        )
      : 0;

  const additionalPaxTaxAmount = round2(
    Number(specificAdditionalPaxDetails) - additionalPaxWithoutTax,
  );

  const additionalPaxWithTax = round2(
    additionalPaxWithoutTax + additionalPaxTaxAmount,
  );

  return {
    taxableAmount,
    roomTaxAmount,
    specificFoodPlanTotal,
    taxableSpecificFoodPlan,
    foodPlanTaxAmount,
    foodPlanTaxPercentage: foodPlanTax,
    additionalPaxWithTax,
    additionalPaxWithoutTax,
    additionalPaxTaxAmount,
    additionalPaxCount,
  };
};

export const getFullRoomDetails = (roomData, doc) => {
  const finalData = {
    taxableAmount: 0,
    roomTaxAmount: 0,
    specificFoodPlanTotal: 0,
    taxableSpecificFoodPlan: 0,
    foodPlanTaxAmount: 0,
    additionalPaxWithTax: 0,
    additionalPaxWithoutTax: 0,
    additionalPaxTaxAmount: 0,
    additionalPaxCount: 0,
  };

  const updatedRooms = [];

  for (const room of roomData || []) {
    const roomStayDays = calculateStayDays(doc, room);
   if (roomStayDays <= 0) {
  if (room?.isSwapped || room?.swappingDateFrom) {
    updatedRooms.push({
      ...room,
      stayDays: 0,
      amountWithOutTax: 0,
      amountAfterTax: 0,
      taxAmount: 0,
    });
  }
  continue;
}

    const effectiveRoomPrice = getEffectiveRoomPrice(room, roomStayDays);

    const taxDetails = calculateTaxAmount(
      room.taxPercentage,
      effectiveRoomPrice,
      doc?.addTaxWithRate,
      doc?.foodPlan,
      room?.roomId,
      doc?.bookingType,
      roomStayDays,
      doc?.additionalPaxDetails,
      doc,
    );

    const roomNetAmount = round2(
      taxDetails.taxableAmount + taxDetails.roomTaxAmount,
    );

    updatedRooms.push({
      ...room,
      stayDays: roomStayDays,
      amountWithOutTax: taxDetails.taxableAmount,
      amountAfterTax: roomNetAmount,
      taxAmount: taxDetails.roomTaxAmount,
    });

    finalData.taxableAmount = round2(
      finalData.taxableAmount + taxDetails.taxableAmount,
    );
    finalData.roomTaxAmount = round2(
      finalData.roomTaxAmount + taxDetails.roomTaxAmount,
    );
    finalData.specificFoodPlanTotal = round2(
      finalData.specificFoodPlanTotal + taxDetails.specificFoodPlanTotal,
    );
    finalData.taxableSpecificFoodPlan = round2(
      finalData.taxableSpecificFoodPlan + taxDetails.taxableSpecificFoodPlan,
    );
    finalData.foodPlanTaxAmount = round2(
      finalData.foodPlanTaxAmount + taxDetails.foodPlanTaxAmount,
    );
    finalData.additionalPaxWithTax = round2(
      finalData.additionalPaxWithTax + taxDetails.additionalPaxWithTax,
    );
    finalData.additionalPaxWithoutTax = round2(
      finalData.additionalPaxWithoutTax + taxDetails.additionalPaxWithoutTax,
    );
    finalData.additionalPaxTaxAmount = round2(
      finalData.additionalPaxTaxAmount + taxDetails.additionalPaxTaxAmount,
    );
    finalData.additionalPaxCount = round2(
      finalData.additionalPaxCount + taxDetails.additionalPaxCount,
    );
  }

  return {
    ...finalData,
    updatedRooms,
  };
};

export const handleRecalculateCheckOut = async (
  selectedCheckOut,
  cmp_id,
  session,
) => {
  const updatedItems = [];

  for (const checkout of selectedCheckOut) {
    const roomDetails = getFullRoomDetails(checkout.selectedRooms, checkout);

    console.log("roomsedf", roomDetails);
    const roomTotal = round2(
      roomDetails.taxableAmount + roomDetails.roomTaxAmount,
    );

    const grandTotal = round2(
      roomTotal +
        roomDetails.specificFoodPlanTotal +
        roomDetails.additionalPaxWithTax,
    );

    console.log("roomTotal", roomTotal, grandTotal);

    updatedItems.push({
      ...checkout,
      taxableAmount: roomDetails.taxableAmount,
      roomTaxAmount: roomDetails.roomTaxAmount,
      specificFoodPlanTotal: roomDetails.specificFoodPlanTotal,
      taxableSpecificFoodPlan: roomDetails.taxableSpecificFoodPlan,
      foodPlanTaxAmount: roomDetails.foodPlanTaxAmount,
      additionalPaxWithTax: roomDetails.additionalPaxWithTax,
      additionalPaxWithoutTax: roomDetails.additionalPaxWithoutTax,
      additionalPaxTaxAmount: roomDetails.additionalPaxTaxAmount,
      additionalPaxCount: roomDetails.additionalPaxCount,
      selectedRooms: roomDetails.updatedRooms,
      roomTotal,
      grandTotal,
      totalAmount: grandTotal,
      balanceToPay: grandTotal - Number(checkout.totalAdvance || 0),
    });
  }

  return updatedItems;
};
