import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
    USER_ADDRESS: process.env.USER_ADDRESS,
    PROXY_WALLET: process.env.PROXY_WALLET,
    PUBLIC_KEY: process.env.PUBLIC_KEY,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    CLOB_HTTP_URL: process.env.CLOB_HTTP_URL,
    CLOB_WS_URL: process.env.CLOB_WS_URL,
    FETCH_INTERVAL: parseInt(process.env.FETCH_INTERVAL || '0', 10),
    TOO_OLD_TIMESTAMP: parseInt(process.env.TOO_OLD_TIMESTAMP || '0', 10),
    RETRY_LIMIT: parseInt(process.env.RETRY_LIMIT || '0', 10),
    MONGO_URI: process.env.MONGO_URI,
    RPC_URL: process.env.RPC_URL,
};
