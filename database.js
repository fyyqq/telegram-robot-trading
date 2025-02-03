require('dotenv').config();
const mysql = require('mysql2/promise');

class Database {
    static connection = null;
    static table = "trade_history";

    // Static connect method
    static async connect() {
        try {
            if (this.connection) return this.connection;
            this.connection = await mysql.createConnection({
                host: process.env.DB_SERVER_NAME,
                user: process.env.DB_USER_NAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
            return this.connection;
        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.connection = null;
            return null;
        }
    }

    static async findExistingTrade(contract_address, user_id = '1') {
        const connection = await this.connect();
        if (!connection) return [false, "Failed to connect to the database"];

        try {
            const query = `SELECT * FROM ${this.table} WHERE contract_address = ? AND user_id = ?`;
            const [rows] = await connection.execute(query, [contract_address, user_id]);

            if (rows.length > 0) {
                return [false, `🔴 Already bought!`];
            } else {
                return [true, `🟢 No existing buy!`];
            }
        } catch (error) {
            return [false, `❌ Query Error: ${error}`];
        }
    }

    static async insertNewTrade(contract_address, user_id, amount, buy_count, group_id) {
        const connection = await Database.connect(); // Static method can be used here
        if (!connection) return;
        
        try {
            const query = `INSERT INTO ${this.table} (contract_address, user_id, buy_amount, buy_count, group_id) VALUES (?, ?, ?, ?, ?)`;
            await connection.execute(query, [contract_address, user_id, amount, buy_count, group_id]);

            return [true, `🟢 Buy successfully! \nCA: ${contract_address}`];
        } catch (error) {
            return [false, `❌ Query Error: ${error}`];
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
        }
    }
}

module.exports = { Database };
