const { ChatClient } = require('@twurple/chat');
const { RefreshingAuthProvider } = require('@twurple/auth');
const fs = require('fs/promises');
const { WebSocketServer } = require('ws');
const axios = require('axios');


const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET_ID = process.env.TWITCH_CLIENT_SECRET_ID;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET_ID = process.env.GOOGLE_CLIENT_SECRET_ID;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const TWITCH_CHANNEL_TO_CONNECT = process.env.TWITCH_CHANNEL_TO_CONNECT
let youtubeAccessToken = "";

const YOUTUBE_MESSAGE_POLL_TIME = 15000;
const YOUTUBE_LIVE_POLL_TIME = 60000;

let previousPageToken = null;
let liveChatId = null;

const wss = new WebSocketServer({ port:9990 })

const connectedUsers = {};

wss.on('connection', (socket) => {
    console.log('Client connected');
    let randomNumber = Math.random()*99999999
    let id = Date.now()+" "+randomNumber;
    connectedUsers[id]=socket;

    socket.on('message', () => {
        //TODO
    });

    socket.on('close', () => {
        console.log('Client disconnected');
        delete connectedUsers[id];
    });
});

async function init(){
    initTwitch();
    initYoutube();
}

async function initTwitch(){
    const tokenData = JSON.parse(await fs.readFile('./twitchToken.json', 'utf-8'));
    const authProvider = new RefreshingAuthProvider(
        {
            clientId: TWITCH_CLIENT_ID,
            clientSecret: TWITCH_CLIENT_SECRET_ID
        }
    );
    
    authProvider.onRefresh(async (userId, newTokenData) => await fs.writeFile(`./twitchToken.json`, JSON.stringify(newTokenData, null, 4), 'utf-8'));
    
    await authProvider.addUserForToken(tokenData, ['chat']);
    
    const chatClient = new ChatClient({ authProvider, channels: [TWITCH_CHANNEL_TO_CONNECT] });
    chatClient.connect();
    
    chatClient.onMessage(async (channel, user, text, msg) => {
        for(let id in connectedUsers){
            connectedUsers[id].send(`${JSON.stringify({
                platform: "twitch",
                channel,
                user,
                text,
                displayName: msg.userInfo.displayName,
                color: msg.userInfo.color
            })}`)
        }
    });
}

const sleep = duration => new Promise(resolve => setTimeout(resolve, duration))
const poll = (promiseFn, duration) => promiseFn().then(
    sleep(duration).then(() => poll(promiseFn, duration)))

async function initYoutube(){
    youtubeAccessToken = JSON.parse(await fs.readFile('./youtubeToken.json', 'utf-8')).accessToken;
    poll(() => new Promise(() => getYoutubeLiveMessages()), YOUTUBE_MESSAGE_POLL_TIME)
    poll(() => new Promise(() => isLiveOn()), YOUTUBE_LIVE_POLL_TIME)
}



async function getYoutubeLiveMessages(){
    if(!liveChatId) return
    const URL = `https://www.googleapis.com/youtube/v3/liveChat/messages`+
    `?liveChatId=${liveChatId}`+
    `&part=snippet,authorDetails`+
    `&maxResults=2000`+
    `&key=${GOOGLE_API_KEY}`+
    `${previousPageToken ? "&pageToken="+previousPageToken : ""}`
    
    try {
        const chatMessages = await axios.get(URL)
        previousPageToken = chatMessages.data.nextPageToken;

        console.log(chatMessages)
        if(!chatMessages.data.items.length) return

        let dataToSend = {
            platform: "youtube",
            messages: []
        }

        chatMessages.data.items.forEach(element => {
            dataToSend.messages.push({
                displayName: element.authorDetails.displayName,
                text: element.snippet.displayMessage
            })
        });

        for(let id in connectedUsers){
            connectedUsers[id].send(`${JSON.stringify(dataToSend)}`)
        }
    } catch(err){
        liveChatId = null;
        return
    }
}

async function getNewAccessToken(){
    const URL = `https://www.googleapis.com/oauth2/v4/token`+
    `?client_id=${GOOGLE_CLIENT_ID}`+
    `&client_secret=${GOOGLE_CLIENT_SECRET_ID}`+
    `&refresh_token=${GOOGLE_REFRESH_TOKEN}`+
    `&grant_type=refresh_token`
    let result = await axios.post(URL)
    await fs.writeFile(`./youtubeToken.json`, JSON.stringify({accessToken: result.data.access_token}, null, 4));
    youtubeAccessToken = result.data.access_token;
}

async function isLiveOn(){
    const URL = `https://www.googleapis.com/youtube/v3/liveBroadcasts`+
    `?part=snippet,id,contentDetails`+
    `&broadcastStatus=active`

    const sentData = {
        headers: {
            'Authorization': `Bearer ${youtubeAccessToken}`
        }
    }

    try {
        const result = await axios.get(URL, sentData);
        if(result.data.items[0]) liveChatId = result.data.items[0].snippet.liveChatId;
        else liveChatId = null;
    } catch(err){
        if(err.response.statusText === "Unauthorized"){
            getNewAccessToken();
        }
        return
    }
}

init()



