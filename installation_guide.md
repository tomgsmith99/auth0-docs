The Forter Auth0 plugin enables you to add Forter's Identity Protection decisions to your Auth0 sign-up and sign-in flows. The plugin takes advantage of Auth0's Actions capability.

In a sign-up/registration context, Forter will ensure that users who create accounts are trustworthy (not bots or fraudsters). Forter will issue an `approve` or `decline` decision.

In a sign-in/authentication context, Forter will recommend one of three actions:

* `approve` (allow the user to continue authenticating without further action)
* `decline` (do not allow the user to authenticate)
* `verify` (challenge the user with a 2nd factor)

These decisions work in both "traditional" user registration/login flows, as well as social registration/login flows.

### Key Components

There are two primary components that make this combination of Auth0 and Forter especially powerful:

* The Auth0 `lock.js` library allows you to include Forter's token - which represents the user context - in the Auth0 authentication flow.
* Auth0 Actions allows you to host the Forter + MFA logic in Auth0, giving you simple, direct access to the front-end user context, the Forter risk API, and the Auth0 MFA engine.

### The Overall Flow

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/flow_diagram.png)

## Prerequisites

1. An Auth0 account and tenant. [Sign up for free](https://auth0.com/signup).
2. A Forter tenant with the following APIs enabled:

    - Account Login API

    - Account Signup API

    - Account Authentication Attempt API

If you do not already have a Forter account, please contact Forter at auth0@forter.com

## Set up Forter decisioning

### Auth0 Front End

The front end of this solution uses the Auth0 hosted login/registration page, but this is not required.

In your Auth0 tenant, go to Branding->Universal Login:
![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/universal_login.png)

---

Click on "Advanced Options".
![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/advanced_options.png)

---

Click on "Login".
![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/advanced_options_login.png)

Click on "Customize Login Page" and select "lock" as the default template.

In the following HTML, copy the JavaScript snippet from [your Forter portal](https://portal.forter.com/app/developer/api/api/services-and-apis/javascript-integration) and replace the string `<!--FTR JS SNIPPET HERE-->`.

> Note: Forter provides different JavaScript snippets for Forter Sandbox environments and Forter Production environments. You should use the Forter JavaScript snippet that is appropriate for your Auth0 environment (Auth0 dev vs. Auth0 prod for example).

Copy and paste the HTML into the HTML box, and click 'Save Changes'.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  <title>My home page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
</head>
<body>

  <!--[if IE 8]>
  <script src="//cdnjs.cloudflare.com/ajax/libs/ie8/0.2.5/ie8.js"></script>
  <![endif]-->

  <!--[if lte IE 9]>
  <script src="https://cdn.auth0.com/js/base64.js"></script>
  <script src="https://cdn.auth0.com/js/es5-shim.min.js"></script>
  <![endif]-->

  <script>

    document.addEventListener('ftr:tokenReady', function(evt) {
      var ftrToken = evt.detail

      console.log(ftrToken)

      /**************************************************/
      // Auth0 js
      // Decode utf8 characters properly
      var config = JSON.parse(decodeURIComponent(escape(window.atob('@@config@@'))));
      config.extraParams = config.extraParams || {};
      var connection = config.connection;
      var prompt = config.prompt;
      var languageDictionary;
      var language;

      if (config.dict && config.dict.signin && config.dict.signin.title) {
        languageDictionary = { title: config.dict.signin.title };
      } else if (typeof config.dict === 'string') {
        language = config.dict;
      }
      var loginHint = config.extraParams.login_hint;
      var colors = config.colors || {};

      /**************************************************/
      // this line is the key addition to the Auth0 js
      config.internalOptions["ftrToken"] = ftrToken;
      /**************************************************/

      // Available Lock configuration options: https://auth0.com/docs/libraries/lock/v11/configuration
      var lock = new Auth0Lock(config.clientID, config.auth0Domain, {
        auth: {
          redirectUrl: config.callbackURL,
          responseType: (config.internalOptions || {}).response_type ||
            (config.callbackOnLocationHash ? 'token' : 'code'),
          params: config.internalOptions
        },
        configurationBaseUrl: config.clientConfigurationBaseUrl,
        overrides: {
          __tenant: config.auth0Tenant,
          __token_issuer: config.authorizationServer.issuer
        },
        assetsUrl:  config.assetsUrl,
        allowedConnections: connection ? [connection] : null,
        rememberLastLogin: !prompt,
        language: language,
        languageBaseUrl: config.languageBaseUrl,
        languageDictionary: languageDictionary,
        theme: {
          //logo:            'YOUR LOGO HERE',
          primaryColor:    colors.primary ? colors.primary : 'green'
        },
        prefill: loginHint ? { email: loginHint, username: loginHint } : null,
        closable: false,
        defaultADUsernameFromEmailPrefix: false
      });

      if(colors.page_background) {
        var css = '.auth0-lock.auth0-lock .auth0-lock-overlay { background: ' +
                    colors.page_background +
                  ' }';
        var style = document.createElement('style');

        style.appendChild(document.createTextNode(css));

        document.body.appendChild(style);
      }

      lock.show();

    })
  </script>

  <script src="https://cdn.auth0.com/js/lock/11.30/lock.min.js"></script>

  <!--FTR JS SNIPPET HERE-->

</body>
</html>
```

### Generate an Auth0 Client (Management API)

The Forter plugin will need an Auth0 client_id and client secret to perform some actions on your Auth0 tenant. These actions include:

- pulling the Auth0 logs to parse for MFA success/failure
- blocking users (optional)
    - this can be enabled/disabled in the Action code

To create a new Auth0 client for the Management API:

Applications->Applications

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/applications_home.png)

---

Click on "Create Application"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/application_definition.png)

Application name = "Forter Plugin"

Application type = "Machine to Machine Applications"

Click "Create"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/application_definition.png)

Select your management API.

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/scopes.png)

Select the following scopes:

- `update:users`
- `update:users_app_metadata`
- `read:logs`
- `read:logs_users`

Click "Authorize".

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/client_home.png)

On the home screen of the client, click "Settings".

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/client_settings.png)

Copy the client_id and client secret to use in the following installation steps.

## Add the Auth0 Action

**Note:** Once the Action is successfully deployed, all logins for your tenant will be processed by this integration. Before activating the integration in production, [install and verify this Action on a test tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants/set-up-multiple-environments).

An Auth0 Action will be triggered by a login or registration event.

It will handle the logic of:
1. Parsing the event (including the Forter token)
2. Packaging the event data and sending it to the appropriate Forter API
3. Receiving the decision from Forter
4. Reacting to the decision from Forter (initiating Auth0 MFA, for example)

To create a new action in your Auth0 tenant, go to Actions->Library:

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/action_library.png)

---
Click on "Build Custom"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/create_action_form.png)

Fill out the following fields:

Name = Forter plugin

Trigger = Login / Post Login

Click "Create"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/action_blank.png)

Copy and paste the source JavaScript (available in your Forter portal) into the action screen.

### Add the Action to your login flow

Now that you have created and deployed the Action, you can add it to your login flow.

In your Auth0 tenant, go to Actions->Flows:

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/flows.png)

Click "Login"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/login_flow.png)

Click "Custom"

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/custom_actions.png)

Select the "Forter plugin" Action, and drag it in place between the "Start" and "Complete" phases of the login flow.

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/finished_flow.png)

Click "Apply" to deploy your Action to the Flow.

## Set up MFA tracking in Forter

It's important to keep Forter updated on the outcome of MFA events (success/failure) orchestrated by Auth0.

The outcomes of these events help Forter tune the model to be ever more precise, and more specifically prevent individual users who have successfully satisfied an MFA challenge from being challenged again under similar circumstances.

To enable Forter to track these events, simply fill out the form in your portal.

Go to Settings->Auth0

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/portal_settings.png)

Fill out the fields and click Save.

## Results / Testing the flow

To test the flow, create a few test users.

Users with the following strings in their email addresses will trigger the corresponding reponse from Forter during login:

- approve
- decline
- verify

To test the users' authentication flows, click

Authentication->Authentication Profile

![](https://tomgsmith99-images.s3.amazonaws.com/forter/auth0/authentication_test.png)

Click "Try" to load the built-in Auth0 authentication app.

## Troubleshooting
