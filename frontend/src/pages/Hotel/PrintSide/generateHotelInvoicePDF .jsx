import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateStayDays, getRoomStayStartDate } from "../Helper/hotelHelper";

// Helper function to format date
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Helper to get base64 from URL
async function getBase64FromUrl(url) {
  if (url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Transform single checkout to date-wise rows
const transformSingleCheckOut = (checkoutItem) => {
  const result = [];
  
  checkoutItem.selectedRooms.forEach((room) => {
    const stayDays = calculateStayDays(
      checkoutItem,
      room,
      checkoutItem.arrivalDate,
      checkoutItem.checkOutDate,
      checkoutItem.stayDays,
    );
    if (stayDays <= 0) return;
    const fullDays = Math.floor(stayDays);
    const fractionalDay = stayDays - fullDays;
    
    const perDayAmount = room.baseAmountWithTax / stayDays;
    const baseAmount = room.baseAmount / stayDays;
    const taxAmount = room.taxAmount / stayDays;
    const foodPlanAmountWithTax = (room.foodPlanAmountWithTax || 0) / stayDays;
    const foodPlanAmountWithOutTax = (room.foodPlanAmountWithOutTax || 0) / stayDays;
    const additionalPaxDataWithTax = (room.additionalPaxAmountWithTax || 0) / stayDays;
    const additionalPaxDataWithOutTax = (room.additionalPaxAmountWithOutTax || 0) / stayDays;
    
    const startDate = new Date(
      getRoomStayStartDate(checkoutItem, room, checkoutItem.arrivalDate),
    );
    
    // Full days
    for (let i = 0; i < fullDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const formattedDate = d.toLocaleDateString("en-GB").replace(/\//g, "-");
      
      result.push({
        date: formattedDate,
        baseAmountWithTax: perDayAmount,
        baseAmount,
        taxAmount,
        voucherNumber: checkoutItem.voucherNumber,
        roomName: room.roomName,
        hsn: room?.hsnDetails?.hsn,
        customerName: checkoutItem.customerId?.partyName,
        foodPlanAmountWithTax,
        foodPlanAmountWithOutTax,
        additionalPaxDataWithTax,
        additionalPaxDataWithOutTax,
      });
    }
    
    // Fractional day (50%)
    if (fractionalDay > 0) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + fullDays);
      const formattedDate = d.toLocaleDateString("en-GB").replace(/\//g, "-");
      
      result.push({
        date: formattedDate,
        baseAmountWithTax: perDayAmount * 0.5,
        baseAmount: baseAmount * 0.5,
        taxAmount: taxAmount * 0.5,
        voucherNumber: checkoutItem.voucherNumber,
        roomName: room.roomName,
        hsn: room?.hsnDetails?.hsn,
        customerName: checkoutItem.customerId?.partyName,
        foodPlanAmountWithTax: foodPlanAmountWithTax * 0.5,
        foodPlanAmountWithOutTax: foodPlanAmountWithOutTax * 0.5,
        additionalPaxDataWithTax: additionalPaxDataWithTax * 0.5,
        additionalPaxDataWithOutTax: additionalPaxDataWithOutTax * 0.5,
      });
    }
  });
  
  return result;
};

// Scope outstanding to single checkout
const scopeOutStanding = (allOutStanding, checkoutItem) => {
  const cid = checkoutItem?.customerId?._id || checkoutItem?.customerId?.id;
  const chkId = checkoutItem?.checkInId?._id || checkoutItem?.checkInId?.id;
  const bookingId = checkoutItem?.bookingId;
  
  return (allOutStanding || []).filter(
    (t) =>
      (cid && (t?.customerId === cid || t?.customer_id === cid)) ||
      (chkId && (t?.checkInId === chkId || t?.checkin_id === chkId)) ||
      (bookingId && t?.bookingId === bookingId)
  );
};

// Scope KOT to single checkout
const scopeKot = (allKotData, checkoutItem) => {
  const chkId = checkoutItem?.checkInId?._id || checkoutItem?.checkInId?.id;
  const bookingId = checkoutItem?.bookingId;
  
  return (allKotData || []).filter(
    (k) =>
      (chkId && (k?.checkInId === chkId || k?.checkin_id === chkId)) ||
      (bookingId && k?.bookingId === bookingId)
  );
};

// Build invoice data for single checkout
const buildInvoiceDataForCheckout = (checkoutItem, allOutStanding, allKotData, organization, secondaryUser) => {
  const rows = transformSingleCheckOut(checkoutItem);
  
  // Calculate totals for this checkout only
  const roomTariffTotal = rows.reduce((t, r) => t + Number(r.baseAmount || 0), 0);
  const taxAmount = rows.reduce((t, r) => t + Number(r.taxAmount || 0), 0);
  const planAmount = rows.reduce((t, r) => t + Number(r.foodPlanAmountWithOutTax || 0), 0);
  const taxAmountFoodPlan = rows.reduce(
    (t, r) => t + (Number(r.foodPlanAmountWithTax || 0) - Number(r.foodPlanAmountWithOutTax || 0)),
    0
  );
  const paxAmount = rows.reduce((t, r) => t + Number(r.additionalPaxDataWithOutTax || 0), 0);
  
  const totalAmountIncludeAllTax = roomTariffTotal + planAmount + paxAmount + taxAmount + taxAmountFoodPlan;
  
  const scopedOut = scopeOutStanding(allOutStanding, checkoutItem);
  const advanceTotal = scopedOut.reduce(
    (t, tr) => t + Number(tr?.bill_amount ?? tr?.billamount ?? tr?.amount ?? 0),
    0
  );
  
  const scopedKot = scopeKot(allKotData, checkoutItem);
  const kotTotal = scopedKot.reduce((t, k) => t + Number(k?.finalAmount || 0), 0);
  
  const taxableAmount = roomTariffTotal + paxAmount;
  const taxRate = taxableAmount ? (taxAmount / taxableAmount) * 100 : 0;
  const taxRateFoodPlan = planAmount ? (taxAmountFoodPlan / planAmount) * 100 : 0;
  
  const sumOfRestaurantAndRoom = totalAmountIncludeAllTax + kotTotal;
  const balanceAmount = totalAmountIncludeAllTax - advanceTotal;
  const balanceAmountToPay = sumOfRestaurantAndRoom - advanceTotal;
  
  const roomNumbers = checkoutItem.selectedRooms?.map((r) => r.roomName).join(", ");
  const totalPax = checkoutItem.selectedRooms?.reduce((n, r) => n + Number(r.pax || 0), 0);
  const roomType = checkoutItem.selectedRooms?.[0]?.roomType?.brand || "";
  const tariff = checkoutItem.selectedRooms?.[0]?.priceLevelRate || "";
  const foodPlan = checkoutItem.foodPlan?.[0]?.foodPlan || "";
  
  return {
    organization,
    secondaryUser,
    selectedCheckOutData: checkoutItem,
    dateWiseDisplayedData: rows,
    outStanding: scopedOut,
    kotData: scopedKot,
    totals: {
      roomTariffTotal,
      advanceTotal,
      kotTotal,
      balanceAmount,
      totalTaxAmount: taxAmount + taxAmountFoodPlan,
      balanceAmountToPay,
      taxData: taxAmount + taxAmountFoodPlan,
      totalAmountIncludeAllTax,
      sumOfRestaurantAndRoom,
      taxableAmount,
      taxRate,
      taxRateFoodPlan,
      taxAmount,
      taxAmountFoodPlan,
      planAmount,
      paxAmount,
    },
    roomNumbers,
    totalPax,
    roomType,
    tariff,
    foodPlan,
    foodPlanAmount: planAmount,
    additionalPaxAmount: paxAmount,
  };
};

// Generate single page in existing PDF doc
const generatePageForCheckout = async (doc, invoiceData, isFirstPage) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  let currentY = 0;

  // Add header
  const addHeader = async () => {
    const startY = 10;
    const maxWidth = pageWidth - (margin + 5) * 2;

    // Add Logo
    if (invoiceData.organization?.logo) {
      try {
        const base64Logo = await getBase64FromUrl(invoiceData.organization.logo);
        doc.addImage(base64Logo, "PNG", margin + 2, startY + 2, 30, 30);
      } catch (err) {
        console.warn("Logo could not be added:", err);
      }
    }

    // Organization name
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const orgName = invoiceData.organization?.name || "";
    const nameLines = doc.splitTextToSize(orgName, maxWidth - 40);
    doc.text(nameLines, pageWidth - (margin + 5), startY + 10, { align: "right" });

    // Organization details
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let headerY = startY + 10 + nameLines.length * 6;

    const orgDetails = [
      invoiceData.organization?.address ||
        `${invoiceData.organization?.flat || ""}, ${invoiceData.organization?.landmark || ""}`.replace(
          /^,\s*|,\s*$/g,
          ""
        ),
      invoiceData.organization?.road,
      invoiceData.organization?.gstNum ? `GSTIN: ${invoiceData.organization.gstNum}` : null,
      `State Name: ${invoiceData.organization?.state || ""}, Pin: ${invoiceData.organization?.pin || ""}`,
      invoiceData.organization?.email ? `E-Mail: ${invoiceData.organization.email}` : null,
    ].filter(Boolean);

    orgDetails.forEach((detail) => {
      doc.text(detail, pageWidth - (margin + 5), headerY, { align: "right" });
      headerY += 5;
    });

    const headerHeight = Math.max(headerY - startY + 5, 40);
    doc.setLineWidth(0.5);
    doc.rect(margin, startY, pageWidth - 2 * margin, headerHeight);
    return startY + headerHeight + 5;
  };

  // Add footer
  const addFooter = () => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth / 2, footerY + 5, { align: "center" });
  };

  // Start generation
  currentY = await addHeader();

  // Invoice Details Section - 3 column grid
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const columnWidth = (pageWidth - 2 * margin) / 3;

  const leftDetails = [
    `GRC No: ${invoiceData.selectedCheckOutData?.voucherNumber || ""}`,
    `Pax: ${invoiceData.totalPax || ""}`,
    `Guest: ${invoiceData.selectedCheckOutData?.customerId?.partyName || ""}`,
    `Agent: ${invoiceData.selectedCheckOutData?.agentId?.name || "Walk-In Customer"}`,
  ];

  const middleDetails = [
    `Bill No: ${invoiceData.selectedCheckOutData?.voucherNumber || ""}`,
    `Arrival: ${formatDate(invoiceData.selectedCheckOutData?.arrivalDate)} / ${
      invoiceData.selectedCheckOutData?.arrivalTime || ""
    }`,
    `Room No: ${invoiceData.roomNumbers || ""}`,
    `Plan: ${invoiceData.foodPlan || ""}`,
  ];

  const rightDetails = [
    `Bill Date: ${formatDate(new Date())}`,
    `Departure: ${formatDate(new Date())} / ${new Date().toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`,
    `Room Type: ${invoiceData.roomType || ""}`,
    `Tariff: ${invoiceData.tariff || ""}`,
  ];

  // Draw columns
  [leftDetails, middleDetails, rightDetails].forEach((column, colIndex) => {
    const x = margin + colIndex * columnWidth + 2;
    column.forEach((item, rowIndex) => {
      const y = currentY + rowIndex * 4;
      doc.text(item, x, y);
    });
  });

  // Grid border and separators
  doc.setLineWidth(0.5);
  doc.rect(margin, currentY - 5, pageWidth - 2 * margin, 21);
  doc.line(margin + columnWidth, currentY - 5, margin + columnWidth, currentY - 5 + 21);
  doc.line(margin + 2 * columnWidth, currentY - 5, margin + 2 * columnWidth, currentY - 5 + 21);
  currentY += 16;

  // Main Transaction Table
  const tableHeaders = ["DATE", "VOUCHER", "DESCRIPTION", "HSN", "DEBIT", "CREDIT", "AMOUNT"];
  const tableData = [];

  // Outstanding Transactions
  if (invoiceData.outStanding && invoiceData.outStanding.length > 0) {
    invoiceData.outStanding.forEach((transaction) => {
      tableData.push([
        formatDate(transaction?.bill_date),
        transaction?.bill_no || "",
        "Advance",
        "",
        "",
        (transaction?.bill_amount || 0).toFixed(2),
        "",
      ]);
    });
  }

  // Room Tariff Entries
  if (invoiceData.dateWiseDisplayedData && invoiceData.dateWiseDisplayedData.length > 0) {
    invoiceData.dateWiseDisplayedData.forEach((order) => {
      tableData.push([
        order?.date,
        order?.voucherNumber || "",
        `Room Tariff [${order?.roomName || ""} - ${order?.customerName || ""}]`,
        order?.hsn || "",
        (order?.baseAmount || 0).toFixed(2),
        "",
        "",
      ]);
    });
  }

  // Assessable value summary
  const roomTariffTotal = invoiceData.totals?.roomTariffTotal || 0;
  tableData.push(["", "", "Room Tariff Assessable Value", "", roomTariffTotal.toFixed(2), "", ""]);

  // Food plan
  if (invoiceData.foodPlanAmount && invoiceData.foodPlanAmount > 0) {
    tableData.push(["", "", "Food Plan Sales", "", invoiceData.foodPlanAmount.toFixed(2), "", ""]);
  }

  // Additional pax
  if (invoiceData.additionalPaxAmount && invoiceData.additionalPaxAmount > 0) {
    tableData.push(["", "", "Additional Pax Amount", "", invoiceData.additionalPaxAmount.toFixed(2), "", ""]);
  }

  // Tax entries
  const cgstAmount = (invoiceData.totals?.taxData || 0) / 2;
  const sgstAmount = (invoiceData.totals?.taxData || 0) / 2;
  tableData.push(["", "", "CGST", "", cgstAmount.toFixed(2), "", ""]);
  tableData.push(["", "", "SGST", "", sgstAmount.toFixed(2), "", ""]);

  // Room summary
  const roomNumbers = invoiceData.roomNumbers || "";
  const totalDebit = invoiceData.totals?.totalAmountIncludeAllTax || 0;
  const totalCredit = invoiceData.totals?.advanceTotal || 0;
  const balanceAmount = invoiceData.totals?.balanceAmount || 0;

  tableData.push([
    "",
    "",
    `ROOM NO : ${roomNumbers}`,
    "",
    totalDebit.toFixed(2),
    totalCredit.toFixed(2),
    balanceAmount.toFixed(2),
  ]);

  // Room service header and entries
  if (invoiceData.kotData && invoiceData.kotData.length > 0) {
    tableData.push(["", "", "RESTAURANT BILL DETAILS", "", "", "", ""]);

    invoiceData.kotData.forEach((kot) => {
      tableData.push([
        formatDate(kot?.createdAt),
        kot?.salesNumber || kot?.voucherNumber || "",
        "POS [Restaurant]",
        "",
        (kot?.finalAmount || 0).toFixed(2),
        "",
        "",
      ]);
    });
  }

  // Final totals
  const kotTotal = invoiceData.totals?.kotTotal || 0;
  const grandTotal = invoiceData.totals?.sumOfRestaurantAndRoom || 0;

  tableData.push(["", "", "", "Total", (roomTariffTotal + kotTotal).toFixed(2), "", grandTotal.toFixed(2)]);
  tableData.push(["", "", "", "", "", "TOTAL", grandTotal.toFixed(2)]);

  // Create main table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: currentY,
    columnStyles: {
      0: { cellWidth: 22, halign: "left" },
      1: { cellWidth: 26, halign: "left" },
      2: { cellWidth: 60, halign: "left" },
      3: { cellWidth: 18, halign: "left" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
    },
    styles: {
      fontSize: 8,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      const cellText = data.cell.text[0] || "";

      if (
        cellText.includes("Room Tariff Assessable Value") ||
        cellText.includes("Total") ||
        cellText.includes("TOTAL INVOICE AMOUNT")
      ) {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = "bold";
      }

      if (cellText.includes("RESTAURANT BILL DETAILS")) {
        data.cell.styles.fillColor = [200, 255, 200];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      }

      if (cellText.includes("ROOM NO :")) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // Tax Breakdown Table
  const taxTableData = [];

  // Room tariff tax
  if (roomTariffTotal > 0) {
    const roomTaxRate = invoiceData.totals?.taxRate || 0;
    const roomTaxAmount = (invoiceData.totals?.taxAmount || 0) / 2;
    taxTableData.push([
      roomTariffTotal.toFixed(2),
      (roomTaxRate / 2).toFixed(2),
      roomTaxAmount.toFixed(2),
      (roomTaxRate / 2).toFixed(2),
      roomTaxAmount.toFixed(2),
      (roomTaxAmount * 2).toFixed(2),
    ]);
  }

  // Food plan tax
  if (invoiceData.foodPlanAmount && invoiceData.foodPlanAmount > 0) {
    const foodTaxRate = invoiceData.totals?.taxRateFoodPlan || 0;
    const foodTaxAmount = (invoiceData.totals?.taxAmountFoodPlan || 0) / 2;
    taxTableData.push([
      invoiceData.foodPlanAmount.toFixed(2),
      (foodTaxRate / 2).toFixed(2),
      foodTaxAmount.toFixed(2),
      (foodTaxRate / 2).toFixed(2),
      foodTaxAmount.toFixed(2),
      (foodTaxAmount * 2).toFixed(2),
    ]);
  }

  // Total tax row
  const totalTaxableAmount = roomTariffTotal + (invoiceData.foodPlanAmount || 0);
  const totalCGST = cgstAmount;
  const totalSGST = sgstAmount;
  const totalTaxAmount = totalCGST + totalSGST;

  if (totalTaxableAmount > 0) {
    taxTableData.push([
      totalTaxableAmount.toFixed(2),
      "",
      totalCGST.toFixed(2),
      "",
      totalSGST.toFixed(2),
      totalTaxAmount.toFixed(2),
    ]);
  }

  // Create tax breakdown table
  if (taxTableData.length > 0) {
    autoTable(doc, {
      head: [
        [{ content: "Taxable", colSpan: 1 }, { content: "CGST", colSpan: 2 }, { content: "SGST", colSpan: 2 }, "Total"],
        ["Amount", "Rate", "Amount", "Rate", "Amount", "Tax"],
      ],
      body: taxTableData,
      startY: currentY,
      margin: { left: pageWidth / 2 + 5, right: margin },
      columnStyles: {
        0: { halign: "right", cellWidth: 18 },
        1: { halign: "center", cellWidth: 12 },
        2: { halign: "right", cellWidth: 15 },
        3: { halign: "center", cellWidth: 12 },
        4: { halign: "right", cellWidth: 15 },
        5: { halign: "right", cellWidth: 15 },
      },
      styles: {
        fontSize: 7,
        cellPadding: 1,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === taxTableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
    });
  }

  currentY = Math.max(currentY + 30, doc.lastAutoTable.finalY + 15);

  // Footer Details
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  // Left side
  const leftColumn1 = [
    "Settlement: Cash",
    `Prepared By: ${invoiceData.secondaryUser?.name || "System"}`,
    "Billed By: Reception",
  ];

  const leftColumn2 = [
    `Rooms: ${roomNumbers}`,
    `Total Rooms: ${invoiceData.selectedCheckOutData?.selectedRooms?.length || 0}`,
    `Total Pax: ${invoiceData.totalPax || 0}`,
  ];

  leftColumn1.forEach((detail, index) => {
    doc.text(detail, margin + 2, currentY + index * 4);
  });

  leftColumn2.forEach((detail, index) => {
    doc.text(detail, margin + 65, currentY + index * 4);
  });

  // Right side - Bank Details
  const bankX = pageWidth / 2 + 30;
  doc.setFont("helvetica", "bold");
  doc.text("Bank Details", bankX + 25, currentY, { align: "center" });
  doc.setLineWidth(0.3);
  doc.line(bankX + 5, currentY + 1, bankX + 45, currentY + 1);

  doc.setFont("helvetica", "normal");
  const bankDetails = [
    `Bank Name: ${invoiceData.organization?.configurations?.[0]?.bank?.acholder_name || ""}`,
    `A/C Number: ${invoiceData.organization?.configurations?.[0]?.bank?.ac_no || ""}`,
    `Branch & IFSC: ${invoiceData.organization?.configurations?.[0]?.bank?.branch || ""}${
      invoiceData.organization?.configurations?.[0]?.bank?.ifsc
        ? ", " + invoiceData.organization.configurations[0].bank.ifsc
        : ""
    }`,
  ];

  bankDetails.forEach((detail, index) => {
    doc.text(detail, bankX, currentY + 5 + index * 4);
  });

  // Signature lines
  const sigY = currentY + 20;
  doc.setLineWidth(0.3);
  doc.line(margin + 10, sigY, margin + 60, sigY);
  doc.line(pageWidth - 80, sigY, pageWidth - 30, sigY);

  doc.setFontSize(8);
  doc.text("Cashier Signature", margin + 35, sigY + 4, { align: "center" });
  doc.text("Guest Signature", pageWidth - 55, sigY + 4, { align: "center" });

  addFooter();
};

// Main batch print handler
export const handlePrintInvoice = async (batchContext) => {
  try {
    const { selectedCheckOutList, organization, secondaryUser, allOutStanding, allKotData } = batchContext;

    if (!selectedCheckOutList || selectedCheckOutList.length === 0) {
      alert("No checkouts to print");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    let isFirstPage = true;

    for (const checkout of selectedCheckOutList) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const invoiceData = buildInvoiceDataForCheckout(checkout, allOutStanding, allKotData, organization, secondaryUser);
      await generatePageForCheckout(doc, invoiceData, isFirstPage);
    }

    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, "_blank");

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
      };
    } else {
      alert("Please allow popups to print the invoice");
    }
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please check console for details.");
  }
};

// Main batch download handler
export const handleDownloadPDF = async (batchContext, filename) => {
  try {
    const { selectedCheckOutList, organization, secondaryUser, allOutStanding, allKotData } = batchContext;

    if (!selectedCheckOutList || selectedCheckOutList.length === 0) {
      alert("No checkouts to download");
      return;
    }

    const doc = new jsPDF("p", "mm", "a4");
    let isFirstPage = true;

    for (const checkout of selectedCheckOutList) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const invoiceData = buildInvoiceDataForCheckout(checkout, allOutStanding, allKotData, organization, secondaryUser);
      await generatePageForCheckout(doc, invoiceData, isFirstPage);
    }

    const defaultFilename =
      selectedCheckOutList.length === 1
        ? `CheckOut-${selectedCheckOutList[0].voucherNumber}.pdf`
        : `CheckOuts-${selectedCheckOutList[0].voucherNumber}-x${selectedCheckOutList.length}.pdf`;

    doc.save(filename || defaultFilename);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please check console for details.");
  }
};
