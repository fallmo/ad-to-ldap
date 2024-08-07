const fs = require("fs/promises");

// takes ldap attribute and returns ad equivalent
// source https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/7/html/windows_integration_guide/about-sync-schema#about-sync-schema
function translateADKey(attribute) {
  switch (attribute) {
    case "name": // AD Attribute
      return "cn"; // LDAP Attribute
    case "userCertificate":
      return "userCertificate";
    case "pager":
      return "pager";
    case "x121Address":
      return "x121Address";
    case "userAccountControl":
      return "nsAccountLock";
    case "sAMAccountName":
      return "ntUserDomainId";
    case "homeDirectory":
      return "ntUserHomeDir";
    case "scriptPath":
      return "ntUserScriptPath";
    case "lastLogon":
      return "ntUserLastLogon";
    case "lastLogoff":
      return "ntUserLastLogoff";
    case "accountExpires":
      return "ntUserAcctExpires";
    case "codePage":
      return "ntUserCodePage";
    case "logonHours":
      return "ntUserLogonHours";
    case "maxStorage":
      return "ntUserMaxStorage";
    case "profilePath":
      return "ntUserProfile";
    case "userParameters":
      return "ntUserParms";
    case "userWorkstations":
      return "ntUserWorkstations";
    default:
      return attribute;
  }
}

const requireVariable = (name) => {
  const val = process.env[name];
  if (val) return val;
  console.error(`Variable '${name}' is required.`);
  process.exit(1);
};

function parseDataFromRaw(data) {
  const dataBlocks = data
    .replaceAll(/: \r\n/g, ": ") // entries with key and value on seperate lines
    .split("\r\n\r\n") // return newline return newline
    .map((blk) => blk.trim())
    .filter((blk) => !!blk);

  const users = [];
  const otherData = [];

  for (const block of dataBlocks) {
    const object = getObjectFromBlock(block);

    if (objectIsUser(object)) {
      object["uid"] = object.ntUserDomainId;
      users.push(object);
    } else {
      otherData.push(object);
    }
    try {
    } catch (err) {
      console.log(err);
      console.log(`\nFailed to parse user out of block: '${block}'\n`);
    }
  }

  return { users, otherData };
}

function getObjectFromBlock(block) {
  return block.split("\n").reduce((obj, line) => {
    let { key, val } = getKeyValFromLine(line);

    if (!val) return obj;

    if (!obj[key]) {
      obj[key] = val;
    } else if (Array.isArray(obj[key])) {
      obj[key].push(val);
    } else if (obj[key] === val) {
      return obj;
    } else {
      obj[key] = [obj[key], val];
    }

    return obj;
  }, {});
}

function objectIsUser(object) {
  return ["person", "organizationalPerson", "user", "inetOrgPerson"].some(
    (klass) => object.objectClass.includes(klass)
  );
}

function getKeyValFromLine(line) {
  let key;
  let val;

  // line is base64 encoded
  if (line.includes(":: ")) {
    [key, val] = line.split(":: ");
    // val = decodeBase64(val.replace("\r", "").trim()); // wierd characters on some
    val = val.replace("\r", "").trim() + " (base64 encoded)";
  } else if (line.includes(": ")) {
    [key, val] = line.split(": ");
    val = val.replace("\r", "").trim();
  }

  return { key: translateADKey(key), val };
}

function decodeBase64(string) {
  return Buffer.from(string, "base64").toString("utf-8");
}

const relevantKeys = [
  "dn",
  "displayName",
  "name",
  "cn",
  "ou",
  "uid",
  "objectClass",
  "dNSHostName",
  "ntUserDomainId",
  "whenCreated",
  "whenChanged",
];

function getOuptutDataFromUsers(users) {
  return users
    .map((user) =>
      Object.keys(user).reduce((output, key) => {
        if (!relevantKeys.includes(key)) return output;
        if (!Array.isArray(user[key])) output += `\n${key}: ${user[key]}`;
        else {
          user[key].forEach((val) => {
            output += `\n${key}: ${val}`;
          });
        }
        return output;
      }, "")
    )
    .join("\n\n");
}

const ad_file = requireVariable("AD_FILE");
const ldap_file = requireVariable("LDAP_FILE");

function writeUsersToFile(users) {
  const data = getOuptutDataFromUsers(users);
  fs.writeFile(ldap_file, data, { encoding: "utf-8" })
    .then(() => console.log("File written with users"))
    .catch((err) => {
      console.error(err, "Failed to write users to file");
    });
}

fs.readFile(ad_file, { encoding: "utf-8" })
  .then((fileData) => {
    const { users, otherData } = parseDataFromRaw(fileData);
    writeUsersToFile(users);
  })
  .catch((err) => {
    console.error(err, "Failed to read ad file");
  });
