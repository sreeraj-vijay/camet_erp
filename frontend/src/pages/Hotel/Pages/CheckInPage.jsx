import { useState, useRef, useEffect } from "react";
import CustomBarLoader from "@/components/common/CustomBarLoader";
import TitleDiv from "@/components/common/TitleDiv";
import BookingForm from "../Components/BookingForm";
import { toast } from "sonner";
import api from "@/api/api";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import useFetch from "@/customHook/useFetch";
import { useQueryClient } from "@tanstack/react-query";
function CheckInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingData = location?.state?.bookingData;
  const roomId = location?.state?.roomId;
  const rooms = location?.state?.rooms;
  const isSubmittingRef = useRef(false);
  const [outStanding, setOutStanding] = useState([]);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const organization = useSelector(
    (state) => state?.secSelectedOrganization?.secSelectedOrg,
  );
  const checkInRequestIdRef = useRef(null);
  console.log("j");
  const { data, loading: advanceLoading } = useFetch(
    `/api/sUsers/getBookingAdvanceData/${bookingData?._id}?type=${"checkIn"}`,
  );

  useEffect(() => {
    if (data) {
      setOutStanding(data?.data);
    }
  }, [data]);

  // useEffect(() => {
  //   if (bookingData) {
  //     bookingData.previousAdvance = Number(bookingData?.advanceAmount || 0)
  //     bookingData.totalAdvance = Number(bookingData?.advanceAmount || 0)
  //     bookingData.advanceAmount = 0
  //   }
  // }, [bookingData])

  console.log("HHH");
  const handleSubmit = async (data, paymentData, paymenttypeDetails) => {
    let updatedData;
    if (bookingData) {
      updatedData = { ...data, bookingId: bookingData._id };
    } else {
      updatedData = data;
    }

    console.log(updatedData);
    console.log(paymentData);
    console.log(paymenttypeDetails);
    try {
      if (!checkInRequestIdRef.current) {
        checkInRequestIdRef.current =
          crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      }

      let response = await api.post(
        `/api/sUsers/saveData/${organization._id}`,
        {
          checkInRequestId: checkInRequestIdRef.current,
          data: updatedData,
          modal: "checkIn",
          paymentData: paymentData,
          paymenttypeDetails,
        },
        { withCredentials: true },
      );
      if (response?.data?.success) {
        toast.success("Check In Successfully");
        queryClient.invalidateQueries({
          queryKey: ["todaysTransaction", organization._id, false],
        });
        navigate("/sUsers/checkInList");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.message);
    } finally {
      isSubmittingRef.current = false;
      // setSubmitLoader(false);
    }
  };
  console.log(roomId);

  return (
    <>
      {loading ? (
        <CustomBarLoader />
      ) : (
        <div className="">
          <TitleDiv
            title="Check In"
            from="/sUsers/hotelDashBoard"
            dropdownContents={[
              {
                title: "New Guest",
                to: "/sUsers/partyList",
                from: "/sUsers/checkInPage",
              },
              {
                title: "Check In List",
                to: "/sUsers/checkInList",
              },
            ]}
          />

          <BookingForm
            handleSubmit={handleSubmit}
            setIsLoading={setLoading}
            isSubmittingRef={isSubmittingRef}
            isFor="deliveryNote"
            editData={bookingData}
            outStanding={outStanding}
            roomId={roomId}
            rooms={rooms}
            isShowGrc={true}
          />
        </div>
      )}
    </>
  );
}
export default CheckInPage;
