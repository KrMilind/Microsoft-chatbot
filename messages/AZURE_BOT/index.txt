var restify = require('restify');
var builder = require('botbuilder');
var cognitiveservices = require('botbuilder-cognitiveservices');
var config = require('./language_en.json');
var accept = 0;
var path = require('path');
var telemetryModule = require('./telemetry-module.js');
var appInsights = require('applicationinsights');
var first = 0;
//UNCOMMENT the below code for emulator or any other channel
var botbuilder_azure = require("botbuilder-azure");
require('dotenv').load(); 

//ENV variables are checked for development mode
var useEmulator = (1==1);

//Universal Bot is configured by chatconnector to communicate either with the emulator or any other channels.

var botbuilder_azure = require("botbuilder-azure");
var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: '',
    appPassword: '',
    stateEndpoint: process.env['BotStateEndpoint'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});


if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function() {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    server.post('/api/messages', connector.listen());
} else {
    module.exports = { default: connector.listen() }
}


//initialize Bot with the connector that connects the Bot to the Bot Framework
var bot = new builder.UniversalBot(connector);
bot.localePath(path.join(__dirname, './locale'));

//Create the qna maker service
var recognizer = new cognitiveservices.QnAMakerRecognizer({
               knowledgeBaseId: '967dec77-8ba7-4802-8221-5ed37a254f3f', 
               subscriptionKey: 'c706b70c809f446182a37190b18613a7'
});

var basicQnAMakerDialog = new cognitiveservices.QnAMakerDialog({
               recognizers: [recognizer],
               defaultMessage: config.diffQuery,
               qnaThreshold: 0.3
});
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATION_KEY).setAutoDependencyCorrelation(false)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();
var client = appInsights.getClient();

bot.on('conversationUpdate', function (message,session) {
//            session.userData.first = 0;
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address,'/next');
                              
            }
        });
    }
});

bot.dialog('/next',[
    function(session)
    {
        var welcomeCard = new builder.HeroCard(session)
            .text(config.btnWelcome)
            .buttons([
                builder.CardAction.imBack(session,session.gettext(config.Welcome_accept),config.Welcome_accept)
            ]);
               accept=0;
	var telemetry = telemetryModule.createTelemetry(session, { setDefault: false });
               client.trackEvent("Prompting card for new user", {"userID" : telemetry});
               builder.Prompts.text(session,new builder.Message(session)
            .addAttachment(welcomeCard));
    },
               function(session) {
                              if(session.message.text.toLowerCase()==config.got_it) {
					     var telemetry = telemetryModule.createTelemetry(session, { setDefault: false });          
                                             client.trackEvent("User accepted card", {"userID" : telemetry});                                                
					     accept = 1;
                                             builder.Prompts.text(session, "What is it that you want me to help you with?");
                              }else {
					     var telemetry = telemetryModule.createTelemetry(session, { setDefault: false });
                                             client.trackEvent("User rejected card", {"userID" : telemetry});
                                             session.endConversation(config.Endsession);
                              }
               session.endDialog();
               }
]);

bot.dialog('/hrpmo',basicQnAMakerDialog);
bot.dialog('/',[
               function(session) {
               if(accept==1) {
			      var telemetry = telemetryModule.createTelemetry(session, { setDefault: false });
                              client.trackEvent("User asked question", {"userID" : telemetry});
                              session.beginDialog('/hrpmo'); 
               }
}]);

