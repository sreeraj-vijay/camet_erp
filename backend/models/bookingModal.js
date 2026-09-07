import mongoose from "mongoose";

const foodPlanSchema = new mongoose.Schema({
  foodPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodPlan" },
  foodPlan: String,
  rate: Number,
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  isDefault: { type: Boolean, default: false },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
});

const paxDetailSchema = new mongoose.Schema({
  paxID: { type: mongoose.Schema.Types.ObjectId, ref: "Pax" },
  paxName: String,
  rate: Number,
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  isDefault: { type: Boolean, default: false },
});

const roomSwapHistorySchema = new mongoose.Schema({
  fromSelectedRoomId: mongoose.Schema.Types.ObjectId,
  toSelectedRoomId: mongoose.Schema.Types.ObjectId,
  fromRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  toRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  swapDate: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    default: "Guest requested room change",
  },
  swappedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // staff user who swapped
  },
});

const hsnDetailsSchema = new mongoose.Schema({
  hsn: String,
  description: String,
  tab: String,
  isRevisedChargeApplicable: String,
  rows: [
    {
      greaterThan: String,
      upto: String,
      taxabilityType: String,
      igstRate: String,
      cgstRate: String,
      sgstUtgstRate: String,
      basedOnValue: String,
      basedOnQuantity: String,
    },
  ],
});

const idProofDocumentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
  },
  { _id: false },
);

const idProofSchema = new mongoose.Schema(
  {
    idType: { type: String, default: "" },
    idNumber: { type: String, default: "" },
    documents: {
      type: [idProofDocumentSchema],
      default: [],
    },
  },
  { _id: false },
);

const selectedRoomSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  roomName: String,
  priceLevel: [{}],
  selectedPriceLevel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PriceLevel",
  },
  roomType: {
    _id: mongoose.Schema.Types.ObjectId,
    brand: String,
    brand_id: mongoose.Schema.Types.ObjectId,
    cmp_id: mongoose.Schema.Types.ObjectId,
    Primary_user_id: mongoose.Schema.Types.ObjectId,
  },
  dateTariffs: {
    type: Object,
    default: {},
  },
  pax: Number,
  priceLevelRate: String,
  stayDays: Number,
  hsnDetails: hsnDetailsSchema,
  totalAmount: Number,
  amountAfterTax: Number,
  amountWithOutTax: Number,
  taxPercentage: Number,
  foodPlanTaxRate: Number,
  additionalPaxAmount: Number,
  foodPlanAmount: Number,
  taxAmount: Number,
  additionalPaxAmountWithTax: Number,
  additionalPaxAmountWithOutTax: Number,
  foodPlanAmountWithTax: Number,
  foodPlanAmountWithOutTax: Number,
  baseAmount: Number,
  baseAmountWithTax: Number,
  totalCgstAmt: Number,
  totalSgstAmt: Number,
  totalIgstAmt: Number,
  unit: String,
  isSwapped: { type: Boolean, default: false },
  swappingDateFrom: { type: Date },
  lastRateUpdatedAt: { type: Date, default: Date.now },
  isCheckedOut: { type: Boolean, default: false },
  discountAmount: Number,
  otherChargeAmount: Number,
  discountAmountWithOutTax: {
    type: Number,
    default: 0,
  },
  otherChargeWithOutTax: {
    type: Number,
    default: 0,
  },
  otherChargeDetails: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdditionalCharge" },
      option: { type: String },
      value: { type: String },
      action: { type: String },
      taxPercentage: { type: Number },
      taxAmt: { type: Number },
      hsn: { type: String },
      finalValue: { type: Number },
      amountType: { type: String },
      includeTax: { type: Boolean },
    },
  ],
});

