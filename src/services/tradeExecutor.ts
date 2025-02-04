import { ClobClient } from '@polymarket/clob-client';
import { OrderType, Side } from '@polymarket/clob-client';
import { UserActivityInterface, UserPositionInterface } from '../interfaces/User';
import { ENV } from '../config/env';
import { getUserActivityModel } from '../models/userHistory';
import fetchData from '../utils/fetchData';
import spinner from '../utils/spinner';
import getMyBalance from '../utils/getMyBalance';

const USER_ADDRESS = ENV.USER_ADDRESS;
const RETRY_LIMIT = ENV.RETRY_LIMIT;
const PROXY_WALLET = ENV.PROXY_WALLET;

let temp_trades: UserActivityInterface[] = [];

const UserActivity = getUserActivityModel(USER_ADDRESS);

const readTempTrade = async () => {
    temp_trades = (
        await UserActivity.find({
            $and: [{ type: 'TRADE' }, { bot: false }, { botExcutedTime: { $lt: RETRY_LIMIT } }],
        }).exec()
    ).map((trade) => trade as UserActivityInterface);
};

const doTrading = async (clobClient: ClobClient) => {
    for (const trade of temp_trades) {
        console.log('Trade to copy:', trade);
        // const market = await clobClient.getMarket(trade.conditionId);
        // console.log(market);
        const tokenID = trade.asset;
        const conditionId = trade.conditionId;
        const my_positions: UserPositionInterface[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${PROXY_WALLET}`
        );
        const user_positions: UserPositionInterface[] = await fetchData(
            `https://data-api.polymarket.com/positions?user=${USER_ADDRESS}`
        );
        const my_position = my_positions.find(
            (position: UserPositionInterface) => position.conditionId === conditionId
        );
        const user_position = user_positions.find(
            (position: UserPositionInterface) => position.conditionId === conditionId
        );
        const side = trade.side as Side;
        const share_balance = my_position ? my_position.size : 0;
        const my_balance = await getMyBalance();
        console.log('My current balance:', my_balance);
        const size = trade.size;
        let order_args;
        if (side === 'BUY') {
            if (user_position && user_position.outcome !== trade.outcome) {
                if (!my_position) {
                    console.log('Outcome mismatch');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    continue;
                } else {
                    console.log('Outcome mismatch, selling');
                    const oprice = (await clobClient.getLastTradePrice(my_position.asset)).price;
                    order_args = {
                        side: Side.SELL,
                        tokenID: my_position.asset,
                        size: share_balance,
                        price: oprice,
                    };
                    console.log(order_args);
                }
            } else {
                const price = (await clobClient.getLastTradePrice(tokenID)).price;
                if (price > 0.99) {
                    console.log('Price too high');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    continue;
                }
                if (Math.abs(price - trade.price) > 0.1) {
                    console.log('Price too different');
                    await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                    continue;
                }
                order_args = {
                    side: Side.BUY,
                    tokenID,
                    size: 5,
                    price,
                };
            }
        } else if (side === 'SELL') {
            if (share_balance === 0) {
                console.log('No balance to sell');
                await UserActivity.updateOne({ _id: trade._id }, { bot: true });
                continue;
            } else if (share_balance < size) {
                const price = (await clobClient.getLastTradePrice(tokenID)).price;
                order_args = {
                    side: Side.SELL,
                    tokenID,
                    size: share_balance,
                    price,
                };
            } else {
                const price = (await clobClient.getLastTradePrice(tokenID)).price;
                order_args = {
                    side: Side.SELL,
                    tokenID,
                    size,
                    price,
                };
            }
        } else {
            console.log('Transaction type not supported');
            await UserActivity.updateOne({ _id: trade._id }, { bot: true });
            continue;
        }
        const signedOrder = await clobClient.createOrder(order_args);
        const resp = await clobClient.postOrder(signedOrder, OrderType.GTC);
        if (resp.success) {
            console.log('Successfully copied trade:', resp);
            await UserActivity.updateOne(
                { _id: trade._id },
                { bot: true, botExcutedTime: trade.botExcutedTime + 1 }
            );
        } else {
            console.log('Failed to trade:', resp, 'retrying...');
            await UserActivity.updateOne(
                { _id: trade._id },
                { botExcutedTime: trade.botExcutedTime + 1 }
            );
        }
    }
};

const tradeExcutor = async (clobClient: ClobClient) => {
    console.log(`Executing Copy Trading`);

    while (true) {
        await readTempTrade();
        if (temp_trades.length > 0) {
            spinner.stop();
            console.log('💥 New transactions found 💥');
            await doTrading(clobClient);
        } else {
            spinner.start('Waiting for new transactions');
        }
    }
};

export default tradeExcutor;
