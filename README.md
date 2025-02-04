# Polymarket Copy Trading Bot

## Introduction
This project is a Polymarket Copy Trading Bot that allows users to automatically copy trades from a selected trader on Polymarket.

## Features
- **Automated Trading**: Automatically copy trades from a selected trader.
- **Real-time Monitoring**: Continuously monitor the selected trader's activity.
- **Customizable Settings**: Configure trading parameters and risk management.

## Installation
1. Install latest version of Node.js and npm
2. Navigate to the project directory:
    ```bash
    cd polymarket_copy_trading_bot
    ```
3. Create `.env` file:
    ```bash
    touch .env
    ```
4. Configure env variables:
    ```typescript
    USER_ADDRESS = 'Selected account wallet address to copy'

    PROXY_WALLET = 'My account wallet address'
    PRIVATE_KEY = 'My wallet private key'

    CLOB_HTTP_URL = 'https://clob.polymarket.com/'
    CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws'

    FETCH_INTERVAL = 1      // default is 1 second
    TOO_OLD_TIMESTAMP = 1   // default is 1 hour
    RETRY_LIMIT = 3         // default is 3 times

    MONGO_URI = your mongodb uri

    RPC_URL = 'https://polygon-mainnet.infura.io/v3/44f4eda3379a4713b7e17692666174c7'

    USDC_CONTRACT_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    ```
3. Install the required dependencies:
    ```bash
    npm install
    ```
5. Build the project:
    ```bash
    npm run build
    ```
6. Run BOT:
    ```bash
    npm run start
    ```

