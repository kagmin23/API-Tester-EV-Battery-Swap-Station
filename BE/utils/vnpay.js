const crypto = require("crypto");
const qs = require("qs"); // dùng qs thay vì querystring (hỗ trợ encode chính xác hơn)

/**
 * Sort object keys (the correct way for VNPAY)
 */
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = obj[key];
  }
  return sorted;
}

/**
 * Create VNPAY payment URL
 */
function createVnpayUrl({ amount, orderInfo, ipAddr, returnUrl, vnp_TmnCode, vnp_HashSecret, vnp_Url }) {
  const date = new Date();
  const pad = (n) => (n < 10 ? "0" + n : n);
  const createDate = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const txnRef = date.getTime(); // đảm bảo duy nhất theo thời gian

  const vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef.toString(),
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: amount * 100, // đơn vị: VND * 100
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", vnp_HashSecret);
  const vnp_SecureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const paymentUrl = `${vnp_Url}?${qs.stringify(sortedParams, { encode: true })}&vnp_SecureHash=${vnp_SecureHash}`;
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
