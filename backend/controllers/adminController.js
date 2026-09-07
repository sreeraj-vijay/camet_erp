import Admin from "../models/adminModel.js";
import PrimaryUsers from "../models/primaryUserModel.js";
import { calculateSubscriptionExpiry, normalizeSubscription } from "../utils/subscription.js";
import generateAdminToken from "../utils/generateAdminToken.js";
import Organization from "../models/OragnizationModel.js";
import SecondaryUser from "../models/secondaryUserModel.js";

import TallyData from "../models/TallyData.js";
import Banks from "../models/bankModel.js";
import BanksOd from "../models/bankOdModel.js";
import Cash from "../models/cashModel.js";
import AccountGroup from "../models/accountGroup.js";
import CreditNote from "../models/creditNoteModel.js";
import DebitNote from "../models/debitNoteModel.js";
import Receipt from "../models/receiptModel.js";
import Payment from "../models/paymentModel.js";
import nodemailer from "nodemailer";
import additionalChargesModel from "../models/additionalChargesModel.js";
import hsnModel from "../models/hsnModel.js";
import invoiceModel from "../models/invoiceModel.js";
import partyModel from "../models/partyModel.js";
import productModel from "../models/productModel.js";
import purchaseModel from "../models/purchaseModel.js";
import salesModel from "../models/salesModel.js";
import stockTransferModel from "../models/stockTransferModel.js";
import OragnizationModel from "../models/OragnizationModel.js";
import BarcodeModel from "../models/barcodeModel.js";
import SubgroupModel from "../models/subGroup.js";
import VoucherSeriesModel from "../models/VoucherSeriesModel.js";
import warrantyCardModel from "../models/warranyCardModel.js";
import {
  Brand,
  Category,
  Godown,
  PriceLevel,
  Subcategory,
} from "../models/subDetails.js";
import vanSaleModel from "../models/vanSaleModel.js";
import TransactionModel from "../models/TransactionModel.js";
import mongoose from "mongoose";

import { ObjectId } from "mongodb";
import { sendOrganizationApprovalEmail } from "./adminHelper.js";
// @desc Login Admin
// route POST/api/admin/login
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // const admin=new Admin();
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ message: "Invalid Admin" });
    }

    //   const isPasswordMatch = await bcrypt.compare(
    //     password,
    //     admin.password
    //   );

    const isPasswordMatch = (await admin.password) === password;

    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateAdminToken(res, admin._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      data: { email },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: "Failed to login!" });
  }
};

// @desc Log out  Admin
// route POST/api/admin/logout

