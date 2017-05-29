// For more information about this template visit http://aka.ms/azurebots-node-qnamaker



"use strict";

var builder = require("botbuilder");

var botbuilder_azure = require("botbuilder-azure");

var builder_cognitiveservices = require("botbuilder-cognitiveservices");

var path = require('path');

var telemetryModule = require('./telemetry-module.js');

var appInsights = require('applicationinsights');

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({

    appId: process.env['MicrosoftAppId'],

    appPassword: process.env['MicrosoftAppPassword'],

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

var bot = new builder.UniversalBot(connector);

bot.localePath(path.join(__dirname, './locale'));



var recognizer = new builder_cognitiveservices.QnAMakerRecognizer({

                knowledgeBaseId: process.env.QnAKnowledgebaseId, 

    subscriptionKey: process.env.QnASubscriptionKey});



var basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({

    recognizers: [recognizer],

                defaultMessage: 'No match! Try changing the query terms!',

                qnaThreshold: 0.3}

);


appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATION_KEY).setAutoDependencyCorrelation(false)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();

var client = appInsights.getClient();


bot.dialog('/', [
	function(session) {
		session.send("Thanks for starting a conversation");
		client.trackEvent("my custom event", {customProperty: "custom property value"});
		client.trackException(new Error("handled exceptions can be logged with this method"));
		client.trackMetric("custom metric", 3);
		client.trackTrace("trace message");
		builder.Prompts.text(session,"enter your question");
	},
	function(session) {
		session.beginDialog('/qna');
	}
]);

bot.dialog('/qna', basicQnAMakerDialog);


bot.on('conversationUpdate',function(session) {

    var telemetry = telemetryModule.createTelemetry(session, { setDefault: false });

    client.trackTrace('start', telemetry);

});

