import { useState, useRef } from "react";
import CustomBarLoader from "@/components/common/CustomBarLoader";
import TitleDiv from "@/components/common/TitleDiv";
import BookingForm from "../Components/BookingForm";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import api from "@/api/api";
import { useQueryClient } from "@tanstack/react-query";
function BookingPage() {
  const location = useLocation();
  const isSubmittingRef = useRef(false);
  const roomId = location?.state?.roomId;
  const rooms = location?.state?.rooms;
  const organization = useSelector(
    (state) => state?.secSelectedOrganization?.secSelectedOrg,
  );
  const [loading, setLoading] = useState(false);
  const [submitLoader, setSubmitLoader] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bookingRequestIdRef = useRef(null);

  const handleSubmit = async (data, paymentData, paymenttypeDetails) => {
    try {
      if (!bookingRequestIdRef.current) {
        bookingRequestIdRef.current =
          crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      }
      let response = await api.post(
        `/api/sUsers/saveData/${organization._id}`,
        {
          bookingRequestId: bookingRequestIdRef.current,
          data: data,
          modal: "bookingPage",
          paymentData: paymentData,
          paymenttypeDetails,
        },
        { withCredentials: true },
      );
      if (response?.data?.success) {
        toast.success(response?.data?.message);
        queryClient.invalidateQueries({
          queryKey: ["todaysTransaction", organization._id, false],
        });
        navigate("/sUsers/bookingList");
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.message);
      isSubmittingRef.current = false;
    } finally {
      setSubmitLoader(false);
      bookingRequestIdRef.current = null;
      isSubmittingRef.current = false;
    }
  };
  return (
    <>
      {loading ? (
        <CustomBarLoader />
      ) : (
        <div className="">
          <TitleDiv
            title="Room Booking"
            from="/sUsers/hotelDashBoard"
            dropdownContents={[
              {
                title: "New Guest",
                to: "/sUsers/addParty",
                from: "/sUsers/bookingPage",
              },
              {
                title: "Booking List",
                to: "/sUsers/bookingList",
              },
            ]}
          />
          <BookingForm
            handleSubmit={handleSubmit}
            setIsLoading={setLoading}
            isSubmittingRef={isSubmittingRef}
            isFor="saleOrder"
            roomId={roomId}
            rooms={rooms}
            submitLoader={submitLoader}
          />
        </div>
      )}
    </>
  );
}

export default BookingPage;
