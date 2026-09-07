import { useEffect, useState, useCallback, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import api from "@/api/api";
import { toast } from "sonner";

import { Users, Utensils, Trash2, SlidersHorizontal } from "lucide-react";
import { taxCalculator } from "../Helper/taxCalculator";
import { FaHistory } from "react-icons/fa";
import TariffHistory from "./TariffHistory";
import {
  reArrangeFoodPlan,
  reArrangeAdditionalPaxDetails,
} from "../Helper/hotelHelper";

// Visual Room Card Component
function RoomCard({ room, isSelected, isBooked, onClick, disabled }) {
  const getCardColor = () => {
    if (disabled || isBooked) return "bg-gray-300 cursor-not-allowed";
    if (isSelected) return "bg-blue-500 text-white";
    return "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer";
  };

  return (
    <div
      onClick={!disabled && !isBooked ? onClick : undefined}
      className={`${getCardColor()} rounded-lg p-2 transition-all duration-200 transform hover:scale-105 shadow-md min-h-[50px] flex flex-col items-center justify-center`}
    >
      <span className="text-lg font-bold">
        {room.roomNumber || room.roomName}
      </span>
      {room.roomType?.brand && (
        <span className="text-[10px] mt-0.5 opacity-90 truncate max-w-full">
          {room.roomType.brand}
        </span>
      )}
    </div>
  );
}

// Visual Room Selector Component
function VisualRoomSelector({
  rooms,
  selectedRooms,
  bookedRoomIds,
  onRoomSelect,
  loading,
  disabled,
}) {
  return (
    <div className="w-full bg-gray-50 border rounded-xl p-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Select Rooms (Click to add)
      </h3>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-lg h-12 animate-pulse"
            ></div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No rooms available for selected dates
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {rooms.map((room) => {
            const isBooked = bookedRoomIds.includes(room._id);
            const isSelected = selectedRooms.some(
              (selected) => selected.roomId === room._id,
            );

            return (
              <RoomCard
                key={room._id}
                room={room}
                isSelected={isSelected}
                isBooked={isBooked}
                onClick={() => onRoomSelect(room)}
                disabled={disabled}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Main AvailableRooms component with visual selection
function AvailableRooms({
  onSelect = () => {},
  placeholder = "Search and select a party...",
  selectedParty = null,
  className = "",
  disabled = false,
  selectedRoomData,
  sendToParent,
  formData,
  selectedRoomId,
  roomFromDashboard = [],
  isTariffRateChange = false,
  roomIdToUpdate = null,
  addTaxWithRate = false,
  handleDeletion = () => {},
  includeFoodRateWithRoom,
  includePaxRateWithRoom,
  sendDataToParent = () => {},
  defaultPax = {},
  defaultFoodPlan = {},
  showRooms = true,
  selectedGuest = null,
  setFormData = () => {},
  forSwap = false,
}) {
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(selectedParty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [pendingRoomQueue, setPendingRoomQueue] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRoomForHistory, setSelectedRoomForHistory] = useState(null);
  const [roomDeletedCompletely, setRoomDeletedCompletely] = useState(false);

  const debounceTimerRef = useRef(null);
  const dropdownRef = useRef(null);
  const PAGE_SIZE = 50;

  console.log(defaultFoodPlan);
  useEffect(() => {
    const fetchBookings = async () => {
      if (formData?.selectedRooms?.length > 0) {
        console.log(formData.selectedRooms);
        const updatedBookings = await Promise.all(
          formData.selectedRooms.map(async (booking) => {
            console.log(booking);
            const normalizedBooking = {
              _id: booking._id,
              roomId: booking.roomId || booking._id,
              roomName: booking.roomName,
              priceLevel: booking.priceLevel || [],
              selectedPriceLevel:
                booking.selectedPriceLevel || booking.priceLevelId,
              roomType: booking.roomType,
              pax: booking.pax || 2,
              priceLevelRate: booking.priceLevelRate || 0,
              stayDays: booking.stayDays,
              hsnDetails: booking.hsnDetails || booking.hsn,
              totalAmount: booking.totalAmount || 0,
              amountAfterTax: booking.amountAfterTax,
              amountWithOutTax: booking.amountWithOutTax,
              taxPercentage: booking.taxPercentage,
              foodPlanTaxRate: booking.foodPlanTaxRate,
              additionalPaxAmount: booking.additionalPaxAmount,
              foodPlanAmount: booking.foodPlanAmount,
              taxAmount: booking.taxAmount,
              additionalPaxAmountWithTax: booking.additionalPaxAmountWithTax,
              additionalPaxAmountWithOutTax:
                booking.additionalPaxAmountWithOutTax,
              foodPlanAmountWithTax: booking.foodPlanAmountWithTax,
              foodPlanAmountWithOutTax: booking.foodPlanAmountWithOutTax,
              baseAmount: booking.baseAmount,
              baseAmountWithTax: booking.baseAmountWithTax,
              totalCgstAmt: booking.totalCgstAmt,
              totalSgstAmt: booking.totalSgstAmt,
              totalIgstAmt: booking.totalIgstAmt,
              dateTariffs: booking.dateTariffs || {},
              isSwapped: booking.isSwapped,
              swappingDateFrom: booking.swappingDateFrom,
              otherChargeDetails: booking.otherChargeDetails,
              discountAmount: booking.discountAmount,
              otherChargeAmount: booking.otherChargeAmount,
            };
            const taxCalculation = await calculateTax(normalizedBooking);
            return taxCalculation;
          }),
        );
        console.log(updatedBookings);
        setBookings(updatedBookings);
      } else if (rooms?.length > 0 && selectedRoomId) {
        console.log(rooms);
        let specificRoom = rooms.find((room) => room._id === selectedRoomId);
        if (specificRoom) {
          handleSelect(specificRoom);
        }
      } else if (roomFromDashboard?.length > 0 && !roomDeletedCompletely) {
        console.log(roomFromDashboard);
        console.log(roomFromDashboard);
        roomFromDashboard.map((room) => {
          let specificRoom = rooms.find((roomId) => roomId._id === room.roomId);
          console.log(specificRoom);
          handleSelect(specificRoom);
        });
      }
    };

    fetchBookings();
  }, [
    formData?.selectedRooms?.length,
    formData?.stayDays,
    rooms?.length,
    isTariffRateChange,
    roomIdToUpdate,
    selectedRoomId,
  ]);

  useEffect(() => {
    if (!formData?.additionalPaxDetails && !formData?.foodPlan) return;
    if (!selectedRoomId) return;

    const bookingData = bookings?.find(
      (item) => item.roomId === selectedRoomId,
    );

    const recalculateTax = async () => {
      if (bookingData) {
        const taxCalculation = await calculateTax(bookingData);
        setBookings((prev) =>
          prev.map((b) => (b.roomId === selectedRoomId ? taxCalculation : b)),
        );
      }
    };

    recalculateTax();
  }, [formData?.additionalPaxDetails, formData?.foodPlan, selectedRoomId]);

  useEffect(() => {
    if (!formData?.bookingType) return;

    const handleBookingTypeChange = async () => {
      if (bookings?.length > 0) {
        const updatedBookings = await Promise.all(
          bookings.map(async (booking) => {
            const taxCalculation = await calculateTax(booking);
            return taxCalculation;
          }),
        );
        setBookings(updatedBookings);
      }
    };

    handleBookingTypeChange();
  }, [formData?.bookingType]);

  const { _id: cmp_id } = useSelector(
    (state) => state.secSelectedOrganization.secSelectedOrg,
  );

  const location = useLocation();

  const fetchRooms = useCallback(
    async (pageNum = 1, searchTerm = "") => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page: pageNum,
          limit: PAGE_SIZE,
          search: searchTerm,
          type: formData?.roomType || "All",
        };

        if (formData?.arrivalDate) {
          params.arrivalDate = formData.arrivalDate;
        }
        if (formData?.checkOutDate) {
          params.checkOutDate = formData.checkOutDate;
        }

        const res = await api.get(`/api/sUsers/getRooms/${cmp_id}`, {
          params,
          withCredentials: true,
        });

        const newRooms = res.data?.roomData || [];

        const availableRooms = newRooms.filter((room) => {
          const isAlreadyBooked = bookings.some(
            (booking) => booking.roomId === room._id,
          );
          if (isAlreadyBooked) {
            console.log(
              `Filtering out already selected room: ${room.roomName}`,
            );
          }
          return !isAlreadyBooked;
        });

        console.log(
          "Available rooms after filtering out selected:",
          availableRooms.length,
        );

        setRooms((prev) =>
          pageNum === 1 ? availableRooms : [...prev, ...availableRooms],
        );
        setHasMore(availableRooms.length === PAGE_SIZE);
      } catch (err) {
        console.error("Error fetching rooms:", err);
        setError("Failed to load available rooms.");
      } finally {
        setLoading(false);
      }
    },
    [
      cmp_id,
      location.pathname,
      formData?.roomType,
      formData?.arrivalDate,
      formData?.checkOutDate,
      // bookings,
    ],
  );

  useEffect(() => {
    if (!bookings?.length) return;

    const recalc = async () => {
      const updated = await Promise.all(bookings.map(calculateTax));
      setBookings(updated);
    };

    recalc();
  }, [addTaxWithRate]);

  useEffect(() => {
    if (!selectedGuest?.rate) return;
    if (!bookings.length) return;

    let foodPlan = reArrangeFoodPlan(
      selectedGuest.foodPlanArray,
      bookings[0]?.roomId,
    );
    let additionalPaxDetails = reArrangeAdditionalPaxDetails(
      selectedGuest.additionalPaxDetails,
      bookings[0]?.roomId,
    );

    if (foodPlan?.length > 0) {
      setFormData((prev) => ({
        ...prev,
        foodPlan: foodPlan,
        additionalPaxDetails: additionalPaxDetails,
      }));
    }

    setBookings((prev) =>
      prev.map((booking) =>
        booking.roomId?.toString() === roomIdToUpdate?.toString()
          ? {
              ...booking,
              priceLevelRate: Number(selectedGuest.rate) || 0,
            }
          : booking,
      ),
    );
  }, [selectedGuest, roomIdToUpdate]);
  
const recalculateBookingTotals = useCallback(
  (booking) => {
    const checkInDate = formData?.arrivalDate || formData?.checkInDate;
    const checkOutDate = formData?.checkOutDate;

    if (!checkInDate || !checkOutDate) {
      const baseAmount =
        Number(booking.priceLevelRate || 0) *
        Number(booking.stayDays || 0);

      return {
        ...booking,
        totalAmount: baseAmount,
      };
    }

    const normalizeToDate = (d) => {
      const nd = new Date(d);
      nd.setUTCHours(0, 0, 0, 0);
      return nd;
    };

    const stayDates = [];

    let currentDate = normalizeToDate(checkInDate);
    let endDate = normalizeToDate(checkOutDate);

    // Room from which guest was swapped
    if (booking?.isSwapped && booking?.swappingDateFrom) {
      let swappingDate = normalizeToDate(booking.swappingDateFrom);
      let arrivalDate = normalizeToDate(checkInDate);
      const currentSelectedRoomId = String(booking?._id || "");
      const currentRoomId = String(
        booking?.roomId?._id || booking?.roomId || "",
      );

      const swappedRoomObject = formData?.roomSwapHistory?.find(
        (swap) =>
          swap?.fromSelectedRoomId
            ? String(swap.fromSelectedRoomId) === currentSelectedRoomId
            : String(swap?.fromRoomId?._id || swap?.fromRoomId || "") ===
              currentRoomId,
      );

      if (swappedRoomObject?.toRoomId) {
        const swappedRoomData = formData?.selectedRooms?.find(
          (selectedRoom) =>
            swappedRoomObject?.toSelectedRoomId
              ? String(selectedRoom?._id || "") ===
                String(swappedRoomObject.toSelectedRoomId)
              : String(selectedRoom?.roomId?._id || selectedRoom?.roomId || "") ===
                String(
                  swappedRoomObject?.toRoomId?._id ||
                    swappedRoomObject?.toRoomId ||
                    "",
                ),
        );

        const isRoomSwappedData = formData?.roomSwapHistory?.find(
          (swap) =>
            swap?.toSelectedRoomId
              ? String(swap.toSelectedRoomId) === currentSelectedRoomId
              : String(swap?.toRoomId?._id || swap?.toRoomId || "") ===
                currentRoomId,
        );

        if (
          swappedRoomData?.isSwapped === false &&
          isRoomSwappedData
        ) {
          arrivalDate = normalizeToDate(
            swappedRoomData.swappingDateFrom,
          );

          arrivalDate.setUTCDate(
            arrivalDate.getUTCDate() - 1,
          );
        }
      }

      currentDate = arrivalDate;
      endDate = swappingDate;
    }

    // Room into which guest was swapped
    else if (
      !booking?.isSwapped &&
      booking?.swappingDateFrom
    ) {
      currentDate = normalizeToDate(
        booking.swappingDateFrom,
      );

      endDate = normalizeToDate(checkOutDate);
    }

    while (currentDate < endDate) {
      const formattedDate =
        currentDate.toISOString().split("T")[0];

      stayDates.push(formattedDate);

      currentDate.setUTCDate(
        currentDate.getUTCDate() + 1,
      );
    }

    let totalAmount = 0;

    const dateTariffs = booking.dateTariffs || {};
    const defaultRate = Number(
      booking.priceLevelRate || 0,
    );

    const tariffDates = Object.keys(dateTariffs).sort();

    stayDates.forEach((date) => {
      if (dateTariffs[date] != null) {
        totalAmount += Number(dateTariffs[date]);
        return;
      }

      let applicableRate = defaultRate;

      for (let i = tariffDates.length - 1; i >= 0; i--) {
        if (tariffDates[i] <= date) {
          applicableRate = Number(
            dateTariffs[tariffDates[i]],
          );
          break;
        }
      }

      totalAmount += applicableRate;
    });

    return {
      ...booking,

      totalAmount:
        booking.stayDays === 0 ||
        booking.stayDays === "0"
          ? 0
          : totalAmount,
    };
  },
  [formData],
);

  console.log(bookings);
  const calculateTax = useCallback(
    async (booking) => {
      if (!booking) return booking;
      const updatedRoom = recalculateBookingTotals(booking);

      try {
        const taxResponse = await taxCalculator(
          updatedRoom,
          addTaxWithRate,
          formData,
          booking.roomId,
          includeFoodRateWithRoom,
          includePaxRateWithRoom,
        );

        console.log(taxResponse);

        return {
          ...updatedRoom,
          amountAfterTax: taxResponse?.amountWithTax || updatedRoom.totalAmount,
          amountWithOutTax: taxResponse?.amountWithOutTax,
          taxPercentage: taxResponse?.taxRate || 0,
          foodPlanTaxRate: taxResponse?.foodPlanTaxRate || 0,
          additionalPaxAmount: taxResponse?.additionalPaxAmount || 0,
          foodPlanAmount: taxResponse?.foodPlanAmount || 0,
          taxAmount: taxResponse?.taxAmount || 0,
          additionalPaxAmountWithTax:
            taxResponse?.additionalPaxAmountWithTax || 0,
          additionalPaxAmountWithOutTax:
            taxResponse?.additionalPaxAmountWithOutTax || 0,
          foodPlanAmountWithTax: taxResponse?.foodPlanAmountWithTax || 0,
          foodPlanAmountWithOutTax: taxResponse?.foodPlanAmountWithOutTax || 0,
          baseAmount: taxResponse?.baseAmount || 0,
          baseAmountWithTax: taxResponse?.baseAmountWithTax || 0,
          totalCgstAmt: taxResponse?.totalCgstAmt || 0,
          totalSgstAmt: taxResponse?.totalSgstAmt || 0,
          totalIgstAmt: taxResponse?.totalIgstAmt || 0,
        };
      } catch (err) {
        console.error("Tax calculation failed:", err);
        return {
          ...updatedRoom,
          amountAfterTax: updatedRoom.totalAmount,
          taxPercentage: 0,
          additionalPaxAmount: 0,
          foodPlanAmount: 0,
        };
      }
    },
    [formData, addTaxWithRate, recalculateBookingTotals],
  );

  useEffect(() => {
    console.log("hai");
    if (pendingRoomQueue.length === 0) return;

    const roomIdToUpdate = pendingRoomQueue[0];
    const roomToUpdate = bookings.find((b) => b.roomId === roomIdToUpdate);

    if (!roomToUpdate) {
      setPendingRoomQueue((prev) => prev.slice(1));
      return;
    }

    let isMounted = true;

    (async () => {
      const updated = await calculateTax(roomToUpdate);
      if (!isMounted) return;
      setBookings((prev) =>
        prev.map((b) => (b.roomId === roomIdToUpdate ? updated : b)),
      );
      setPendingRoomQueue((prev) => prev.slice(1));
    })();

    return () => {
      isMounted = false;
    };
  }, [pendingRoomQueue, bookings, calculateTax]);

  useEffect(() => {
    console.log("jsdkf");
    if (bookings.length > 0) {
      const total = bookings.reduce(
        (acc, b) => acc + Number(b.amountAfterTax || b.totalAmount || 0),
        0,
      );

      const paxTotal = bookings.reduce((acc, b) => {
        const paxPerDay = Number(b.additionalPaxAmountWithTax || 0);
        const days = Number(b.stayDays || 1);
        return acc + paxPerDay * days;
      }, 0);

      const foodTotal = Number(formData?.foodPlanTotal || 0);
      const finalTotal = total;

      if (roomIdToUpdate && formData?.selectedRooms?.length > 1) {
        const otherRooms = formData.selectedRooms.filter(
          (room) =>
            room.roomId !== roomIdToUpdate && room._id !== roomIdToUpdate,
        );

        const allRooms = [...otherRooms, ...bookings];

        const allRoomsTotal = allRooms.reduce(
          (acc, b) => acc + Number(b.amountAfterTax || b.totalAmount || 0),
          0,
        );

        const allRoomsPaxTotal = allRooms.reduce((acc, b) => {
          const paxPerDay = Number(b.additionalPaxAmountWithTax || 0);
          const days = Number(b.stayDays || 1);
          return acc + paxPerDay * days;
        }, 0);

        const allRoomsFinalTotal = allRoomsTotal + allRoomsPaxTotal + foodTotal;
        setTotalAmount(allRoomsFinalTotal);
        sendToParent(allRooms, allRoomsFinalTotal);
      } else {
        setTotalAmount(finalTotal);
        sendToParent(bookings, finalTotal);
      }
    } else {
      setTotalAmount(0);
      sendToParent([], 0);
    }
  }, [
    bookings,
    formData?.foodPlanTotal,
    roomIdToUpdate,
    // sendToParent,
  ]);

  const handlePriceLevelChange = (e, roomId) => {
    const selectedLevelId = e.target.value;

    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.roomId !== roomId) return booking;

        const level = booking.priceLevel.find((p) => {
          return (
            p._id === selectedLevelId || p.priceLevel?._id === selectedLevelId
          );
        });

        let newRate = 0;
        if (level) {
          newRate = level?.priceRate || level?.priceLevel?.priceRate || 0;
        } else if (selectedLevelId === booking?.roomType?._id) {
          newRate = booking.roomType?.roomRent || 0;
        }

        return {
          ...booking,
          selectedPriceLevel: selectedLevelId,
          priceLevelRate: newRate,
          totalAmount: Number(booking.stayDays || 0) * Number(newRate),
        };
      }),
    );

    setPendingRoomQueue((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId],
    );
  };

  const handleDaysChange = (e, roomId) => {
    const newDays = Number(e.target.value || 0);

    setBookings((prev) =>
      prev.map((b) =>
        b.roomId === roomId
          ? { ...b, stayDays: newDays, totalAmount: newDays * b.priceLevelRate }
          : b,
      ),
    );
    setPendingRoomQueue((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId],
    );
  };

  const handlePriceLevelRateChange = (e, roomId, validate = false) => {
    let value = e.target.value;
    if (validate) {
      let selectedRoom = bookings.find((b) => b.roomId === roomId) || 0;
      const minimumRate =
        Number(selectedRoom?.foodPlanAmountWithTax || 0) +
        Number(selectedRoom?.additionalPaxAmountWithTax || 0);
      if (Number(value) < 0 || Number(value) < minimumRate) {
        toast.error(
          "Rate cannot be less than sum of food plan amount or additional pax amount",
        );
        value = minimumRate;
      }
    }
    const newRate = value === "" ? "" : Number(value); // allow empty input
    console.log("Rate Change - New Rate:", newRate, "for Room:", roomId);
    if (isTariffRateChange) {
      setBookings((prev) =>
        prev.map((b) =>
          b.roomId === roomId
            ? {
                ...b,
                dateTariffs: {
                  ...b.dateTariffs,
                  [formData?.currentDate]: newRate,
                },
              }
            : b,
        ),
      );
    } else {
      console.log(
        "Rate Change - New Rate:",
        newRate,
        "for Room:",
        roomId,
        bookings,
      );
      console.log("sdf", newRate * (bookings[0].stayDays || 1));
      setBookings((prev) =>
        prev.map((b) =>
          b.roomId === roomId
            ? {
                ...b,
                priceLevelRate: newRate,
                totalAmount: newRate * (b.stayDays || 1),
              }
            : b,
        ),
      );
    }

    setPendingRoomQueue((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId],
    );
  };

  const handlePaxChange = (e, roomId) => {
    console.log(e.target.value);
    let newPax = Number(e.target.value || 1);
    if (newPax <= 0 || newPax > 2) {
      newPax = 2;
    }
    setBookings((prev) =>
      prev.map((b) => (b.roomId === roomId ? { ...b, pax: newPax } : b)),
    );
    setPendingRoomId(roomId);
  };

  const handleDelete = (roomId) => {
    console.log(roomId);
    if (isTariffRateChange) {
      toast.error("Cannot delete room while in tariff rate change mode");
      return;
    }
    let selectedRoom = bookings.find((b) => b.roomId === roomId);
    console.log(selectedRoom);
    if (selectedRoom.swappingDateFrom) {
      console.log(selectedRoom);
      console.log(formData.roomSwapHistory);
      // Collect all fromRoomIds for this roomId
      const fromRoomIds = (formData.roomSwapHistory || [])
        .filter((b) => String(b.toRoomId) === String(roomId))
        .map((b) => String(b.fromRoomId));

      console.log(fromRoomIds);
      if (fromRoomIds.length === 0) return;
      console.log(fromRoomIds);
      const updatedBookings = bookings.map((booking) => {
        const bookingId = String(booking.roomId);

        if (fromRoomIds.includes(bookingId)) {
          return {
            ...booking,
            isSwapped: false,
            swappingDateFrom: "",
          };
        }

        return booking;
      });

      console.log(updatedBookings);
      let filteredRoom = updatedBookings.filter((b) => b.roomId !== roomId);
      if (filteredRoom.length === 0) setRoomDeletedCompletely(true);
      setBookings(filteredRoom);
    } else {
      console.log(selectedRoom);
      let filteredRoom = bookings.filter((b) => b.roomId !== roomId);
      if (filteredRoom.length === 0) setRoomDeletedCompletely(true);
      setBookings(filteredRoom);
      console.log(filteredRoom);
      handleDeletion(roomId);
    }
  };

  const handleSelect = async (room) => {
    console.log(room, defaultFoodPlan);
    let defaultRate = 0;
    let foodPlan = [];
    let additionalPaxDetails = [];
    if (selectedGuest) {
      console.log(room);
      defaultRate = selectedGuest?.rate;
      foodPlan = reArrangeFoodPlan(selectedGuest.foodPlanArray, room?._id);
      additionalPaxDetails = reArrangeAdditionalPaxDetails(
        selectedGuest.additionalPaxDetails,
        room?._id,
      );

      console.log("foodPlan", foodPlan);
    } else {
      defaultRate =
        room?.priceLevel[0]?.priceRate || room?.roomType?.roomRent || 0;
    }

    if (defaultFoodPlan && !forSwap) {
      const newPlan = {
        foodPlanId: defaultFoodPlan?._id,
        foodPlan: defaultFoodPlan?.foodPlan,
        rate: defaultFoodPlan?.amount,
        roomId: room?._id,
        isDefault: defaultFoodPlan?.isDefault,
        isComplimentary: defaultFoodPlan?.isComplimentary,
      };
      foodPlan.push(newPlan);
    }

    const stayDays = formData?.stayDays || 1;

    let booking = {
      roomId: room._id,
      roomName: room.roomName,
      priceLevel: room.priceLevel || [],
      selectedPriceLevel: room.priceLevel[0]?._id || room.roomType?._id,
      roomType: room.roomType,
      pax: 2,
      priceLevelRate: defaultRate,
      stayDays,
      hsnDetails: room.hsn,
      totalAmount: defaultRate * stayDays,
    };

    booking = await calculateTax(booking);
    setBookings((prev) =>
      prev.some((b) => b.roomId === booking.roomId) ? prev : [...prev, booking],
    );
    if (foodPlan?.length > 0) {
      setFormData((prev) => ({
        ...prev,
        foodPlan: [...(prev.foodPlan || []), ...foodPlan],
        additionalPaxDetails,
      }));
    }

    setSelectedValue(room);
    setSearch("");
    onSelect(room);
  };

  const handleSearch = useCallback(
    (term) => {
      console.log("termmmm", term);
      setSearch(term);
      setPage(1);
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => fetchRooms(1, term), 300);
    },
    [fetchRooms],
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchRooms(nextPage, search);
    }
  }, [loading, hasMore, page, fetchRooms, search]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) loadMore();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => setSelectedValue(selectedParty), [selectedParty]);
  useEffect(() => {
    if (cmp_id) fetchRooms(1);
  }, [cmp_id, fetchRooms]);

  useEffect(() => () => clearTimeout(debounceTimerRef.current), []);

  // Add this useEffect after your existing useEffects, before the console.log(bookings)
  useEffect(() => {
    // Refresh rooms when bookings change to update the dropdown
    if (isOpen && cmp_id) {
      fetchRooms(1, search);
    }
  }, [bookings.length]); // Triggers when rooms are added/removed from bookings

  const handleTariffDelete = (editedTariff) => {
    setBookings((prev) =>
      prev.map((booking, index) =>
        index === 0 ? { ...booking, dateTariffs: editedTariff } : booking,
      ),
    );
    setPendingRoomQueue((prev) =>
      prev.includes(roomIdToUpdate) ? prev : [...prev, roomIdToUpdate],
    );
  };

  const handleAdditionalPaxChange = (e, roomId, booking) => {
    selectedRoomData(booking?.roomId, "increasePaxCount");

    const count = Number(e.target.value);
    console.log(formData?.additionalPaxDetails, roomId);
    const roomPaxLength =
      formData?.additionalPaxDetails?.filter((pax) => pax.roomId === roomId)
        ?.length || 0;

    const defaultCount =
      formData?.additionalPaxDetails?.filter(
        (pax) => pax.roomId === roomId && pax.isDefault,
      )?.length || 0;

    console.log(count, roomPaxLength);
    // Remove
    if (count < roomPaxLength) {
      if (defaultCount < 1) {
        toast.error("Please select at least one default pax");
        return;
      }

      const additionalPaxDetails = [...(formData.additionalPaxDetails || [])];

      const index = additionalPaxDetails.findIndex(
        (pax) => pax.roomId === roomId && pax.isDefault,
      );

      if (index !== -1) {
        additionalPaxDetails.splice(index, 1);
      }

      setFormData((prev) => ({
        ...prev,
        additionalPaxDetails: additionalPaxDetails,
        paxTotal: additionalPaxDetails?.reduce(
          (acc, item) => acc + Number(item.rate),
          0,
        ),
      }));
    }

    // Add
    else {
      const newPax = {
        paxID: defaultPax?._id,
        paxName: defaultPax?.additionalPaxName,
        rate: defaultPax?.amount,
        roomId,
        isDefault: defaultPax?.isDefault,
      };
      const updatedAdditionalPaxDetails = [
        ...(formData?.additionalPaxDetails || []),
        newPax,
      ];
      setFormData((prev) => ({
        ...prev,
        additionalPaxDetails: updatedAdditionalPaxDetails,
        paxTotal: updatedAdditionalPaxDetails?.reduce(
          (acc, item) => acc + Number(item.rate),
          0,
        ),
      }));

      // sendDataToParent(updatedAdditionalPaxDetails, booking);
    }
  };
  const handleAdditionalFoodPlanChange = (e, roomId, booking) => {
    selectedRoomData(booking?.roomId, "increasePaxCount");

    const count = Number(e.target.value);

    const roomPlanLength =
      formData?.foodPlan?.filter((pax) => pax.roomId === roomId)?.length || 0;

    const defaultCount =
      formData?.foodPlan?.filter(
        (pax) => pax.roomId === roomId && pax.isDefault,
      )?.length || 0;

    // Remove
    if (count < roomPlanLength) {
      if (defaultCount < 1) {
        toast.error("Please select at least one default food plan");
        return;
      }

      const additionalFoodPlanDetails = [...(formData.foodPlan || [])];

      const index = additionalFoodPlanDetails.findIndex(
        (pax) => pax.roomId === roomId && pax.isDefault,
      );

      if (index !== -1) {
        additionalFoodPlanDetails.splice(index, 1);
      }
      setFormData((prev) => ({
        ...prev,
        foodPlan: additionalFoodPlanDetails,
        foodPlanTotal: additionalFoodPlanDetails?.reduce(
          (acc, item) => acc + Number(item.rate),
          0,
        ),
      }));
    }

    // Add
    else {
      const newPlan = {
        foodPlanId: defaultFoodPlan?._id,
        foodPlan: defaultFoodPlan?.foodPlan,
        rate: defaultFoodPlan?.amount,
        roomId,
        isDefault: defaultFoodPlan?.isDefault,
        isComplimentary: defaultFoodPlan?.isComplimentary,
      };

      console.log(defaultFoodPlan);
      const updatedAdditionalFoodPlanDetails = [
        ...(formData?.foodPlan || []),
        newPlan,
      ];
      setFormData((prev) => ({
        ...prev,
        foodPlan: updatedAdditionalFoodPlanDetails,
        foodPlanTotal: updatedAdditionalFoodPlanDetails?.reduce(
          (acc, item) => acc + Number(item.rate),
          0,
        ),
      }));

      // sendDataToParent(updatedAdditionalPaxDetails, booking);
    }
  };

  console.log(bookings)

  const bookedRoomIds = bookings.map((b) => b.roomId);
  return showHistory ? (
    <TariffHistory
      isOpen={showHistory}
      onClose={() => setShowHistory(false)}
      booking={bookings?.find((b) => b.roomId === selectedRoomForHistory)}
      formData={formData}
      sendUpdatedTariffToParent={handleTariffDelete}
    />
  ) : (
    <>
      {/* Visual Room Selector - Only show when NOT in tariff rate change mode */}
      {!isTariffRateChange && showRooms && (
        <VisualRoomSelector
          rooms={rooms}
          selectedRooms={bookings}
          bookedRoomIds={bookedRoomIds}
          onRoomSelect={handleSelect}
          loading={loading}
          disabled={disabled}
          showRooms={showRooms}
        />
      )}

      {/* Selected Rooms Table */}
      {bookings.length > 0 && (
        <div className="w-full max-w-full mx-auto p-2 mt-4">
          <div className="bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden border border-white/20 rounded-lg">
            <div className="overflow-auto max-h-[80vh]">
              <table className="w-full min-w-max table-auto border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-gray-900 to-gray-800">
                    <th className="w-8 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      #
                    </th>
                    <th className="w-28 px-2 py-2 text-left text-xs font-bold text-white uppercase">
                      Room
                    </th>
                    <th className="w-20 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Level
                    </th>
                    <th className="w-16 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Rate
                    </th>
                    <th className="w-12 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Days
                    </th>
                    <th className="w-12 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Pax
                    </th>
                    <th className="w-10 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      EX.Pax
                    </th>
                    {/* <th className="w-12 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Food
                    </th> */}
                    <th className="w-12 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      DFP
                    </th>
                    <th className="w-12 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Tax
                    </th>
                    <th className="w-20 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Total
                    </th>

                    <th className="w-20 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Net Amt
                    </th>

                    <th className="w-32 px-1 py-2 text-center text-xs font-bold text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings
                    .filter((booking) => {
                      if (roomIdToUpdate) {
                        return (
                          booking.roomId?.toString() ===
                            roomIdToUpdate.toString() ||
                          booking.roomId?._id?.toString() ===
                            roomIdToUpdate.toString()
                        );
                      }
                      console.log(booking);
                      return true;
                    })
                    .map((booking, index) => {
                      const foodPlanSelected =
                        formData?.foodPlan?.filter(
                          (pax) => pax.roomId === booking.roomId,
                        )[0] || defaultFoodPlan;

                      return (
                        <tr
                          key={booking?.roomId}
                          className={`transition-all duration-200
    ${
      booking?.isSwapped
        ? "bg-red-100 text-red-700 opacity-80 pointer-events-none"
        : "hover:bg-blue-50/50"
    }
  `}
                        >
                          <td className="px-1 py-1 text-center font-medium text-blue-600 text-xs">
                            {index + 1}
                          </td>

                          <td className="px-2 py-1">
                            <div className="min-w-0">
                              <p className="font-medium text-emerald-600 text-xs truncate">
                                {booking.roomName}
                              </p>
                              <p className="text-red-500 text-xs truncate">
                                {booking.roomType?.brand}
                              </p>
                            </div>
                          </td>

                          <td className="px-1 py-1">
                            {booking.priceLevel &&
                            booking.priceLevel.length > 0 ? (
                              <select
                                value={booking.selectedPriceLevel || ""}
                                onChange={(e) =>
                                  handlePriceLevelChange(e, booking.roomId)
                                }
                                disabled={isTariffRateChange ? true : false}
                                className="w-full px-1 py-1 border border-red-300 rounded text-red-600 bg-red-50 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                              >
                                {booking.priceLevel.map((priceLevel) => {
                                  const levelId =
                                    priceLevel._id ||
                                    priceLevel.priceLevel?._id;
                                  const levelName =
                                    priceLevel.pricelevel ||
                                    priceLevel.priceLevel?.pricelevel ||
                                    "Unknown";

                                  return (
                                    <option key={levelId} value={levelId}>
                                      {levelName}
                                    </option>
                                  );
                                })}
                                {booking?.roomType && (
                                  <option value={booking?.roomType?._id}>
                                    Normal (₹{booking?.roomType?.roomRent || 0})
                                  </option>
                                )}
                              </select>
                            ) : (
                              <span className="text-red-500 text-xs">
                                No Level
                              </span>
                            )}
                          </td>

                          {!isTariffRateChange ? (
                            <td className="px-1 py-1">
                              <input
                                type="number"
                                value={booking.priceLevelRate}
                                onChange={(e) =>
                                  handlePriceLevelRateChange(e, booking.roomId)
                                }
                                onBlur={(e) =>
                                  handlePriceLevelRateChange(
                                    e,
                                    booking.roomId,
                                    true,
                                  )
                                }
                                min="-1"
                                step="0.01"
                                className="w-full px-1 py-1 border border-red-300 rounded text-red-600 bg-red-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                              />
                            </td>
                          ) : (
                            <td className="px-1 py-1">
                              <input
                                type="number"
                                value={
                                  booking?.dateTariffs?.[
                                    formData?.currentDate
                                  ] ?? booking?.priceLevelRate
                                }
                                onChange={(e) =>
                                  handlePriceLevelRateChange(e, booking.roomId)
                                }
                                min="-1"
                                step="0.01"
                                className="w-full px-1 py-1 border border-red-300 rounded text-red-600 bg-red-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                              />
                            </td>
                          )}

                          <td className="px-1 py-1">
                            <input
                              type="number"
                              value={booking.stayDays || 0}
                              disabled={true}
                              // onChange={(e) =>
                              //   handleDaysChange(e, booking.roomId)
                              // }
                              min="0"
                              className="w-full px-1 py-1 border border-purple-300 rounded text-purple-600 bg-purple-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </td>

                          <td className="px-1 py-1 disabled ">
                            <input
                              type="number"
                              value={booking.pax || 2}
                              onChange={(e) =>
                                handlePaxChange(e, booking.roomId)
                              }
                              disabled={isTariffRateChange ? true : false}
                              min="1"
                              max={2}
                              className=" disabled w-full px-1 py-1 border border-emerald-300 rounded font-medium text-emerald-600 bg-emerald-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          <td className="px-1 py-1 text-center text-emerald-600 font-bold text-xs">
                            <input
                              type="number"
                              value={
                                formData?.additionalPaxDetails?.filter(
                                  (pax) => pax.roomId === booking.roomId,
                                )?.length || 0
                              }
                              onChange={(e) =>
                                handleAdditionalPaxChange(
                                  e,
                                  booking.roomId,
                                  booking,
                                )
                              }
                              disabled={isTariffRateChange}
                              min="0"
                              className="w-full px-1 py-1 border border-emerald-300 rounded font-medium text-emerald-600 bg-emerald-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          {/* <td className="px-1 py-1 text-center text-emerald-600 font-bold text-xs">
                          <input
                            type="number"
                            value={
                              formData?.foodPlan?.filter(
                                (pax) => pax.roomId === booking.roomId,
                              )?.length || 0
                            }
                            onChange={(e) =>
                              handleAdditionalFoodPlanChange(
                                e,
                                booking.roomId,
                                booking,
                              )
                            }
                            disabled={isTariffRateChange}
                            min="0"
                            className="w-full px-1 py-1 border border-emerald-300 rounded font-medium text-emerald-600 bg-emerald-50 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td> */}
                          <td className="px-1 py-1 text-center text-emerald-600 font-bold text-xs">
                            <span className="block">
                              {foodPlanSelected
                                ? foodPlanSelected.foodPlan
                                : ""}
                            </span>

                            <span className="block text-[10px] text-gray-500 font-normal">
                              {foodPlanSelected
                                ? foodPlanSelected.amount ||
                                  foodPlanSelected.rate
                                : ""}
                            </span>
                          </td>
                          <td className="px-1 py-1 text-center text-emerald-600 font-bold text-xs">
                            {Number(booking.taxPercentage || 0).toFixed(1)}%
                          </td>
                          <td className="px-1 py-1">
                            <div className="text-center">
                              <span className="block font-bold text-emerald-600 text-xs leading-tight">
                                ₹{Number(booking.totalAmount || 0).toFixed(0)}
                              </span>
                              {addTaxWithRate && (
                                <span className="block text-gray-600 text-xs leading-tight">
                                  ₹
                                  {(
                                    Number(booking.totalAmount || 0) /
                                    (1 + (booking.taxPercentage || 0) / 100)
                                  ).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-1 py-1 text-center text-emerald-600 font-bold text-xs">
                            ₹
                            {Number(
                              booking.amountAfterTax ||
                                booking.totalAmount ||
                                0,
                            )}
                          </td>
                          {/* 
                        <td className="px-1 py-1 text-center text-emerald-600 text-xs">
                          <div className="max-w-16 truncate">
                            {formData?.foodPlan
                              ?.filter((item) => item.roomId === booking.roomId)
                              .map((item, index) => (
                                <span key={index} className="block truncate">
                                  {item.foodPlan || 0}
                                </span>
                              )) || "None"}
                          </div>
                        </td> */}

                          <td className="px-1 py-1">
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-center gap-1">
                                <div className="text-center">
                                  <button
                                    onClick={() => {
                                      selectedRoomData(
                                        booking?.roomId,
                                        "addPax",
                                      );
                                      setPendingRoomId(booking.roomId);
                                    }}
                                    disabled={isTariffRateChange ? true : false}
                                    className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-1 rounded text-xs font-medium hover:from-orange-600 hover:to-amber-600 transition-all duration-200 flex items-center gap-1"
                                  >
                                    <Users className="w-3 h-3" />
                                    Pax
                                  </button>
                                  <div className="text-xs font-bold text-blue-700 mt-1">
                                    {booking?.stayDays > 1 ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-500">
                                          {booking?.stayDays} × ₹
                                          {(
                                            booking?.additionalPaxAmountWithTax /
                                              booking?.stayDays || 0
                                          ).toFixed(0)}
                                        </span>
                                        <span className="text-xs font-bold">
                                          ₹
                                          {Number(
                                            booking?.additionalPaxAmountWithTax ||
                                              0,
                                          ).toFixed(0)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span>
                                        ₹
                                        {Number(
                                          booking?.additionalPaxAmountWithTax ||
                                            0,
                                        ).toFixed(0)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-center">
                                  <button
                                    onClick={() => {
                                      selectedRoomData(
                                        booking?.roomId,
                                        "addFoodPlan",
                                      );
                                      setPendingRoomId(booking.roomId);
                                    }}
                                    disabled={isTariffRateChange ? true : false}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-1 rounded text-xs font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 flex items-center gap-1"
                                  >
                                    <Utensils className="w-3 h-3" />
                                    Food
                                  </button>
                                  <p className="text-xs font-bold text-blue-700 mt-1">
                                    {booking?.stayDays > 1 ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-500">
                                          {booking?.stayDays} × ₹
                                          {Number(
                                            (
                                              booking?.foodPlanAmountWithOutTax /
                                                booking?.stayDays || 0
                                            ).toFixed(0),
                                          )}
                                        </span>

                                        <span className="text-xs font-bold">
                                          ₹
                                          {Number(
                                            booking?.foodPlanAmountWithTax || 0,
                                          ).toFixed(0)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span>
                                        ₹
                                        {Number(
                                          booking?.foodPlanAmountWithTax || 0,
                                        ).toFixed(0)}
                                      </span>
                                    )}
                                  </p>
                                </div>

                                <div className="text-center">
                                  <button
                                    onClick={() => {
                                      selectedRoomData(
                                        booking?.roomId,
                                        "addAdjustment",
                                      );
                                      setPendingRoomId(booking.roomId);
                                    }}
                                    disabled={isTariffRateChange ? true : false}
                                    className="bg-gradient-to-r from-red-500 to-rose-500 text-white px-2 py-1 rounded text-xs font-medium hover:from-red-600 hover:to-rose-600 transition-all duration-200 flex items-center gap-1"
                                  >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    Adj
                                  </button>
                                  <p className="text-xs font-bold text-blue-700 mt-1">
                                    {booking?.otherChargeDetails?.length > 0 ? (
                                      <div className="flex flex-col items-center">
                                        {booking?.discountAmount > 0 && (
                                          <span className="text-[10px] text-red-500">
                                            Dis :{" "}
                                            {booking?.discountAmount.toFixed(2)}
                                          </span>
                                        )}
                                        {booking?.otherChargeAmount > 0 && (
                                          <span className="text-[10px] text-blue-500">
                                            Oth :{" "}
                                            {booking?.otherChargeAmount.toFixed(
                                              2,
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span>₹{Number(0).toFixed(0)}</span>
                                    )}
                                  </p>
                                </div>

                                {!isTariffRateChange && (
                                  <button
                                    onClick={() => handleDelete(booking.roomId)}
                                    className="text-white px-2 py-1 rounded hover:from-red-600 hover:to-rose-600 transition-all duration-200 flex items-center"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setSelectedRoomForHistory(booking.roomId);
                                    setShowHistory(true);
                                  }}
                                  className="text-white px-2 py-1 rounded hover:from-red-600 hover:to-rose-600 transition-all duration-200 flex items-center"
                                >
                                  <FaHistory className="w-3 h-3 text-yellow-600" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Total Row */}
                  <tr className="bg-gray-100 font-bold sticky bottom-0">
                    <td
                      colSpan={6}
                      className="px-2 py-2 text-right font-bold text-gray-700 text-sm"
                    >
                      Total Amount:
                    </td>
                    <td className="px-1 py-2 text-center font-bold text-blue-700 text-sm">
                      {roomIdToUpdate
                        ? "₹" +
                          bookings.find(
                            (item) => item.roomId === roomIdToUpdate,
                          )?.amountAfterTax
                        : "₹" + Number(totalAmount).toFixed(2)}
                    </td>
                    <td colSpan={3}></td>

                    <td className="px-1 py-2 font-bold text-blue-700 text-center text-xs">
                      <div className="flex gap-2">
                        {bookings.length > 0  && (
                          <span>
                            Pax ₹
                            {Number(
                              bookings.reduce((acc, item) => acc + item.additionalPaxAmountWithTax, 0)
                            ).toFixed(0)}
                          </span>
                        )}
                        {bookings.length > 0 && (
                          <span>
                            Food ₹
                            {Number(
                               bookings.reduce((acc, item) => acc + item.foodPlanAmountWithTax, 0)
                            ).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AvailableRooms;
