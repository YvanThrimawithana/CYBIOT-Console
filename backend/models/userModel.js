const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const usersPath = path.join(__dirname, "../data/users.json");

const getUser = async (username) => {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    return users.find(user => user.username === username);
};

const createUser = async (username, password) => {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = { username, password: hashedPassword };
    users.push(newUser);
    
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return newUser;
};

module.exports = { getUser, createUser };
