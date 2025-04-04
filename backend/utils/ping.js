const ping = require("ping");
const checkDeviceAvailability = async (ip) => {
    const res = await ping.promise.probe(ip);
    return res.alive;
};
module.exports = { checkDeviceAvailability };