const crypto = require("crypto");

function employeeCodeGenerator(prefix = "EMP") {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `${prefix}${random}`;
}

module.exports = {
  employeeCodeGenerator
};