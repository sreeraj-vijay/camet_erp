import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  MapPin,
  Calendar,
  X,
  ArrowRight,
  Phone,
  UserCheck,
} from "lucide-react";
import AvailableRooms from "../Components/AvailableRooms";
import AdditionalPaxDetails from "../Components/AdditionalPaxDetails";
import FoodPlanComponent from "../Components/FoodPlanComponent";
import { toast } from "sonner";
import useFetch from "@/customHook/useFetch";


const RoomSwapModal = ({
  isOpen,
  onClose,
  selectedRoom,
  onConfirmSwap,
  cmp_id,
  api,
}) => {

  console.log(selectedRoom)
  const [checkedInGuests, setCheckedInGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [displayAdditionalPax, setDisplayAdditionalPax] = useState(false);
  const [displayFoodPlan, setDisplayFoodPlan] = useState(false);
  const [formData, setFormData] = useState({});
  const [defaultPax,setDefaultPax] = useState({})
  const [defaultFoodPlan,setDefaultFoodPlan] = useState({})

  useEffect(() => {
    if (isOpen) {
      fetchCheckedInGuests();
    }
  }, [isOpen]);

  const {
    data: defaultPaxResponse,
  } = useFetch(`/api/sUsers/getDefaultPax/${cmp_id}`);
  
  useEffect(() => {
    if (defaultPaxResponse) {
      setDefaultPax(defaultPaxResponse.data);
    }
  }, [defaultPaxResponse]);
  
  
  
  const {
    data: defaultPlanResponse,
  } = useFetch(`/api/sUsers/getDefaultPlan/${cmp_id}`);
  
  useEffect(() => {
    if (defaultPlanResponse) {
      setDefaultFoodPlan(defaultPlanResponse.data);
    }
  }, [defaultPlanResponse]);

  console.log(selectedGuest)

  const fetchCheckedInGuests = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/sUsers/getCheckedInGuests/${cmp_id}`,
        { withCredentials: true },
      );
      setCheckedInGuests(response?.data?.guests || []);
    } catch (error) {
      console.error("Error fetching checked-in guests:", error);
      toast.error("Failed to load checked-in guests");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {}, [selectedGuest, checkedInGuests]);

  const handleSwapRoom = async () => {
    if (!selectedGuest || !selectedRoom) return;

    try {
      setLoading(true);

      const oldRoomId = selectedGuest.room._id;
      const response = await api.put(
        `/api/sUsers/swapRoom/${selectedGuest._id}`,
        {
          newRoomId: selectedRoom?._id,
          oldRoomId,
          oldSelectedRoomId: selectedGuest.selectedRoomId,
          selectedDate,
          formData,
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.data.success) {
        toast.success(
          `Room successfully swapped from ${response.data.swapDetails.fromRoom.name} to ${response.data.swapDetails.toRoom.name}`,
        );
        onConfirmSwap();
        onClose();
      }
    } catch (error) {
      console.error("Error swapping room:", error);
      toast.error(
        `Failed to swap room: ${
          error.response?.data?.message || error.message
        }`,
      );
    } finally {
      setLoading(false);
      setSelectedGuest(null);
      setSelectedGuest(null);
      setCheckedInGuests([]);
      setDisplayAdditionalPax(false);
      setDisplayFoodPlan(false);
      setFormData({});
      setSearchTerm("");
    }
  };

  console.log(formData)
  const flattenedGuests = useMemo(() => {
    return (checkedInGuests || []).flatMap((guest) =>
      (guest?.selectedRooms || [])
        .filter((room) => !room?.isSwapped)
        .map((room, index) => ({
          key: `${guest?._id}-${room?.roomId?._id || room?.roomId}-${index}`,
          _id: guest?._id,
          voucherNumber: guest?.voucherNumber,
          customerName: guest?.customerName,
          guestName: guest?.guestName,
          mobileNumber: guest?.mobileNumber,
          checkInDate: guest?.arrivalDate,
          checkOutDate: guest?.checkOutDate,
          addTaxWithRate: guest?.addTaxWithRate,
          addFoodPlanWithRate: guest?.addFoodPlanWithRate,
          addPaxWithRate: guest?.addPaxWithRate,
          rate:room.priceLevelRate || 0,
          room: {
            _id: room?.roomId?._id || room?.roomId,
            roomName: room?.roomId?.roomName || room?.roomName,
            roomPrice: room?.roomId?.priceLevelRate || 0,
          },
          selectedRoomId: room?._id,
          foodPlanArray : guest?.foodPlan.filter((item) => item.roomId === room?.roomId?._id || item.roomId === room?.roomId),
          additionalPaxDetails: guest?.additionalPaxDetails.filter((item) => item.roomId === room?.roomId?._id || item.roomId === room?.roomId),
        })),
    );
  }, [checkedInGuests]);

  console.log(flattenedGuests)

  const filteredGuests = useMemo(() => {
    const term = searchTerm?.toString().toLowerCase().trim() || "";
    const isNumber = term !== "" && !isNaN(term);

    return flattenedGuests.filter((entry) => {
      return (
        entry?.customerName?.toLowerCase().includes(term) ||
        entry?.voucherNumber?.toString().toLowerCase().includes(term) ||
        (isNumber && entry?.mobileNumber?.toString().includes(term)) ||
        entry?.room?.roomName?.toLowerCase().includes(term)
      );
    });
  }, [flattenedGuests, searchTerm]);

  if (!isOpen) return null;

  console.log(selectedGuest)

  const selectedDetails = (_, to) => {
    if (to === "addPax") setDisplayAdditionalPax(true);
    if (to === "addFoodPlan") setDisplayFoodPlan(true);
  };

  const handleAvailableRoomSelection = () => {};

  const handleAdditionalPaxDetails = (details, room) => {
    const existingDetails = Array.isArray(formData?.additionalPaxDetails)
      ? formData.additionalPaxDetails
      : [];

    const filterData = existingDetails.filter((i) => i.roomId !== room);
    const totalAmount = [...filterData, ...details].reduce(
      (acc, item) => acc + Number(item.rate),
      0,
    );

    setFormData((prev) => ({
      ...prev,
      additionalPaxDetails: [...filterData, ...details],
      paxTotal: totalAmount,
    }));
  };

  const handleFoodPlanData = (details, room) => {
    const existingDetails = Array.isArray(formData?.foodPlan)
      ? formData.foodPlan
      : [];

    const filterData = existingDetails.filter((i) => i.roomId !== room);
    const totalAmount = [...filterData, ...details].reduce(
      (acc, item) => acc + Number(item.rate),
      0,
    );

    setFormData((prev) => ({
      ...prev,
      foodPlan: [...filterData, ...details],
      foodPlanTotal: totalAmount,
    }));
  };

  const handleAvailableRooms = (rooms, total) => {
    if (rooms.length > 0) {
      setFormData((prev) => ({
        ...prev,
        selectedRooms: rooms,
        roomTotal: total,
        stayDays: rooms[0].stayDays,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedRooms: [],
        roomTotal: 0,
      }));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
        <div className="flex min-h-screen items-center justify-center p-2 sm:p-3 lg:p-4">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-800/95 px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-blue-500/10 p-2">
                    <ArrowRight className="h-4 w-4 text-blue-400" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white sm:text-base">
                      Room Swap
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
                      Selected destination room:
                      <span className="ml-1.5 font-medium text-blue-400">
                        {selectedRoom?.roomName || "N/A"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/70 px-3 py-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span className="text-xs whitespace-nowrap text-slate-300 sm:text-sm">
                      From Date
                    </span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="min-w-0 rounded-md bg-transparent px-1 py-0.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setSelectedGuest(null);
                      setCheckedInGuests([]);
                      setDisplayAdditionalPax(false);
                      setDisplayFoodPlan(false);
                      setFormData({});
                      setSearchTerm("");
                      onClose(); // ← now it fires
                    }}
                    className="self-end rounded-full bg-slate-700 p-1.5 text-slate-300 transition hover:bg-red-500/20 hover:text-red-400 sm:self-auto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main */}
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
              {/* Left panel */}
              <div className="flex min-h-0 flex-col border-b border-slate-700 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-700 p-3">
                  <input
                    type="text"
                    placeholder="Search by name, voucher, phone, or room..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white outline-none transition focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
                    </div>
                  ) : filteredGuests.length > 0 ? (
                    <div className="space-y-2.5">
                      {filteredGuests.map((guest) => {
                        const isSelected = selectedGuest?.key === guest.key;

                        return (
                          <button
                            type="button"
                            key={guest.key}
                            onClick={() => setSelectedGuest(guest)}
                            className={`w-full rounded-lg border p-3 text-left text-xs transition-all sm:text-sm ${
                              isSelected
                                ? "border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10"
                                : "border-slate-700 bg-slate-800 hover:border-blue-400 hover:bg-slate-700/80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1.5 flex items-start gap-2">
                                  <div className="space-y-0.5 text-sm text-white">
                                    <p className="truncate font-semibold flex gap-2">
                                      <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                                      <span className="text-slate-300">
                                        Customer:{" "}
                                      </span>
                                      <span>{guest.customerName}</span>
                                    </p>
                                    <p className="truncate font-semibold flex gap-2">
                                      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                                      <span className="text-slate-300">
                                        Guest:{" "}
                                      </span>
                                      <span>{guest.guestName}</span>
                                    </p>
                                  </div>
                                </div>

                                <p className="mb-1 text-[11px] text-slate-400">
                                  Voucher: {guest.voucherNumber || "N/A"}
                                </p>

                                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-300">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-green-400" />
                                  <span className="truncate">
                                    {guest.room?.roomName}
                                  </span>
                                </div>

                                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                                  <span>{guest.mobileNumber || "N/A"}</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <Calendar className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                                  <span>
                                    {guest.checkInDate
                                      ? new Date(
                                          guest.checkInDate,
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </span>
                                </div>
                              </div>

                              {isSelected && (
                                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <User className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                      <p className="text-xs text-slate-400 sm:text-sm">
                        {searchTerm
                          ? "No guests found matching your search"
                          : "No checked-in guests found"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right panel */}
              <div className="flex min-h-0 flex-col bg-slate-900">
                <div className="border-b border-slate-700 p-3 sm:p-4">
                  {selectedGuest ? (
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 sm:p-3.5">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-blue-300">
                        Room Swap Summary
                      </p>
                      <p className="text-xs leading-5 text-slate-200 sm:text-sm">
                        Move{" "}
                        <span className="font-semibold text-white">
                          {selectedGuest.customerName}
                        </span>{" "}
                        from{" "}
                        <span className="font-medium text-red-300">
                          {selectedGuest?.room?.roomName}
                        </span>{" "}
                        to{" "}
                        <span className="font-medium text-green-300">
                          {selectedRoom?.roomName}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-600 bg-slate-800/60 p-4 text-center">
                      <p className="text-xs text-slate-300 sm:text-sm">
                        Select a guest from the left panel to continue the room
                        swap.
                      </p>
                    </div>
                  )}
                </div>
                {selectedRoom && (
                  <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                    {selectedGuest && (
                      <AvailableRooms
                        onSelect={handleAvailableRoomSelection}
                        selectedParty={selectedGuest}
                        selectedRoomData={selectedDetails}
                        setDisplayFoodPlan={setDisplayFoodPlan}
                        sendToParent={handleAvailableRooms}
                        formData={formData}
                        selectedRoomId={selectedRoom?._id}
                        isTariffRateChange={false}
                        roomIdToUpdate={selectedRoom?._id}
                        addTaxWithRate={selectedGuest?.addTaxWithRate}
                        includeFoodRateWithRoom={
                          selectedGuest?.addFoodPlanWithRate
                        }
                        includePaxRateWithRoom={selectedGuest?.addPaxWithRate}
                        defaultFoodPlan ={selectedGuest?.foodPlanArray[0]||{}}
                        defaultPax={defaultPax}
                        showRooms={false}
                        selectedGuest={selectedGuest}
                        setFormData={setFormData}
                        forSwap={true}
                      />
                    )}
                  </div>
                )}

                <div className="border-t border-slate-700 bg-slate-800 px-3 py-3 sm:px-4">
                  <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
                    <button
                      onClick={() => {
                        setSelectedGuest(null);
                        setCheckedInGuests([]);
                        setDisplayAdditionalPax(false);
                        setDisplayFoodPlan(false);
                        setFormData({});
                        setSearchTerm("");
                        onClose(); // ← now it fires
                      }}
                      className="w-full rounded-lg bg-slate-600 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-slate-700 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleSwapRoom}
                      disabled={!selectedGuest || loading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 sm:ml-auto sm:w-auto sm:text-sm"
                    >
                      {loading ? (
                        <>
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white" />
                          Swapping...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-3.5 w-3.5" />
                          Confirm Swap
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {displayAdditionalPax && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <AdditionalPaxDetails
              cmp_id={cmp_id}
              sendDataToParent={handleAdditionalPaxDetails}
              setDisplayAdditionalPax={setDisplayAdditionalPax}
              selectedRoomId={selectedRoom?._id}
              formData={formData}
              includePaxRateWithRoom={selectedGuest?.addPaxWithRate}
            />
          </div>
        </div>
      )}

      {displayFoodPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
            <FoodPlanComponent
              cmp_id={cmp_id}
              sendDataToParent={handleFoodPlanData}
              setDisplayFoodPlan={setDisplayFoodPlan}
              selectedRoomId={selectedRoom?._id}
              formData={formData}
              includeFoodRateWithRoom={selectedGuest?.addFoodPlanWithRate}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default RoomSwapModal;
