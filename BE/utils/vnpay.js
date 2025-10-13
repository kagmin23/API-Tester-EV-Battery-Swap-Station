const crypto = require('crypto');
const qs = require('querystring');

function sortObject(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let i = 0; i < str.length; i++) {
    sorted[str[i]] = encodeURIComponent(obj[str[i]]).replace(/%20/g, '+');
  }
  return sorted;
}

function createVnpayUrl({ amount, orderInfo, ipAddr, returnUrl, vnp_TmnCode, vnp_HashSecret, vnp_Url }) {
  const date = new Date();
  const createDate = `${date.getFullYear()}${('0'+(date.getMonth()+1)).slice(-2)}${('0'+date.getDate()).slice(-2)}${('0'+date.getHours()).slice(-2)}${('0'+date.getMinutes()).slice(-2)}${('0'+date.getSeconds()).slice(-2)}`;
  const txnRef = Math.floor(Math.random() * 1000000).toString();
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };
  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', vnp_HashSecret);
  const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  const paymentUrl = `${vnp_Url}?${signData}&vnp_SecureHash=${vnp_SecureHash}`;
  return { paymentUrl, txnRef };
}

function verifyVnpayReturn(query, vnp_HashSecret) {
  const receivedSecureHash = query.vnp_SecureHash;
  delete query.vnp_SecureHash;
  delete query.vnp_SecureHashType;
  const sorted = sortObject(query);
  const signData = require('querystring').stringify(sorted, { encode: false });
  const hmac = crypto.createHmac('sha512', vnp_HashSecret);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  return signed === receivedSecureHash;
}

module.exports = { createVnpayUrl, verifyVnpayReturn };
