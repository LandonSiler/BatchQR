import QRCode from "qrcode";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const prompt = async (query) => {
    process.stdout.write(query);
    return new Promise((resolve) =>
        process.stdin.once("data", (data) => resolve(data.toString().trim()))
    );
};

const isBatch = await prompt("Batch? (y/N): ");
const batch = isBatch.toLowerCase() === "y";
const dataSource = await prompt(batch ? "Enter the data source [json/CSV]: " : "URL: ");
const save = (await prompt("Save to file? (y/N): ")).toLowerCase() === "y";

if (batch) {
    const source = dataSource.toLowerCase();
    if (!["csv", "json"].includes(source)) {
        throw new Error("Invalid data source: " + source);
    }
    const linkToData = await prompt("Enter the link to the data: ");
    let data;
    if (linkToData.startsWith("http://") || linkToData.startsWith("https://")) {
        data = await (await fetch(linkToData)).text();
    } else {
        data = await readFileSync(linkToData, "utf-8");
    }
    if (!data) { throw new Error("No data found"); }

    let headers;

    if (source === "csv") {
        const rows = data.split("\n");
        headers = rows[0].split(",");
        const result = [];
        for (let i = 1; i < rows.length; i++) {
            const obj = {};
            const currentRow = rows[i].split(",");
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentRow[j];
            }
            result.push(obj);
        }
        data = result;
    }
    if (source === "json") {
        const result = JSON.parse(data);
        if (!Array.isArray(result)) {
            throw new Error("Invalid data. Array of objects expected.");
        }
        headers = Object.keys(result[0]);
        data = result;
    }

    if (!Array.isArray(data) || !Array.isArray(headers) || !headers.length || !data.length) {
        throw new Error("Invalid data. Array of objects expected.");
    }

    const format = await prompt("\n-------------\nEnter the format by which each batch item should uniquely modify.\n\ni.e- https://mydomain.com/$$<keyX>/$$<keyY>?$$<someOtherKey>=$$<someFinalKey>\n\nVariables are inserted: $$<key>\n\nFormat: ");
    const group = await prompt("Enter the key by which the data should be grouped []: ");
    const naming = await prompt("Enter the format which defines the naming convention for the files (use of variable keys $$<key> required): ");
    const result = {};
    const formatPresentKeys = headers.filter((key) => format.includes(`$$<${key}>`));
    const namingPresentKeys = headers.filter((key) => naming.includes(`$$<${key}>`));
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const fileName = namingPresentKeys.reduce((acc, key) => acc.replace(`$$<${key}>`, item[key]), naming);
        const qrCode = formatPresentKeys.reduce((acc, key) => acc.replace(`$$<${key}>`, item[key]), format);
        const groupName = group ? item[group] : "default";
        if (typeof result[groupName] !== "object") {
            result[groupName] = { [fileName]: qrCode };
        } else {
            result[groupName][fileName] = qrCode;
        }
    }

    if (save) {
        writeFileSync("./Out/data.json", JSON.stringify(result, null, 2));
        const folderName = (await prompt("Enter the folder name [QRCode]: ")) || "QRCode";
        for (const groupName in result) {
            if (!existsSync(`./Out/${folderName}/${groupName}`)) {
                mkdirSync(`./Out/${folderName}/${groupName}`, { recursive: true });
            }
            for (const fileName in result[groupName]) {
                await QRCode.toFile(`./Out/${folderName}/${groupName}/${fileName}.png`, result[groupName][fileName], { errorCorrectionLevel: "H" });
            }
        }

    }
} else {
    const qrCode = await QRCode.toString(dataSource, { type: "terminal", errorCorrectionLevel: "H" });
    console.log(qrCode);
    if (save) {
        const filename = await prompt("Enter the filename: ");
        await QRCode.toFile('./Out/' + filename + '.png', dataSource, { errorCorrectionLevel: "H" });
    }
}

