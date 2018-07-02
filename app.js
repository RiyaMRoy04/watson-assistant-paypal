/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var path = require('path');
var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var watson = require('watson-developer-cloud'); // watson sdk
var app = express();
var paypal = require('paypal-rest-sdk');

// Bootstrap application settings
app.use(express.static(path.join(__dirname, 'public'))); // load UI from public folder
app.use(bodyParser.json());

var conversations = [];
// Create the service wrapper

var assistant = new watson.AssistantV1({
  // If unspecified here, the ASSISTANT_USERNAME and ASSISTANT_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: process.env.ASSISTANT_USERNAME || '<username>',
  password: process.env.ASSISTANT_PASSWORD || '<password>',
  version: '2018-02-16'
});

paypal.configure({
  mode: 'sandbox', //sandbox or live
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };
  // Send the input to the assistant service
  assistant.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    updateMessage(payload, data, function (response) {
      return res.json(response);
    });
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response, callback) {
  var responseText = '';
  if (response.intents && response.intents[0] && response.intents[0].intent === 'yes') {
    paymentURL(input.context.pprice, function(id, url) {
      console.log(url, 'URL');
      conversations[id] = input;
      responseText = '<a target="_blank" href="'+ url + '">Pay Here</a>';
      response.output.text = responseText;
      callback(response);
    });
  } else {
    callback(response);
  }
}

function paymentURL(amount, callback) {
  var payReq = JSON.stringify({
    intent: 'sale',
    redirect_urls: {
      return_url: process.env.PAYPAL_REDIRECT + '/process',
      cancel_url: process.env.PAYPAL_REDIRECT + '/cancel'
    },
    payer: {
      payment_method: 'paypal'
    },
    transactions: [{
      description: 'This is the payment transaction description.',
      amount: {
        total: amount,
        currency: 'INR'
      }
    }]
  });

  paypal.payment.create(payReq, function (error, payment) {
    if (error) {
      console.dir(error.response);
      console.dir(error.response.details);
    } else {
      // Capture HATEOAS links
      var links = {};
      payment.links.forEach(function (linkObj) {
        links[linkObj.rel] = {
          href: linkObj.href,
          method: linkObj.method
        };
      });
      // If redirect url present, insert link into bot message and display

      if (links.hasOwnProperty('approval_url')) {
        var split = links['approval_url'].href.split('=');
        console.log(split, 'split');
        console.log(split[split.length - 1], 'Token');
        callback(split[split.length - 1], links['approval_url'].href);
      } else {
        console.error('no redirect URI present');
      }
    }
  });
}

app.get('/process', function (req, res) {
  // Extract payment confirmation information needed to process payment
  var paymentId = req.query.paymentId;
  var payerId = {
    payer_id: req.query.PayerID
  };

  // Attempt to complete the payment for the person
  paypal.payment.execute(paymentId, payerId, function (error, payment) {
    if (error) {
      console.error(JSON.stringify(error));
    } else {
      var payload = conversations[req.query.token];
      payload.context.paymentStatus = 'cancelled';
      if (payment.state == 'approved') {
        res.sendFile('success.html', {
          root: path.join(__dirname, 'public')
        });
        payload.context.paymentStatus = 'completed';
      } else {
        res.sendFile('cancel.html', {
          root: path.join(__dirname, 'public')
        });
      }
      assistant.message(payload, function (err, data) {
        if (err) {
          console.dir(err);
        }
        console.log(data);
      });
    }
  });
});

app.get('/cancel', function (req, res) {
  res.sendFile('cancel.html', {
    root: path.join(__dirname, 'public')
  });
  console.log(req.query.token, 'Cancel');
  var payload = conversations[req.query.token];
  payload.context.paymentStatus = 'cancelled';
  assistant.message(payload, function (err, data) {
    if (err) {
      console.dir(err);
    }
    console.log(data);
  });
});