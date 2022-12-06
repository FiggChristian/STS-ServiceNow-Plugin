const constants = require("./src/constants.json");

module.exports = function (source) {
  const variables = toCSSLines(flatten(constants));
  return variables + source;
};

function flatten(object, prefix) {
  prefix = prefix || "";
  const flattened = {};
  for (const key in object) {
    const value = object[key];
    if (typeof value === "string") {
      flattened[prefix + key] = '"' + value + '"';
    } else if (typeof value === "number") {
      flattened[prefix + key] = value.toString();
    } else if (typeof object === "object" && object !== null) {
      Object.assign(flattened, flatten(value, prefix + key + "_"));
    }
  }
  return flattened;
}

function toCSSLines(object) {
  let lines = "";
  for (const varName in object) {
    const value = object[varName];
    lines += `$${varName}: ${value};\n`;
  }
  return lines;
}
