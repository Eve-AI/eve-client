//  __   __  ___        ___
// |__) /  \  |  |__/ |  |  
// |__) \__/  |  |  \ |  |  

// This is the main file for the Eve bot.

// Import Leon Client
import request from 'superagent'
import regeneratorRuntime from "regenerator-runtime";
import io from 'socket.io-client';

// Import Botkit's core features
const { Botkit, BotkitConversation } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

// Import a platform-specific adapter for facebook.
const { FacebookAdapter, FacebookEventTypeMiddleware } = require('botbuilder-adapter-facebook');
const { MongoDbStorage } = require('botbuilder-storage-mongodb');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
  storage = mongoStorage = new MongoDbStorage({
    url: process.env.MONGO_URI,
  });
}


const adapter = new FacebookAdapter({

  // REMOVE THIS OPTION AFTER YOU HAVE CONFIGURED YOUR APP!
  // enable_incomplete: true,

  verify_token: process.env.FACEBOOK_VERIFY_TOKEN,
  access_token: process.env.FACEBOOK_ACCESS_TOKEN,
  app_secret: process.env.FACEBOOK_APP_SECRET,
})

// emit events based on the type of facebook event being received
adapter.use(new FacebookEventTypeMiddleware());


const controller = new Botkit({
  webhook_uri: '/api/messages',
  adapter: adapter,
  storage
});

if (process.env.CMS_URI) {
  controller.usePlugin(new BotkitCMSHelper({
    uri: process.env.CMS_URI,
    token: process.env.CMS_TOKEN,
  }));
}

// LEON

const config = {
  app: 'botkit', // TODO
  server_host: process.env.LEON_HOST,
  server_port: process.env.LEON_PORT,
  min_decibels: -40, // Noise detection sensitivity
  max_blank_time: 1000 // Maximum time to consider a blank (ms)
}
const serverUrl = process.env.LEON_NODE_ENV === 'production' ? '' : `${config.server_host}:${config.server_port}`


request.get(`${serverUrl}/v1/info`)
  .end((err, res) => {
    if (err || !res.ok) {
      console.error(err)
    }
  })

// Init leon socket
const socket = io.connect(serverUrl)

socket.on('connect', () => {
  socket.emit('init', {})
})

let reference = null
let recipientId = null
let senderId = null
socket.on('answer', async (data) => {
  console.info("Eve:", data)
   let bot = await controller.spawn(senderId);
   await bot.startConversationWithUser(recipientId);
   await bot.changeContext(reference);
   await bot.say(data);
})

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {
  // load traditional developer-created local custom feature modules
  controller.on('message,direct_message', async (bot, message) => {
    reference = message.reference
    recipientId = message.recipient.id
    senderId = message.sender.id
    console.info('P:', message.text)
    if(message.text){
      socket.emit('query', { client: {}, value: message.text.trim() })
    }
  });

  /* catch-all that uses the CMS to trigger dialogs */
  if (controller.plugins.cms) {
    controller.on('message,direct_message', async (bot, message) => {
      let results = false;
      results = await controller.plugins.cms.testTrigger(bot, message);

      if (results !== false) {
        // do not continue middleware!
        return false;
      }
    });
  }
});



controller.webserver.get('/', (req, res) => {
  res.send(`This app is running Botkit ${controller.version}.`);
});





