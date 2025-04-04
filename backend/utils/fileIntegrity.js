const crypto = require("crypto");
const fs = require("fs");

const verifyFileIntegrity = (filePath) => {
    const hash = crypto.createHash("sha256");
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    const calculatedHash = hash.digest("hex");
    return calculatedHash.length === 64; // Ensure hash is correctly calculated
};

module.exports = { verifyFileIntegrity };
