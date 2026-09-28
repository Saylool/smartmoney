const fs = require("fs");
const abi = JSON.parse(fs.readFileSync("src/lib/abi.json", "utf8"));
fs.writeFileSync("src/lib/abi.ts", "// Generated from contracts/out via `npm run abi`. Do not edit by hand.\nexport const smartMoneyAbi = " + JSON.stringify(abi, null, 2) + " as const;\n");
fs.unlinkSync("src/lib/abi.json");
