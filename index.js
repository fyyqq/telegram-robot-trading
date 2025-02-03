const { Database } = require('./database');

require('dotenv').config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const input = require("input");

const env = process.env;
const apiId = Number(env.TELEGRAM_API_ID);
const apiHash = env.TELEGRAM_API_HASH;
const SESSION_FILE = "session.txt";
const GROUP_ID = [env.TELEGRAM_GROUP_ID_MEOW, env.TELEGRAM_GROUP_ID_PFINSIDER, env.TELEGRAM_GROUP_ID_GCAT, -4771944161];
const TARGET_USERNAME = env.TELEGRAM_TROJAN_UN;

let processingMessages = {};

let sessionString = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, "utf8") : "";
const session = new StringSession(sessionString);

const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
});

(async () => {
    console.log("\nConnecting to Telegram...\n");

    await client.start({
        phoneNumber: async () => await input.text("Enter your phone number: "),
        password: async () => await input.text("Enter your password: "),
        phoneCode: async () => await input.text("Enter the code you received: "),
        onError: (err) => console.error(err),
    });

    // console.log("\nConnected successfully!\n");
    // fs.writeFileSync(SESSION_FILE, client.session.save(), "utf8");

    // const messages = await client.getMessages(GROUP_ID, { limit: 5 });
    // console.log("📩 Latest messages:", messages.map((m) => m.text || m.message));

    client.addEventHandler(async (event) => {

        const message = event.message;
        if (!message) return;

        let text = message.text || message.message;
        const wordsWithLength = findCA(text, [43, 44]);

        const groupId = message.chatId;
        const groupName = await getGroupName(groupId);

        console.log(`📢 : ${groupName}`);

        let get_contract_address = wordsWithLength.filter(item => item !== "");
        if (get_contract_address.length > 0) {
            let contract_address = get_contract_address[0];
            processingMessages[contract_address] = true;

            try {
                const check_balance = String(await getTrojanMessage('/start', TARGET_USERNAME, client));
                if (await extractBalance(check_balance) > 15) {

                    (async () => {
                        const check_existing_trade_db = await Database.findExistingTrade(contract_address);

                        if (check_existing_trade_db[0]) {

                            const [ solMatch, emojiMatch, emojiMatchCheckFailure ] = await buyExecution(contract_address, TARGET_USERNAME);

                            try {
                                const amount_buy = solMatch[0].split(" ").at(-1).replace(/[()]/g, "");
                                
                                if (emojiMatchCheckFailure == null && emojiMatch) {
                                    const check_buy_confirmation = await Database.insertNewTrade(contract_address, '1', amount_buy, '1', groupId.toString());
                                    if (check_buy_confirmation[0]) {
                                        console.log(check_buy_confirmation[1]);
                                    } else {
                                        console.error(check_buy_confirmation[1]);
                                    }
                                } else {
                                    console.error("🔴 Buy Failed: Slippage Or Insufficient Balance for Gas Fee");
                                }
                            } catch (err) {
                                console.error("🔴 Buy Failed: Slippage Or Insufficient Balance for Gas Fee");
                            }
                            
                        } else {
                            console.error(`🔴 Already Bought: ${contract_address}`);
                            return;
                        }
                    })();
                } else {
                    console.log("Balance is too low to buy");
                }

            } finally {
                processingMessages[contract_address] = false;
            }
        }

        console.log("\n");
        
    }, new NewMessage({ chats: GROUP_ID }));

    console.log("Waiting...\n");
})();

function findCA(text, lengths) {
    const words = text.split(/[\s\n]+/).map(word => word.replace(/[^\w\d]/g, ''));
    return words.filter(word => lengths.includes(word.length));
}

async function getGroupName(groupId) {
    try {
        const entity = await client.getEntity(groupId);
        return entity.title;
    } catch (error) {
        console.error(`⚠️ Error getting group name for ${groupId}:`, error);
        return "Unknown Group";
    }
}

async function getTrojanMessage(execute_msg, sender_username, client) {
    try {

        await client.connect();

        const username = sender_username;

        const sentMessage = await client.sendMessage(username, {
            message: execute_msg
        });

        const response = await new Promise(resolve => {
            client.addEventHandler(async (event) => {
                const message = event.message;
                if (message.replyTo && message.replyTo.replyToMsgId === sentMessage.id) {
                    resolve(message.text);
                }
            }, new NewMessage({}));
        });

        return response;

    } catch (err) {
        console.error('Error:', err);
    }
}

// On Maintenance
async function buyExecution(contract_address, TARGET_USERNAME) {
    await client.sendMessage(TARGET_USERNAME, { message: "/buy" });
    await new Promise(resolve => setTimeout(resolve, 500));

    await client.sendMessage(TARGET_USERNAME, { message: contract_address });

    await new Promise(resolve => setTimeout(resolve, 7000));
    const msg = await client.getMessages(TARGET_USERNAME, { limit: 1 });
    const msg_result = msg[0].message;

    let solMatch = msg_result.match(/(\d+\.\d+ SOL \(\$\d+\.\d+\))/);
    solMatch ? solMatch[0].split(' ').slice(-1)[0].replace(/[()]/g, '') : "";

    let emojiMatch = msg_result.match(/🟢/);
    let emojiMatchCheckFailure = msg_result.match(/🔴/);
    emojiMatch ? true : false

    return [solMatch, emojiMatch, emojiMatchCheckFailure];
}


async function extractBalance(text) {
    const balanceMatch = text.match(/Balance:.*\$([0-9,]+\.?[0-9]*)/);
    
    if (balanceMatch) {
        const valueStr = balanceMatch[1];
        const value = parseFloat(valueStr.replace(/,/g, ''));
        return value;
    }
    return 0;
}