export const logout = async (req, res) => {
  try {
    res.cookie("jwt_admin", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    return res.status(200).json({
      message: "Logged out",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: "Failed to login!" });
  }
};

// @desc get admin data for side bar
// route POST/api/admin/getAdminData

export const getAdminData = async (req, res) => {
  const adminId = req.adminId;
  try {
    const adminData = await Admin.findById(adminId);
    if (adminData) {
      return res
        .status(200)
        .json({ message: "AdminData fetched", data: { adminData } });
    } else {
      return res.status(404).json({ message: "primaryUSerData not found" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ status: false, message: "internal sever error" });
  }
};

// @desc get primary user lst
// route POST/api/admin/getPrimaryUsers

export const getPrimaryUsers = async (req, res) => {
  try {
    const primaryUsers = await PrimaryUsers.find({});
    const organizations = await Organization.find({});
    const secUsers = await SecondaryUser.find({});
    if (primaryUsers) {
      return res.status(200).json({
        message: "Primary users fetched",
        priUsers: primaryUsers,
        org: organizations,
        secUsers: secUsers,
      });
    } else {
      return res
        .status(404)
        .json({ message: "Error in fetching primary users" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// @desc handle approval of primary user
// route POST/api/admin/handlePrimaryApprove

export const handlePrimaryApprove = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await PrimaryUsers.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the user's approval status
    const update = await PrimaryUsers.updateOne(
      { _id: userId },
      { $set: { isApproved: !user.isApproved } }
    );

    console.log("update", update);

    // Check if the update was successful
    if (update.nModified === 0) {
      return res
        .status(400)
        .json({ error: "Failed to update user approval status" });
    }

    res
      .status(200)
      .json({ message: "User approval status updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc handle deletion of primary user
// route DELETE/api/admin/handlePrimaryDelete

export const handlePrimaryDelete = async (req, res) => {
  const userId = req.params.id;

  try {
    // First, find the organizations owned by this user
    const organizations = await Organization.find({ owner: userId });
    const organizationIds = organizations.map((org) => org._id);

    const deletionResults = await Promise.all([
      PrimaryUsers.findByIdAndDelete(userId),
      SecondaryUser.deleteMany({ primaryUser: userId }),
      Organization.deleteMany({ owner: userId }),
      Banks.deleteMany({ Primary_user_id: userId }),
      TallyData.deleteMany({ Primary_user_id: userId }),
      additionalChargesModel.deleteMany({ Primary_user_id: userId }),
      hsnModel.deleteMany({ Primary_user_id: userId }),
      invoiceModel.deleteMany({ Primary_user_id: userId }),
      partyModel.deleteMany({ Primary_user_id: userId }),
      productModel.deleteMany({ Primary_user_id: userId }),
      purchaseModel.deleteMany({ Primary_user_id: userId }),
      salesModel.deleteMany({ Primary_user_id: userId }),
      stockTransferModel.deleteMany({ Primary_user_id: userId }),
      Brand.deleteMany({ Primary_user_id: userId }),
      Category.deleteMany({ Primary_user_id: userId }),
      Subcategory.deleteMany({ Primary_user_id: userId }),
      Godown.deleteMany({ Primary_user_id: userId }),
      PriceLevel.deleteMany({ Primary_user_id: userId }),
      vanSaleModel.deleteMany({ Primary_user_id: userId }),
      TransactionModel.deleteMany({ cmp_id: { $in: organizationIds } }),
    ]);

    const [
      user,
      secUserResult,
      orgResult,
      banksResult,
      talliesResult,
      additionalChargesResult,
      hsnResult,
      invoiceResult,
      partyResult,
      productResult,
      purchaseResult,
      salesResult,
      stockTransferResult,
      brandResult,
      categoryResult,
      subcategoryResult,
      godownResult,
      priceLevelResult,
      vanSaleResult,
      TransactionResult,
    ] = deletionResults;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deletionCounts = {
      user: user ? 1 : 0,
      secondaryUsers: secUserResult.deletedCount,
      organizations: orgResult.deletedCount,
      banks: banksResult.deletedCount,
      tallies: talliesResult.deletedCount,
      additionalCharges: additionalChargesResult.deletedCount,
      hsn: hsnResult.deletedCount,
      invoices: invoiceResult.deletedCount,
      parties: partyResult.deletedCount,
      products: productResult.deletedCount,
      purchases: purchaseResult.deletedCount,
      sales: salesResult.deletedCount,
      stockTransfers: stockTransferResult.deletedCount,
      brands: brandResult.deletedCount,
      categories: categoryResult.deletedCount,
      subcategories: subcategoryResult.deletedCount,
      godowns: godownResult.deletedCount,
      priceLevels: priceLevelResult.deletedCount,
      vanSales: vanSaleResult.deletedCount,
      Transactions: TransactionResult.deletedCount,
    };

    res.status(200).json({
      message: "User and associated data deleted successfully",
      deletionCounts: deletionCounts,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc handle block of primary user
// route POST/api/admin/handlePrimaryBlock

// export const handlePrimaryBlock = async (req, res) => {
//   const userId = req.params.id;

//   try {
//     const user = await PrimaryUsers.findById(userId);
//     console.log("user", user);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Update the user's approval status
//     const update = await PrimaryUsers.updateOne(
//       { _id: userId },
//       { $set: { isBlocked: !user.isBlocked } }
//     );

//     // Check if the update was successful
//     if (update.nModified === 0) {
//       return res
//         .status(400)
//         .json({ error: "Failed to update user block status" });
//     }

//     res.status(200).json({ message: "User block status updated successfully" });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// @desc handle block of secondary user
// route POST/api/admin/handleSecondaryBlock
// export const handleSecondaryBlock = async (req, res) => {
//   const userId = req.params.id;

//   try {
//     const user = await SecondaryUser.findById(userId);
//     console.log("user", user);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Update the user's approval status
//     const update = await SecondaryUser.updateOne(
//       { _id: userId },
//       { $set: { isBlocked: !user.isBlocked } }
//     );

//     // Check if the update was successful
//     if (update.nModified === 0) {
//       return res
//         .status(400)
//         .json({ error: "Failed to update user block status" });
//     }

//     res.status(200).json({ message: "User block status updated successfully" });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// @desc handle subscription of primary user
// route POST/api/admin/handleSubscription

// export const handleSubscription = async (req, res) => {
//   const userId = req.params.id;

//   try {
//     const user = await PrimaryUsers.findById(userId);
//     console.log("user", user);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     let newSubscription =
//       user.subscription === "monthly" ? "yearly" : "monthly";

//     // Update the user's approval status
//     const update = await PrimaryUsers.updateOne(
//       { _id: userId },
//       { $set: { subscription: newSubscription } }
//     );

//     // Check if the update was successful
//     if (update.nModified === 0) {
//       return res
//         .status(400)
//         .json({ error: "Failed to update user subscription status" });
//     }

//     res
//       .status(200)
//       .json({ message: "User subscription status updated successfully" });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// @desc handle sms provision of primary user
// route POST/api/admin/handleSms

// export const handleSms = async (req, res) => {
//   const userId = req.params.id;

//   try {
//     const user = await PrimaryUsers.findById(userId);
//     console.log("user", user);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Update the user's approval status
//     const update = await PrimaryUsers.updateOne(
//       { _id: userId },
//       { $set: { sms: !user.sms } }
//     );

//     // Check if the update was successful
//     if (update.nModified === 0) {
//       return res
//         .status(400)
//         .json({ error: "Failed to update user sms status" });
//     }

//     res.status(200).json({ message: "User sms status updated successfully" });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// @desc handle whatsApp provision of primary user
// route POST/api/admin/handleWhatsApp

// export const handleWhatsApp = async (req, res) => {
//   const userId = req.params.id;

//   try {
//     const user = await PrimaryUsers.findById(userId);
//     console.log("user", user);

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Update the user's approval status
//     const update = await PrimaryUsers.updateOne(
//       { _id: userId },
//       { $set: { whatsApp: !user.whatsApp } }
//     );

//     // Check if the update was successful
//     if (update.nModified === 0) {
//       return res
//         .status(400)
//         .json({ error: "Failed to update user whatsApp status" });
//     }

//     res
//       .status(200)
//       .json({ message: "User whatsApp status updated successfully" });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };



// @desc get all organizations
// route POST/api/admin/getOrganizationsAdmin
export const getOrganizationsAdmin = async (req, res) => {
  try {
    const organizations = await Organization.find({})
      .sort({ createdAt: -1 })
      .populate("owner");
    if (organizations) {
      return res.status(200).json({
        data: organizations,
        message: "Organization fetched",
      });
    } else {
      return res.status(404).json({ message: "No organization were found" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error, try again!" });
  }
};

// @desc get Primary user organization list
// route GET/api/admin/getOrganizations
export const getOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({});
    if (organizations) {
      return res.status(200).json({
        organizationData: organizations,
        message: "Organization fetched",
      });
    } else {
      return res
        .status(404)
        .json({ message: "No organization were found for user" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error, try again!" });
  }
};

// @desc get secondary users list
// route GET/api/admin/fetchSecondaryUsers

export const fetchSecondaryUsers = async (req, res) => {
  try {
    const secondaryUsers = await SecondaryUser.find({})
      .populate({
        path: "organization",
        select: "name",
      })
      .populate({
        path: "primaryUser",
        select: "userName",
      })
      .select("name email mobile isBlocked")
      .exec();
    if (secondaryUsers) {
      return res.status(200).json({
        secondaryUsers: secondaryUsers,
        message: "secondaryUsers fetched",
      });
    } else {
      return res
        .status(404)
        .json({ message: "No secondaryUsers were found for user" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error, try again!" });
  }
};

// @desc get secondary users list
// route GET/api/admin/handleCompanyDelete

export const handleCompanyDelete = async (req, res) => {
  const companyId = req.params.cmp_id;

  try {
    // Check if company exists first
    const company = await OragnizationModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const deletionResults = await Promise.all([
      AccountGroup.deleteMany({ cmp_id: companyId }),
      additionalChargesModel.deleteMany({ cmp_id: companyId }),
      Banks.deleteMany({ cmp_id: companyId }),
      BanksOd.deleteMany({ cmp_id: companyId }),
      BarcodeModel.deleteMany({ cmp_id: companyId }),
      Brand.deleteMany({ cmp_id: companyId }),
      Cash.deleteMany({ cmp_id: companyId }),
      Category.deleteMany({ cmp_id: companyId }),
      CreditNote.deleteMany({ cmp_id: companyId }),
      DebitNote.deleteMany({ cmp_id: companyId }),
      Godown.deleteMany({ cmp_id: companyId }),
      hsnModel.deleteMany({ cpm_id: companyId }),
      invoiceModel.deleteMany({ cmp_id: companyId }),
      partyModel.deleteMany({ cmp_id: companyId }),
      Payment.deleteMany({ cmp_id: companyId }),
      PriceLevel.deleteMany({ cmp_id: companyId }),
      productModel.deleteMany({ cmp_id: companyId }),
      purchaseModel.deleteMany({ cmp_id: companyId }),
      Receipt.deleteMany({ cmp_id: companyId }),
      salesModel.deleteMany({ cmp_id: companyId }),
      stockTransferModel.deleteMany({ cmp_id: companyId }),
      Subcategory.deleteMany({ cmp_id: companyId }),
      SubgroupModel.deleteMany({ cmp_id: companyId }),
      TallyData.deleteMany({ cmp_id: companyId }),
      vanSaleModel.deleteMany({ cmp_id: companyId }),
      TransactionModel.deleteMany({ cmp_id: companyId }),
      VoucherSeriesModel.deleteMany({ cmp_id: companyId }),
      warrantyCardModel.deleteMany({ cmp_id: companyId }),
    ]);

    const [
      accountGroupResult,
      additionalChargesResult,
      banksResult,
      banksOdResult,
      barcodeResult,
      brandResult,
      cashResult,
      categoryResult,
      creditNoteResult,
      debitNoteResult,
      godownResult,
      hsnResult,
      invoiceResult,
      partyResult,
      paymentResult,
      priceLevelResult,
      productResult,
      purchaseResult,
      receiptResult,
      salesResult,
      stockTransferResult,
      subcategoryResult,
      subgroupResult,
      tallyDataResult,
      vanSaleResult,
      transactionResult,
      voucherSeriesResult,
      warrantyCardResult,
    ] = deletionResults;

    const deletionCounts = {
      accountGroups: accountGroupResult.deletedCount,
      additionalCharges: additionalChargesResult.deletedCount,
      banks: banksResult.deletedCount,
      banksOd: banksOdResult.deletedCount,
      barcodes: barcodeResult.deletedCount,
      brands: brandResult.deletedCount,
      cash: cashResult.deletedCount,
      categories: categoryResult.deletedCount,
      creditNotes: creditNoteResult.deletedCount,
      debitNotes: debitNoteResult.deletedCount,
      godowns: godownResult.deletedCount,
      hsn: hsnResult.deletedCount,
      invoices: invoiceResult.deletedCount,
      parties: partyResult.deletedCount,
      payments: paymentResult.deletedCount,
      priceLevels: priceLevelResult.deletedCount,
      products: productResult.deletedCount,
      purchases: purchaseResult.deletedCount,
      receipts: receiptResult.deletedCount,
      sales: salesResult.deletedCount,
      stockTransfers: stockTransferResult.deletedCount,
      subcategories: subcategoryResult.deletedCount,
      subgroups: subgroupResult.deletedCount,
      tallyData: tallyDataResult.deletedCount,
      vanSales: vanSaleResult.deletedCount,
      transactions: transactionResult.deletedCount,
      voucherSeries: voucherSeriesResult.deletedCount,
      warrantyCards: warrantyCardResult.deletedCount,
    };

    // Finally delete the company itself
    await OragnizationModel.findByIdAndDelete(companyId);

    res.status(200).json({
      message: "Company and associated data deleted successfully",
      deletionCounts: deletionCounts,
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/// @desc get company data count
// route GET/api/admin/getCompanyDataCount/:cmp_id

export const getCompanyDataCount = async (req, res) => {
  const companyId = req.params.cmp_id;

  try {
    // Check if company exists first
    const company = await OragnizationModel.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const countResults = await Promise.all([
      AccountGroup.countDocuments({ cmp_id: companyId }),
      additionalChargesModel.countDocuments({ cmp_id: companyId }),
      Banks.countDocuments({ cmp_id: companyId }),
      BanksOd.countDocuments({ cmp_id: companyId }),
      BarcodeModel.countDocuments({ cmp_id: companyId }),
      Brand.countDocuments({ cmp_id: companyId }),
      Cash.countDocuments({ cmp_id: companyId }),
      Category.countDocuments({ cmp_id: companyId }),
      CreditNote.countDocuments({ cmp_id: companyId }),
      DebitNote.countDocuments({ cmp_id: companyId }),
      Godown.countDocuments({ cmp_id: companyId }),
      hsnModel.countDocuments({ cpm_id: companyId }),
      invoiceModel.countDocuments({ cmp_id: companyId }),
      partyModel.countDocuments({ cmp_id: companyId }),
      Payment.countDocuments({ cmp_id: companyId }),
      PriceLevel.countDocuments({ cmp_id: companyId }),
      productModel.countDocuments({ cmp_id: companyId }),
      purchaseModel.countDocuments({ cmp_id: companyId }),
      Receipt.countDocuments({ cmp_id: companyId }),
      salesModel.countDocuments({ cmp_id: companyId }),
      stockTransferModel.countDocuments({ cmp_id: companyId }),
      Subcategory.countDocuments({ cmp_id: companyId }),
      SubgroupModel.countDocuments({ cmp_id: companyId }),
      TallyData.countDocuments({ cmp_id: companyId }),
      vanSaleModel.countDocuments({ cmp_id: companyId }),
      TransactionModel.countDocuments({ cmp_id: companyId }),
      VoucherSeriesModel.countDocuments({ cmp_id: companyId }),
      warrantyCardModel.countDocuments({ cmp_id: companyId }),
    ]);

    const [
      accountGroupCount,
      additionalChargesCount,
      banksCount,
      banksOdCount,
      barcodeCount,
      brandCount,
      cashCount,
      categoryCount,
      creditNoteCount,
      debitNoteCount,
      godownCount,
      hsnCount,
      invoiceCount,
      partyCount,
      paymentCount,
      priceLevelCount,
      productCount,
      purchaseCount,
      receiptCount,
      salesCount,
      stockTransferCount,
      subcategoryCount,
      subgroupCount,
      tallyDataCount,
      vanSaleCount,
      transactionCount,
      voucherSeriesCount,
      warrantyCardCount,
    ] = countResults;

    const documentCounts = {
      accountGroups: accountGroupCount,
      additionalCharges: additionalChargesCount,
      banks: banksCount,
      banksOd: banksOdCount,
      barcodes: barcodeCount,
      brands: brandCount,
      cash: cashCount,
      categories: categoryCount,
      creditNotes: creditNoteCount,
      debitNotes: debitNoteCount,
      godowns: godownCount,
      hsn: hsnCount,
      invoices: invoiceCount,
      parties: partyCount,
      payments: paymentCount,
      priceLevels: priceLevelCount,
      products: productCount,
      purchases: purchaseCount,
      receipts: receiptCount,
      sales: salesCount,
      stockTransfers: stockTransferCount,
      subcategories: subcategoryCount,
      subgroups: subgroupCount,
      tallyData: tallyDataCount,
      vanSales: vanSaleCount,
      transactions: transactionCount,
      voucherSeries: voucherSeriesCount,
      warrantyCards: warrantyCardCount,
    };

    // Calculate total documents
    const totalDocuments = Object.values(documentCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    res.status(200).json({
      message: "Company data count retrieved successfully",
      companyId: companyId,
      companyName: company.name || "N/A",
      totalDocuments: totalDocuments,
      documentCounts: documentCounts,
    });
  } catch (error) {
    console.error("Error getting company data count:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc to sync all indexes
// route POST/api/admin/syncIndexes

export const syncIndexes = async (req, res) => {
  try {
    const modelNames = mongoose.modelNames(); // Gets all registered model names
    console.log(modelNames);

    for (const name of modelNames) {
      const model = mongoose.model(name);
      await model.syncIndexes();
      console.log(`Synced indexes for model: ${name}`);
    }

    res.status(200).json({ message: "All indexes synced successfully" });
  } catch (error) {
    console.error("Index sync error:", error);
    res
      .status(500)
      .json({ message: "Index sync failed", error: error.message });
  }
};

// Add this import at the top of your admin controller file

// Fixed getPrimaryUserProfileById function
export const getPrimaryUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Fetch primary user details
    const primaryUser = await PrimaryUsers.findById(userId)
      .select(
        "userName email mobile subscription subscriptionExpiry createdAt updatedAt sms whatsApp isBlocked isApproved role"
      )
      .lean();

    if (!primaryUser) {
      return res.status(404).json({
        success: false,
        message: "Primary user not found",
      });
    }

    // Fetch organization details for this user
    const organization = await Organization.find({ owner: userId })
      .select("name place type industry isBlocked isApproved createdAt logo")
      .lean();

    // Fetch secondary users for this primary user
    const secondaryUsers = await SecondaryUser.find({ primaryUser: userId })
      .select("name email mobile isBlocked createdAt")
      .lean();

    // Prepare response data to match frontend expectations
    const responseData = {
      primaryUser: {
        id: primaryUser._id,
        name: primaryUser.userName,
        email: primaryUser.email,
        phoneNumber: primaryUser.mobile,
        subscriptionType: primaryUser.subscription,
        createdAt: primaryUser.createdAt,
        expiredAt: primaryUser.subscriptionExpiry || calculateSubscriptionExpiry(primaryUser.createdAt, primaryUser.subscription),
        sms: primaryUser.sms || false,
        whatsApp: primaryUser.whatsApp || false,
        isBlocked: primaryUser.isBlocked || false,
        isApproved: primaryUser.isApproved || false,
      },
      organization: organization.map((org) => ({
        id: org._id,
        name: org.name,
        place: org.place,
        type: org.type,
        industry: org.industry,
        isBlocked: org.isBlocked || false,
        isApproved: org.isApproved || false,
        createdAt: org.createdAt,
        logo: org.logo,
      })),
      secondaryUsers: secondaryUsers.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,

        isBlocked: user.isBlocked || false,
        createdAt: user.createdAt,
      })),
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching primary user profile by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Add these new mutation endpoints to match frontend expectations

// Update Primary User Status
export const updatePrimaryUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { field, value } = req.body;

    const allowedFields = [
      "sms",
      "whatsApp",
      "isBlocked",
      "isApproved",
      "subscription",
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field specified",
      });
    }

    // Validate subscriptionType values
    if (field === "subscription") {
      if (!["yearly", "monthly"].includes(value)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid subscription type. Must be "yearly" for yearly or "monthly" for monthly',
        });
      }
    }

    // Validate boolean fields
    if (["sms", "whatsApp", "isBlocked", "isApproved"].includes(field)) {
      if (typeof value !== "boolean") {
        return res.status(400).json({
          success: false,
          message: `${field} must be a boolean value`,
        });
      }
    }

    console.log(field, value);

    const changes = { [field]: value };
    if (field === "subscription") {
      // An admin plan update is a renewal: it starts a fresh plan from today.
      changes.subscription = normalizeSubscription(value);
      changes.subscriptionExpiry = calculateSubscriptionExpiry(new Date(), changes.subscription);
    }

    const update = await PrimaryUsers.updateOne(
      { _id: userId },
      { $set: changes }
    );

    if (update.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${field} status updated successfully`,
    });
  } catch (error) {
    console.error("Error updating primary user status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// @desc Renew a primary user's current subscription plan
// @route POST /api/admin/renewSubscription/:userId
export const renewPrimaryUserSubscription = async (req, res) => {
  try {
    const user = await PrimaryUsers.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const subscription = normalizeSubscription(user.subscription);
    let subscriptionExpiry;

    if (req.body.subscriptionExpiry) {
      subscriptionExpiry = new Date(`${req.body.subscriptionExpiry}T23:59:59.999`);
      if (Number.isNaN(subscriptionExpiry.getTime()) || subscriptionExpiry <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Choose a valid future subscription expiry date",
        });
      }
    } else {
      subscriptionExpiry = calculateSubscriptionExpiry(new Date(), subscription);
    }
    // Use updateOne so renewing never triggers the legacy password pre-save hook.
    await PrimaryUsers.updateOne(
      { _id: user._id },
      { $set: { subscription, subscriptionExpiry } }
    );

    return res.status(200).json({
      success: true,
      message: `Subscription renewed until ${subscriptionExpiry.toLocaleDateString()}`,
      subscriptionExpiry,
    });
  } catch (error) {
    console.error("Error renewing subscription:", error);
    return res.status(500).json({ success: false, message: "Unable to renew subscription" });
  }
};
// Update Organization Status
export const updateOrganizationStatus = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { field, value } = req.body;
    const allowedFields = ["isBlocked", "isApproved"];
    
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field specified",
      });
    }

    // Get organization data before update if we need to send approval email
    let organization = null;
    if (field === "isApproved" && value === true) {
      organization = await Organization.findById(organizationId).populate("owner");
      
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      // Check if organization is already approved to avoid sending duplicate emails
      if (organization.isApproved === true) {
        return res.status(200).json({
          success: true,
          message: "Organization is already approved",
        });
      }
    }

    const update = await Organization.updateOne(
      { _id: organizationId },
      { $set: { [field]: value } }
    );

    if (update.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Send approval email if the field is isApproved and value is true
    if (field === "isApproved" && value === true && organization) {
      const emailResult = await sendOrganizationApprovalEmail(organization);
      
      if (emailResult.success) {
        return res.status(200).json({
          success: true,
          message: "Organization approved successfully and email sent",
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "Organization approved successfully but email failed to send",
          emailError: emailResult.error,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Organization ${field} status updated successfully`,
    });
  } catch (error) {
    console.error("Error updating organization status:", error);

    // Handle invalid ObjectId error from MongoDB
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid organization ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Secondary User Status
export const updateSecondaryUserStatus = async (req, res) => {
  try {
    const { secondaryUserId } = req.params;
    const { field, value } = req.body;
    console.log("secondaryUserId", secondaryUserId);
    const allowedFields = ["isBlocked"];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field specified",
      });
    }

    const update = await SecondaryUser.updateOne(
      { _id: secondaryUserId },
      { $set: { [field]: value } }
    );

    if (update.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Secondary user not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Secondary user ${field} status updated successfully`,
    });
  } catch (error) {
    console.error("Error updating secondary user status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Single controller to update user capacity limits (both organization and secondary user)
export const updateUserCapacity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { field, value } = req.body;

    console.log("Updating capacity:", { userId, field, value });

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Validate field - only allow these two fields
    const allowedFields = ["organizationLimit", "secondaryUserLimit"];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid field. Allowed fields: organizationLimit, secondaryUserLimit",
      });
    }

    // Validate value
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 1 || numericValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Value must be a number between 1 and 100",
      });
    }

    // Find and update user
    const user = await PrimaryUsers.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Store old value for logging
    const oldValue = user[field];

    // Update the specific field
    user[field] = numericValue;

    // Save the user
    const updatedUser = await user.save();

    // Log the update for audit purposes
    console.log(
      `Updated ${field} for user ${userId}: ${oldValue} → ${numericValue}`
    );

    // Determine field name for response
    const fieldDisplayName =
      field === "organizationLimit" ? "Organization" : "Secondary User";

    // Return success response
    res.status(200).json({
      success: true,
      message: `${fieldDisplayName} limit updated successfully`,
      data: {
        userId: updatedUser._id,
        userName: updatedUser.userName,
        field: field,
        oldValue: oldValue,
        newValue: updatedUser[field],
        organizationLimit: updatedUser.organizationLimit,
        secondaryUserLimit: updatedUser.secondaryUserLimit,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating user capacity:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    // Handle other errors
    res.status(500).json({
      success: false,
      message: "Internal server error while updating capacity",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Something went wrong",
    });
  }
};
