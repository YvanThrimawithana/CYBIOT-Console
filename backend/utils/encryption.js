const CryptoJS = require("crypto-js");
const SECRET_KEY = "mySecretKey";
const encrypt = (data) => CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
const decrypt = (ciphertext) => JSON.parse(CryptoJS.AES.decrypt(ciphertext, SECRET_KEY).toString(CryptoJS.enc.Utf8));
module.exports = { encrypt, decrypt };
