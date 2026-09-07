/* eslint-disable react/prop-types */
import  { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Loader2,
  Crown,
  Clock,
} from "lucide-react";

const PrimaryUserComponent = ({
  primaryUser,
  onToggle,
  onSubscriptionToggle,
  onRenewSubscription,
  isLoading,
}) => {
  const [localLoading, setLocalLoading] = useState(false);
  const [showRenewDatePicker, setShowRenewDatePicker] = useState(false);
  const [renewalDate, setRenewalDate] = useState("");

  // Helper function to get user initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper function to calculate expiration date based on creation date and subscription type
  const calculateExpirationDate = (createdAt, subscriptionType) => {
    if (!createdAt) return null;
    
    const creationDate = new Date(createdAt);
    const expirationDate = new Date(creationDate);
    
    // Add time based on subscription type
    if (subscriptionType === "yearly") {
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    } else {
      // Default to monthly if not yearly
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    }
    
    return expirationDate;
  };

  const toDateInputValue = (date) => {
    if (!date || Number.isNaN(new Date(date).getTime())) return "";
    const value = new Date(date);
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  };

  const openRenewDatePicker = () => {
    setRenewalDate(
      toDateInputValue(
        primaryUser?.expiredAt ||
          calculateExpirationDate(primaryUser?.createdAt, primaryUser?.subscriptionType),
      ),
    );
    setShowRenewDatePicker(true);
  };

  const confirmRenewal = () => {
    if (!renewalDate) return;
    onRenewSubscription(renewalDate);
    setShowRenewDatePicker(false);
  };

  // Enhanced Toggle Switch Component
  const ToggleSwitch = ({
    enabled,
    onToggle,
    label,
    loading = false,
    variant = "default",
  }) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "danger":
          return enabled
            ? "bg-gradient-to-r from-red-500 to-red-600 focus:ring-red-500"
            : "bg-slate-300 focus:ring-slate-400";
        case "success":
          return enabled
            ? "bg-gradient-to-r from-green-500 to-green-600 focus:ring-green-500"
            : "bg-slate-300 focus:ring-slate-400";
        default:
          return enabled
            ? "bg-gradient-to-r from-blue-500 to-blue-600 focus:ring-blue-500"
            : "bg-slate-300 focus:ring-slate-400";
      }
    };

    return (
      <div className="flex flex-col space-y-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <button
          onClick={onToggle}
          disabled={loading}
          className={`relative w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${getVariantStyles()} ${
            loading
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:shadow-lg"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-all duration-300 ease-in-out flex items-center justify-center ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          >
            {loading && (
              <Loader2 className="w-2 h-2 animate-spin text-slate-600" />
            )}
          </div>
        </button>
      </div>
    );
  };

  // Enhanced Subscription Toggle Component
  const SubscriptionToggle = ({
    subscriptionType,
    onToggle,
    loading = false,
  }) => {
    const isYearly = subscriptionType === "yearly";

    const handleSubscriptionToggle = async () => {
      if (loading) return;

      setLocalLoading(true);
      try {
        // Call the parent's subscription toggle handler with the user ID
        await onToggle(
          primaryUser._id || primaryUser.id,
          isYearly ? "monthly" : "yearly"
        );
      } catch (error) {
        console.error("Error toggling subscription:", error);
      } finally {
        setLocalLoading(false);
      }
    };

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Subscription Plan
              </p>
              <p className="text-xs text-slate-500">Billing frequency</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-medium transition-colors duration-200 ${
                !isYearly ? "text-slate-800" : "text-slate-400"
              }`}
            >
              Monthly
            </span>

            <button
              onClick={handleSubscriptionToggle}
              disabled={loading || localLoading}
              className={`relative w-14 h-7 rounded-full p-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isYearly
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 focus:ring-green-500"
                  : "bg-gradient-to-r from-blue-500 to-cyan-500 focus:ring-blue-500"
              } ${
                loading || localLoading
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:shadow-lg"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ease-in-out flex items-center justify-center ${
                  isYearly ? "translate-x-7" : "translate-x-0"
                }`}
              >
                {(loading || localLoading) && (
                  <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                )}
              </div>

              {/* Subscription type indicator */}
              <div
                className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                  loading || localLoading ? "opacity-0" : "opacity-100"
                } transition-opacity duration-200`}
              >
                {/* <span className="text-xs font-bold text-white mx-2">
                  {isYearly ? "Y" : "M"}
                </span> */}
              </div>
            </button>

            <span
              className={`text-sm font-medium transition-colors duration-200 ${
                isYearly ? "text-slate-800" : "text-slate-400"
              }`}
            >
              Yearly
            </span>
          </div>
        </div>

        {/* Subscription benefits indicator */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Current plan:</span>
            <span
              className={`font-semibold px-2 py-1 rounded-full ${
                isYearly
                  ? "text-green-700 bg-green-100"
                  : "text-blue-700 bg-blue-100"
              }`}
            >
              {isYearly ? "Yearly " : "Monthly"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Avatar component
  const Avatar = ({ className, children }) => (
    <div className={`rounded-full overflow-hidden ${className}`}>
      {children}
    </div>
  );

  const AvatarImage = ({ src, className }) => (
    <img
      src={src}
      alt="Avatar"
      className={`w-full h-full object-cover ${className}`}
    />
  );

  const AvatarFallback = ({ className, children }) => (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
    >
      {children}
    </div>
  );

  // Status badge component
  // eslint-disable-next-line no-unused-vars
  const StatusBadge = ({ label, value, type = "default" }) => {
    const getStatusColor = () => {
      if (type === "approval") {
        return value
          ? "bg-green-100 text-green-800 border-green-200"
          : "bg-yellow-100 text-yellow-800 border-yellow-200";
      }
      if (type === "blocked") {
        return !value
          ? "bg-red-100 text-red-800 border-red-200"
          : "bg-green-100 text-green-800 border-green-200";
      }
      return value
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
    };

    

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}
      >

        {type === "approval" ? value === true ? "Approved" : "Pending" : value === true ? "Active" : "Inactive"}

     
      </span>
    );
  };

  // Sample data for demonstration

  // Use sample data if no primaryUser is provided
  const user = primaryUser;

  return (
    <div className="relative overflow-hidden">
      {/* Header with gradient background */}
      <div
        style={{
          backgroundImage: `url("https://images.pexels.com/photos/12686992/pexels-photo-12686992.jpeg")`,
        }}
        className=" relative px-3  py-12 bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-black/2"></div>
        <div className="flex items-center justify-center mb-6 z-10">
          <div className="relative group">
            <Avatar className="h-20 w-20 ring-4 ring-white/20 transition-all duration-500 group-hover:ring-white/40">
              <AvatarImage
                src="https://i.pinimg.com/736x/8b/16/7a/8b167af653c2399dd93b952a48740620.jpg"
                className="transition-all duration-300 group-hover:scale-110"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-xl">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
              <Crown className="w-3 h-3 text-yellow-800" />
            </div>
          </div>
        </div>

        <div className="text-center text-white relative z-20">
          <h2 className="text-2xl font-bold mb-2">
            {user?.name || "Unknown User"}
          </h2>
          <p className="mb-4">
            {user?.email || "No email provided"}
          </p>
          <div className="flex items-center justify-center gap-4">
            <StatusBadge
              label="Approved"
              value={user?.isApproved}
              type="approval"
            />
            <StatusBadge
              label="Status"
              value={!user?.isBlocked}
              type="blocked"
            />
          </div>
        </div>
      </div>

      {/* Main content with overlap */}
      <div className="px-8 -mt-8 pb-8 relative z-50">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
          {/* User Information Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Full Name
                    </p>
                    <p className="text-lg font-semibold text-slate-800">
                      {user?.name || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Email Address
                    </p>
                    <p className="text-lg font-semibold text-slate-800 break-all">
                      {user?.email || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Phone Number
                    </p>
                    <p className="text-lg font-semibold text-slate-800">
                      {user?.phoneNumber || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column - Dates & Subscription */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Account Created
                    </p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatDate(user?.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Subscription Expires
                    </p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatDate(user?.expiredAt || calculateExpirationDate(user?.createdAt, user?.subscriptionType))}
                    </p>
                  </div>
                </div>

                {/* Subscription Toggle */}
                <SubscriptionToggle
                  subscriptionType={user?.subscriptionType}
                  onToggle={
                    onSubscriptionToggle ||
                    ((id, type) =>
                      console.log(`Toggle subscription for ${id} to ${type}`))
                  }
                  loading={isLoading || localLoading}
                />
                <button
                  type="button"
                  onClick={openRenewDatePicker}
                  disabled={isLoading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Renewing..." : `Renew ${user?.subscriptionType || "monthly"} subscription`}
                </button>
              </div>
            </div>
      </div>

      {showRenewDatePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="renew-subscription-title"
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
          >
            <h3 id="renew-subscription-title" className="text-lg font-bold text-slate-800">
              Renew {primaryUser?.subscriptionType || "monthly"} subscription
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Select the new subscription expiry date.
            </p>
            <label htmlFor="subscription-expiry" className="mt-4 block text-sm font-semibold text-slate-700">
              Expiry date
            </label>
            <input
              id="subscription-expiry"
              type="date"
              value={renewalDate}
              onChange={(event) => setRenewalDate(event.target.value)}
              min={toDateInputValue(new Date())}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRenewDatePicker(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRenewal}
                disabled={!renewalDate || isLoading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Update subscription
              </button>
            </div>
          </div>
        </div>
      )}

          {/* Toggle Controls Section */}
          <div className="border-t border-slate-200 bg-slate-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-800">
                  User Permissions
                </h4>
                <p className="text-sm text-slate-600">
                  Manage user access and communication settings
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <ToggleSwitch
                  enabled={user?.sms || false}
                  onToggle={() =>
                    onToggle && onToggle("primaryUser", null, "sms", user?.sms)
                  }
                  label="SMS Notifications"
                  loading={isLoading}
                />
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <ToggleSwitch
                  enabled={user?.whatsApp || false}
                  onToggle={() =>
                    onToggle &&
                    onToggle("primaryUser", null, "whatsApp", user?.whatsApp)
                  }
                  label="WhatsApp"
                  loading={isLoading}
                />
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <ToggleSwitch
                  enabled={user?.isBlocked || false}
                  onToggle={() =>
                    onToggle &&
                    onToggle("primaryUser", null, "isBlocked", user?.isBlocked)
                  }
                  label="Block User"
                  loading={isLoading}
                  variant="danger"
                />
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <ToggleSwitch
                  enabled={user?.isApproved || false}
                  onToggle={() =>
                    onToggle &&
                    onToggle(
                      "primaryUser",
                      null,
                      "isApproved",
                      user?.isApproved
                    )
                  }
                  label="Approved"
                  loading={isLoading}
                  variant="success"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrimaryUserComponent;
