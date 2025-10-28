const crypto = require("crypto");
const qs = require("qs");

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  keys.forEach((key) => {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  });
  return sorted;
}

function createVnpayUrl({
  amount,
  orderInfo,
  ipAddr,
  returnUrl,
  vnp_TmnCode,
  vnp_HashSecret,
  vnp_Url,
}) {
  const date = new Date();
  const pad = (n) => (n < 10 ? "0" + n : n);
  const createDate = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const txnRef = date.getTime().toString();

  let vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  // Sắp xếp & encode trước khi ký
  vnp_Params = sortObject(vnp_Params);

  const signData = Object.keys(vnp_Params)
    .map((key) => `${key}=${vnp_Params[key]}`)
    .join("&");

  const hmac = crypto.createHmac("sha512", vnp_HashSecret);
  const vnp_SecureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // Encode lại khi tạo URL
  const paymentUrl = `${vnp_Url}?${Object.keys(vnp_Params)
    .map((key) => `${key}=${vnp_Params[key]}`)
    .join("&")}&vnp_SecureHash=${vnp_SecureHash}`;

  return { paymentUrl, txnRef };
}


/**
 * Verify VNPAY return data
 */
function verifyVnpayReturn(query, vnp_HashSecret) {
  const secureHash = query.vnp_SecureHash;
  delete query.vnp_SecureHash;
  delete query.vnp_SecureHashType;

  const sorted = sortObject(query);
  const signData = qs.stringify(sorted, { encode: false });

  const hmac = crypto.createHmac("sha512", vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return secureHash === signed;
}

module.exports = { createVnpayUrl, verifyVnpayReturn };
