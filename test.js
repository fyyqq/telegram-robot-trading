const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");
const input = require("input");

class TelegramBot {
    constructor(apiId, apiHash, sessionFile, groupIds, targetUsername) {
        this.apiId = apiId;
        this.apiHash = apiHash;
        this.sessionFile = sessionFile;
        this.groupIds = groupIds;
        this.targetUsername = targetUsername;
        this.processingMessages = {};

        this.sessionString = fs.existsSync(this.sessionFile) ? fs.readFileSync(this.sessionFile, "utf8") : "";
        this.session = new StringSession(this.sessionString);

        this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
            connectionRetries: 5,
        });
    }

    async start() {
        console.log("\nConnecting to Telegram...\n");

        await this.client.start({
            phoneNumber: async () => await input.text("Enter your phone number: "),
            password: async () => await input.text("Enter your password: "),
            phoneCode: async () => await input.text("Enter the code you received: "),
            onError: (err) => console.error(err),
        });

        console.log("\nConnected successfully!\n");
        fs.writeFileSync(this.sessionFile, this.client.session.save(), "utf8");

        this.setupEventHandlers();
        console.log("Waiting...\n");
    }

    setupEventHandlers() {
        this.client.addEventHandler(async (event) => {
            const message = event.message;
            if (!message) return;

            let text = message.text || message.message;
            const wordsWithLength = this.findCA(text, [43, 44]);

            const groupId = message.chatId;
            const groupName = await this.getGroupName(groupId);

            console.log(`📢 : ${groupName}`);

            let get_contract_address = wordsWithLength.filter(item => item !== "");
            if (get_contract_address.length > 0) {
                let contract_address = get_contract_address[0];
                this.processingMessages[contract_address] = true;

                try {
                    const check_balance = String(await this.getTrojanMessage('/start', this.targetUsername));

                    if (this.extractBalance(check_balance) < 15) {
                        await this.buy(contract_address);
                        console.log('Buy Successfully !');
                    } else {
                        console.log("Balance is too low to buy");
                    }

                } finally {
                    this.processingMessages[contract_address] = false;
                }
            }

            console.log("\n");
        }, new NewMessage({ chats: this.groupIds }));
    }

    findCA(text, lengths) {
        const words = text.split(/[\s\n]+/).map(word => word.replace(/[^\w\d]/g, ''));
        return words.filter(word => lengths.includes(word.length));
    }

    async getGroupName(groupId) {
        try {
            const entity = await this.client.getEntity(groupId);
            return entity.title;
        } catch (error) {
            console.error(`⚠️ Error getting group name for ${groupId}:`, error);
            return "Unknown Group";
        }
    }

    async buy(contract_address) {
        const messages = [
            '/buy',
            contract_address,
        ];

        for (const message of messages) {
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.client.sendMessage(this.targetUsername, { message });
        }
    }

    async getTrojanMessage(execute_msg, sender_username) {
        try {
            await this.client.connect();

            const sentMessage = await this.client.sendMessage(sender_username, {
                message: execute_msg
            });

            this.client.addEventHandler(async (event) => {
                const message = event.message;

                if (message.replyTo && message.replyTo.replyToMsgId === sentMessage.id) {
                    return message.text;
                }
            }, new NewMessage({}));

        } catch (err) {
            console.error('Error:', err);
        }
    }

    extractBalance(text) {
        const balanceMatch = text.match(/Balance:.*\$([0-9,]+\.?[0-9]*)/);

        if (balanceMatch) {
            const valueStr = balanceMatch[1];
            const value = parseFloat(valueStr.replace(/,/g, ''));
            return value;
        }
        return 0;
    }
}

// Konfigurasi
const apiId = 24056374;
const apiHash = "bf2f41a633a86d8e7519e1391abf4159";
const SESSION_FILE = "session.txt";
const GROUP_ID = [-1002225558516, -1002085434351];
const TARGET_USERNAME = '@solana_trojanbot';

// Inisialisasi dan jalankan bot
const bot = new TelegramBot(apiId, apiHash, SESSION_FILE, GROUP_ID, TARGET_USERNAME);
bot.start();