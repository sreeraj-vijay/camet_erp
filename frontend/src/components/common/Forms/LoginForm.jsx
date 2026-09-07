/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unknown-property */
import { RiLoginCircleFill } from "react-icons/ri";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PropagateLoader } from "react-spinners";
import api from "../../../api/api";
import { FaRegEye } from "react-icons/fa";
1;
import { IoMdEyeOff } from "react-icons/io";
import { useNavigate, Link } from "react-router-dom";
import Footer from "../footer/Footer";
import { useDispatch } from "react-redux";
import { storingPermissions, storingUserType } from "/slices/permissionSlice";


function LoginForm({ user }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loader, setLoader] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("All fields must be filled");
      return;
    }

    setLoader(true);

    // Set endpoint and storage key based on user type
    let apiPath, storageKey, dashboardPath;
    if (user === "admin") {
      apiPath = "/api/admin/login";
      storageKey = "adminData";
      dashboardPath = "/admin/home";
    } else if (user === "secondary") {
      apiPath = "/api/sUsers/login";
      storageKey = "sUserData";
      dashboardPath = "/sUsers/dashboard";
    } else if (user === "primary") {
      apiPath = "/api/pUsers/login";
      storageKey = "pUserData";
      dashboardPath = "/pUsers/dashboard";
    } else {
      toast.error("Invalid user type");
      setLoader(false);
      return;
    }

    try {
      const res = await api.post(
        apiPath,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        },
      );

      setTimeout(() => {
        setLoader(false);
        toast.success(res.data.message);
        // A dismissal only applies to the current login. Start every new login
        // with the subscription warning visible again when it is due.
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith("subscription-alert-dismissed:"))
          .forEach((key) => sessionStorage.removeItem(key));
        localStorage.setItem(storageKey, JSON.stringify(res.data.data));
        if (user === "secondary") {
          dispatch(storingPermissions(res?.data?.data?.permissions || {}));
          dispatch(storingUserType(res?.data?.data?.userType || null));
          localStorage.setItem(
            "permissions",
            JSON.stringify(res?.data?.data?.permissions || {}),
          );
          localStorage.setItem("userType", res?.data?.data?.userType || "");
        }
        navigate(dashboardPath);
        setEmail("");
        setPassword("");
      }, 1000);
    } catch (error) {
      setTimeout(() => {
        toast.error(error?.response?.data?.message || "Login failed");
        setLoader(false);
      }, 1000);
    }
  };

  return (
    <div className="bg-white font-[sans-serif] min-h-screen flex flex-col">
      {/* Main content container with flex-grow to push footer down */}
      <div className="flex-grow flex flex-col items-center justify-center py-6 px-4">
        <div className="max-w-md w-full">
          <div className="p-8 rounded-sm bg-white shadow-xl">
            <RiLoginCircleFill
              className={`w-12 h-12 ${
                user === "admin" ? "text-violet-500" : "text-blue-500"
              } mx-auto `}
            />

            <h1 className="text-gray-800 text-center text-xl font-bold mt-3 ">
              {user === "admin" ? "Admin Login" : "Welcome!"}
            </h1>
            <h2 className="text-gray-500 text-center text-md font-bold">
              Sign in to your account
            </h2>
            <form className="mt-8 space-y-4" onSubmit={submitHandler}>
              <div>
                <label className="text-gray-800 text-sm mb-2 block">
                  Email or Phone
                </label>
                <div className="relative flex items-center">
                  <input
                    name="username"
                    type="text"
                    required
                    className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
                    placeholder="Enter Email or Phone"
                    onChange={(e) => {
                      setEmail(e.target.value);
                    }}
                    value={email}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="#bbb"
                    stroke="#bbb"
                    className="w-4 h-4 absolute right-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="10"
                      cy="7"
                      r="6"
                      data-original="#000000"
                    ></circle>
                    <path
                      d="M14 15H6a5 5 0 0 0-5 5 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 5 5 0 0 0-5-5zm8-4h-2.59l.3-.29a1 1 0 0 0-1.42-1.42l-2 2a1 1 0 0 0 0 1.42l2 2a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.42l-.3-.29H22a1 1 0 0 0 0-2z"
                      data-original="#000000"
                    ></path>
                  </svg>
                </div>
              </div>

              <div>
                <label className="text-gray-800 text-sm mb-2 block">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
                    placeholder="Enter password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    value={password}
                  />
                  <div className="absolute top-1/2 right-4 text-gray-500 opacity-60 transform -translate-y-1/2">
                    {!showPassword ? (
                      <FaRegEye onClick={togglePasswordVisibility} />
                    ) : (
                      <IoMdEyeOff onClick={togglePasswordVisibility} />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    for="remember-me"
                    className="ml-3 block text-sm text-gray-800"
                  >
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <a
                    // onClick={forgetPassword}
                    href="jajvascript:void(0);"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Forgot your password?
                  </a>
                </div>
              </div>

              <div className="!mt-8">
                <button
                  type="submit"
                  className={`w-full py-3 px-4 text-sm tracking-wide rounded-lg text-white ${
                    user === "admin"
                      ? "bg-violet-600 hover:bg-violet-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }  focus:outline-none`}
                >
                  {loader ? (
                    <PropagateLoader
                      color="#ffffff"
                      size={10}
                      speedMultiplier={1}
                      className="mb-3"
                    />
                  ) : (
                    "Sign in"
                  )}
                </button>
              </div>

              {user !== "admin" && (
                <p className="text-gray-800 text-sm !mt-8 text-center">
                  Don't have an account?{" "}
                  <Link to={"/pUsers/register"}>
                    <a
                      href="javascript:void(0);"
                      className="text-blue-600 hover:underline ml-1 whitespace-nowrap font-semibold"
                    >
                      Register here
                    </a>
                  </Link>
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Footer at the bottom */}
      <Footer user={user} />
    </div>
  );
}

export default LoginForm;
