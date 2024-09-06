const fs = require("fs/promises");

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
  const organizationalUnits = [];
  const computers = [];
  const otherData = [];

  for (const block of dataBlocks) {
    const object = getObjectFromBlock(block);

    if (objectIsUser(object)) {
      object["pwdLastSet"] = 0;
      users.push(object);
    } else if (objectIsOu(object)) {
      organizationalUnits.push(object);
    } else if(objectIsComputer(object)){
      computers.push(object);
    } else {
      otherData.push(object);
    }
    try {
    } catch (err) {
      console.log(err);
      console.log(`\nFailed to parse user out of block: '${block}'\n`);
    }
  }

  return { users, organizationalUnits, computers, otherData };
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

function objectIsOu(object) {
  return ["organizationalUnit"].some(
    (klass) => object.objectClass.includes(klass)
  );
}

function objectIsComputer(object) {
  return ["computer"].some(
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

  return { key: key, val };
}

function decodeBase64(string) {
  return Buffer.from(string, "base64").toString("utf-8");
}

const bannedKeys = ["sAMAccountType", "objectSid", "primaryGroupID", "pwdLastSet", "objectGUID"];

function getOuptutDataFromUsers(users) {
  return users
    .map((user) =>
      Object.keys(user).reduce((output, key) => {
        if (bannedKeys.includes(key)) return output;
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

function getOuptutDataFromOUs(users) {
  return users
    .map((user) =>
      Object.keys(user).reduce((output, key) => {
        if (bannedKeys.includes(key)) return output;
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

function getOuptutDataFromComputers(users) {
  return users
    .map((user) =>
      Object.keys(user).reduce((output, key) => {
        if (bannedKeys.includes(key)) return output;
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

function writeOUsToFile(ous) {
  const data = getOuptutDataFromOUs(ous);
  fs.writeFile(ldap_file, data, { encoding: "utf-8" })
    .then(() => console.log("File written with OUs"))
    .catch((err) => {
      console.error(err, "Failed to write OUs to file");
    });
}

function writeUsersToFile(users) {
  const data = getOuptutDataFromUsers(users);
  fs.appendFile(ldap_file, `\n\n${data}`, { encoding: "utf-8" })
    .then(() => console.log("File written with users"))
    .catch((err) => {
      console.error(err, "Failed to write users to file");
    });
}

function writeComputersToFile(computers) {
  const data = getOuptutDataFromUsers(computers);
  fs.appendFile(ldap_file, `\n\n${data}`, { encoding: "utf-8" })
    .then(() => console.log("File written with computers"))
    .catch((err) => {
      console.error(err, "Failed to write computers to file");
    });
}

fs.readFile(ad_file, { encoding: "latin1" })
  .then((fileData) => {
    const { users, organizationalUnits, computers, otherData } = parseDataFromRaw(fileData);
    console.log(users.length + " Users found; " + organizationalUnits.length + " OUs found; " + computers.length + " Computers found.");
    writeOUsToFile(organizationalUnits);
    writeUsersToFile(users);
    writeComputersToFile(users);

  })
  .catch((err) => {
    console.error(err, "Failed to read ad file");
  });