const bookingSchema = new mongoose.Schema(
  {
    Primary_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PrimaryUser",
      required: true,
    },
    Secondary_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecondaryUser",
    },
    cmp_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    checkoutType: String, //only for checkout and its for knowing that if this checkout is single checkout for multiple checkins,we have for single checkings have separate checkout with distinguis with this and former
    bookingDate: String,
    voucherNumber: String,
    voucherId: mongoose.Schema.Types.ObjectId,
    bookingNumber: String,
    arrivalDate: String,
    arrivalTime: String,
    checkOutDate: String,
    checkOutTime: String,
    currentDate: String,
    advanceTracking: {
      type: Map,
      of: Number,
      default: {},
    },
    stayDays: Number,
    bookingType: String,
    selectedRoomId: mongoose.Schema.Types.ObjectId,
    selectedRoomPrice: String,
    bedType: String,
    roomFloor: String,
    unit: String,
    hsn: String,
    country: String,
    state: String,
    pinCode: String,
    detailedAddress: String,
    priceLevelRate: String,
    priceLevelId: String,
    discountPercentage: String,
    advanceAmount: String,
    totalAdvance: String,
    totalAmount: String,
    balanceToPay: String,
    addFoodPlanWithRate: { type: Boolean, default: false },
    addPaxWithRate: { type: Boolean, default: false },
    guestName: String,
    guestId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    guestCountry: String,
    guestState: String,
    guestPinCode: String,
    guestDetailedAddress: String,
    guestMobileNumber: String,
    gstNo: String,
    paymenttypeDetails: {
      cash: { type: Number, default: 0 },
      bank: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      credit: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
    },

    paymentMetaData: { type: Object },
    checkoutpaymenttypedetails: [
      {
        paymentId: { type: mongoose.Schema.Types.ObjectId },
        customerName: { type: String },
        mode: { type: String },
        amount: { type: Number },
      },
    ],
    grandTotal: String,
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    customerName: String,
    mobileNumber: String,
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: "RoomType" },
    visitOfPurpose: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VisitOfPurpose",
    },
    selectedRooms: [selectedRoomSchema],
    foodPlan: [foodPlanSchema],
    additionalPaxDetails: [paxDetailSchema],
    roomTotal: Number,
    foodPlanTotal: Number,
    paxTotal: Number,
    isHotelAgent: { type: Boolean, default: false },

    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    checkInId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckIn" },
    checkInArray: [{ type: mongoose.Schema.Types.ObjectId, ref: "CheckIn" }],
    arrayCheckIn: [{ type: mongoose.Schema.Types.ObjectId, ref: "CheckIn" }],
    arrayBookIn: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
    status: String,
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecondaryUser",
    },
    cancelledByName: {
      type: String,
      default: "",
    },
    cancelReason: {
      type: String,
      default: "",
    },
    originalCheckInId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckIn",
    },

    idProof: {
      type: idProofSchema,
      default: () => ({
        idType: "",
        idNumber: "",
        documents: [],
      }),
    },
    roomSwapHistory: [roomSwapHistorySchema],
    isPartiallyCheckedOut: {
      type: Boolean,
      default: false,
    },
    partialCheckoutHistory: [
      {
        date: Date,
        roomsCheckedOut: [
          {
            roomId: mongoose.Schema.Types.ObjectId,
            roomName: String,
          },
        ],
        saleVoucherNumber: String,
      },
    ],
    addTaxWithRate: Boolean,
    // Foreign National Fields (only for non-Indian guests)
    company: String,
    nextDestination: String,
    dateOfBirth: String,
    dateOfArrivalInIndia: String,
    visaNo: String,
    visaPOI: String,
    visaDOI: String,
    visaExpDt: String,
    certOfRegistrationNumber: String,
    passportNo: String,
    placeOfIssue: String,
    dateOfIssue: String,
    dateOfExpiry: String,
    grcno: String,
    isHold: { type: Boolean, default: false },
    taggedCheckIns: { type: mongoose.Schema.Types.ObjectId, ref: "CheckIn" },
    holdArray: [],
    otherChargeDetails: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdditionalCharge" },
        option: { type: String },
        value: { type: String },
        action: { type: String },
        taxPercentage: { type: Number },
        taxAmt: { type: Number },
        hsn: { type: String },
        finalValue: { type: Number },
        amountType: { type: String },
        includeTax: { type: Boolean },
      },
    ],
    discountAmount: {
      type: Number,
      default: 0,
    },
    otherChargeAmount: {
      type: Number,
      default: 0,
    },
    discountAmountWithOutTax: {
      type: Number,
      default: 0,
    },
    otherChargeWithOutTax: {
      type: Number,
      default: 0,
    },
    charge: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Charge",
      },
      cmp_id: mongoose.Schema.Types.ObjectId,
      Primary_user_id: mongoose.Schema.Types.ObjectId,
      name: String,
      hsn: String,
      taxPercentage: Number,
    },
    checkoutRequestId: String,
    bookingRequestId: String,
    checkInRequestId: String,
  },
  { timestamps: true },
);

bookingSchema.index(
  { cmp_id: 1, checkoutRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_checkout_request_per_company",
  },
);
bookingSchema.index(
  { cmp_id: 1, bookingRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_booking_request_per_company",
  },
);

bookingSchema.index(
  { cmp_id: 1, checkInRequestId: 1 },
  {
    unique: true,
    sparse: true,
    name: "unique_checkin_request_per_company",
  },
);

export const Booking = mongoose.model("Booking", bookingSchema, "bookings");
export const CheckIn = mongoose.model("CheckIn", bookingSchema, "checkins");
export const CheckOut = mongoose.model("CheckOut", bookingSchema, "checkouts");
