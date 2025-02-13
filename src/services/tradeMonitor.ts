import moment from 'moment';
import { ENV } from '../config/env';
import { UserActivityInterface, UserPositionInterface } from '../interfaces/User';
import { getUserActivityModel, getUserPositionModel } from '../models/userHistory';
import fetchData from '../utils/fetchData';

const USER_ADDRESS = ENV.USER_ADDRESS;
const TOO_OLD_TIMESTAMP = ENV.TOO_OLD_TIMESTAMP;
const FETCH_INTERVAL = ENV.FETCH_INTERVAL;

if (!USER_ADDRESS) {
    throw new Error('USER_ADDRESS is not defined');
}

const UserActivity = getUserActivityModel(USER_ADDRESS);
const UserPosition = getUserPositionModel(USER_ADDRESS);

let temp_trades: UserActivityInterface[] = [];

const init = async () => {
    temp_trades = (await UserActivity.find().exec()).map((trade) => trade as UserActivityInterface);
};

const fetchTradeData = async () => {
    const user_positions: UserPositionInterface[] = await fetchData(
        `https://data-api.polymarket.com/positions?user=${USER_ADDRESS}`
    );
    const user_activities: UserActivityInterface[] = await fetchData(
        `https://data-api.polymarket.com/activity?user=${USER_ADDRESS}&limit=100&offset=0`
    );

    await UserPosition.deleteMany({});
    await UserPosition.insertMany(user_positions);

    try {
        const new_trades = user_activities
            .filter((activity: UserActivityInterface) => {
                return !temp_trades.some(
                    (existingActivity: UserActivityInterface) =>
                        existingActivity.transactionHash === activity.transactionHash
                );
            })
            .filter((activity: UserActivityInterface) => {
                const currentTimestamp = Math.floor(moment().valueOf() / 1000);
                return activity.timestamp + TOO_OLD_TIMESTAMP * 60 * 60 > currentTimestamp;     //Fetch user transactions only an hour before
            })
            .map((activity: UserActivityInterface) => {
                return { ...activity, bot: false, botExcutedTime: 0 };
            })
            .sort(
                (a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp
            );
        temp_trades = [...temp_trades, ...new_trades];
        await UserActivity.insertMany(new_trades);
    } catch (error) {
        console.error('Error inserting new trades:', error);
    }
};

const tradeMonitor = async () => {
    console.log('Trade Monitor is running every', FETCH_INTERVAL, 'seconds');
    await init();    //Load my oders before sever downs
    while (true) {
        await fetchTradeData();     //Fetch all user activities
        await new Promise((resolve) => setTimeout(resolve, FETCH_INTERVAL * 1000));     //Fetch user activities every second
    }
};

export default tradeMonitor;
