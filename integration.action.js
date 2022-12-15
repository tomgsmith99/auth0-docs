const axios = require("axios");
// Later-on we can move those to np,
const ENUMS = {
	CORRELATIONS_ID_KEY: "forterCorrelationIds",
	LOGIN_STATUS: {
		SUCCESS: "SUCCESS"
	},
	FORTER_DECISION: {
		DECLINE: "DECLINE",
		APPROVE: "APPROVE",
		VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED"
	},
	HEADERS_NAMES: {
		CONTENT_TYPE: "Content-Type",
		AUTHORIZATION: "Authorization",
		FORTER_API_VERSION: "api-version",
		FORTER_CLIENT: "x-forter-client"
	},
	HEADERS_VALUES: {
		APP_JSON: "application/json",
		AUTH0: "auth0"
	},
	HTTP_METHODS: {
		POST: "post",
		PATCH: "patch"
	},
	MESSAGES: {
		DEFAULTS: {
			ACCESS_DENY: "sorry, something went wrong."
		}
	},
	GRANT_TYPES: {
		CLIENT_CREDENTIALS: "client_credentials"
	},
	MOCK_IPS: {
		APPROVED: "0.0.0.1",
		DECLINE: "0.0.0.2",
		MFA: "0.0.0.4"
	},
	EVENT_TYPES: {
		SIGN_IN: "login",
		SIGN_UP: "signup"
	},
	LOGIN_TYPES: {
		SOCIAL: "SOCIAL",
		PASSWORD: "PASSWORD"
	}
};

/**
 * Auth0 API Client
 */
class Auth0Client {
	constructor({ AUTH0_TENANT, AUTH0_CLIENT_SECRET, AUTH0_CLIENT_ID }) {
		this.AUTH0_TENANT = AUTH0_TENANT;
		this.AUTH0_CLIENT_SECRET = AUTH0_CLIENT_SECRET;
		this.AUTH0_CLIENT_ID = AUTH0_CLIENT_ID;
	}

	/**
	 * Get the access token from auth0
	 * @returns {Promise<*>}
	 */
	async getAccessToken() {
		const data = JSON.stringify({
			client_id: this.AUTH0_CLIENT_ID,
			client_secret: this.AUTH0_CLIENT_SECRET,
			audience: `${this.AUTH0_TENANT}/api/v2/`,
			grant_type: ENUMS.GRANT_TYPES.CLIENT_CREDENTIALS
		});
		const {
			data: { access_token: accessToken }
		} = await axios.request({
			method: ENUMS.HTTP_METHODS.POST,
			url: `${this.AUTH0_TENANT}/oauth/token`,
			headers: {
				[ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
			},
			data
		});
		return accessToken;
	}

	/**
	 * Block user access given an accessToken and the accountId
	 * @param accountId
	 * @param accessToken
	 * @returns {Promise<*>}
	 */
	async blockedAccess({ accountId, accessToken }) {
		const data = JSON.stringify({
			blocked: true
		});
		return await axios.request({
			method: ENUMS.HTTP_METHODS.PATCH,
			url: `${this.AUTH0_TENANT}/api/v2/users/${accountId}`,
			headers: {
				[ENUMS.HEADERS_NAMES.AUTHORIZATION]: `Bearer  ${accessToken}`,
				[ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON
			},
			data
		});
	}
}

/**
 * Forter API Client
 */
class ForterClient {
	constructor({ FORTER_API_VERSION, FORTER_SITE_ID, FORTER_KEY }) {
		this.FORTER_API_VERSION = FORTER_API_VERSION;
		this.forterBaseUrl = `https://${FORTER_SITE_ID}.api.forter-secure.com/v2/accounts`;
		this.auth = {
			username: FORTER_KEY
		};
	}

	/**
	 * Get Forter Decision for Sing Up event
	 * @param accountId
	 * @param userAgent
	 * @param forterTokenCookie
	 * @param customerIP
	 * @param email
	 * @param eventTime
	 * @returns forterDecision
	 */
	async getSignUpDecision({
		accountId,
		userAgent,
		forterTokenCookie,
		customerIP,
		email,
		eventTime
	}) {
		const data = JSON.stringify({
			accountId,
			connectionInformation: {
				customerIP,
				userAgent,
				forterTokenCookie
			},
			userInput: {
				email,
				inputType: "EMAIL"
			},
			eventTime
		});

		const {
			data: { forterDecision }
		} = await axios.request({
			url: `${this.forterBaseUrl}/${ENUMS.EVENT_TYPES.SIGN_UP}/${accountId}`,
			method: ENUMS.HTTP_METHODS.POST,
			auth: this.auth,
			headers: {
				[ENUMS.HEADERS_NAMES.FORTER_API_VERSION]: `${this.FORTER_API_VERSION}`,
				[ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON,
				[ENUMS.HEADERS_NAMES.FORTER_CLIENT]: ENUMS.HEADERS_VALUES.AUTH0
			},
			data
		});
		return forterDecision;
	}

	/**
	 * Get Forter Decision for Sing In event
	 * @param accountId
	 * @param userAgent
	 * @param forterTokenCookie
	 * @param customerIP
	 * @param email
	 * @param loginMethodType
	 * @param eventTime
	 * @returns forterDecision
	 */
	async getSignInDecision({
		accountId,
		userAgent,
		forterTokenCookie,
		customerIP,
		email,
		loginMethodType,
		eventTime
	}) {
		const data = JSON.stringify({
			accountId,
			loginStatus: ENUMS.LOGIN_STATUS.SUCCESS,
			loginMethodType,
			connectionInformation: {
				customerIP,
				userAgent,
				forterTokenCookie
			},
			userInput: {
				email,
				inputType: "EMAIL"
			},
			eventTime
		});

		const {
			data: { forterDecision, correlationId }
		} = await axios.request({
			url: `${this.forterBaseUrl}/${ENUMS.EVENT_TYPES.SIGN_IN}/${accountId}`,
			method: ENUMS.HTTP_METHODS.POST,
			auth: this.auth,
			headers: {
				[ENUMS.HEADERS_NAMES.FORTER_API_VERSION]: `${this.FORTER_API_VERSION}`,
				[ENUMS.HEADERS_NAMES.CONTENT_TYPE]: ENUMS.HEADERS_VALUES.APP_JSON,
				[ENUMS.HEADERS_NAMES.FORTER_CLIENT]: ENUMS.HEADERS_VALUES.AUTH0
			},
			data
		});
		return { forterDecision, correlationId };
	}

	/**
	 * Return true if this is the first time we see this user
	 * @param event
	 * @returns {boolean}
	 */
	static isFirstEvent(event) {
		return event?.stats?.logins_count === 1;
	}

	/**
	 * Get the Login Method used by the event
	 * @param event
	 * @returns {string|string}
	 */
	static getLoginMethodTypeFromEvent(event) {
		if (Array.isArray(event?.authentication?.methods)) {
			return event?.authentication?.methods[0]?.name === "federated"
				? ENUMS.LOGIN_TYPES.SOCIAL
				: ENUMS.LOGIN_TYPES.PASSWORD;
		}
		return ENUMS.LOGIN_TYPES.PASSWORD; // fallback
	}

	/**
	 * Mock Forter Response Based on email in test mode
	 * @param realIp
	 * @param email
	 * @returns {string|*}
	 */
	static overrideIpByEmail(realIp, email) {
		if (typeof email === "string") {
			if (email?.includes("approve")) {
				return ENUMS.MOCK_IPS.APPROVED;
			}
			if (email?.includes("decline")) {
				return ENUMS.MOCK_IPS.DECLINE;
			}
			if (email?.includes("verify")) {
				return ENUMS.MOCK_IPS.MFA;
			}
		}
		return realIp;
	}
}

const NUM_OF_CORRELATION_ID_TO_STORE = 3;

/**
 * Append another correlationId and store last 3 on the auth0 app_metadata
 * We will fetch those on Forter side to match the ID on the authentication-result API
 * @param event
 * @param api
 * @param eventTime
 * @param correlationId
 */
function storeCorrelationId({ event, api, eventTime, correlationId }) {
	// Data is kept as string
	// As those strings are small this should not be CPU intensive
	const prevCorrelationsIds = JSON.parse(
		event?.user?.app_metadata?.[ENUMS.CORRELATIONS_ID_KEY] || "[]"
	);
	const correlations = [...prevCorrelationsIds, { eventTime, correlationId }]
		.sort((a, b) => (a.eventTime > b.eventTime ? -1 : 1))
		.slice(0, NUM_OF_CORRELATION_ID_TO_STORE);
	// As those strings are small this should not be CPU intensive
	api.user.setAppMetadata(ENUMS.CORRELATIONS_ID_KEY, JSON.stringify(correlations));
}

/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 *
 * Requires Secrets:
 * ---- Auth0 ----
 * AUTH0_TENANT (optional): Auth0 Tenant Domain - Relevant only if we want to block user access on forter decline
 * AUTH0_CLIENT_SECRET (optional): Auth0 client secret - Relevant only if we want to block user access on forter decline
 * AUTH0_CLIENT_ID (optional): Auth0 client ID - Relevant only if we want to block user access on forter decline
 * ---- Forter ----
 * FORTER_API_VERSION (required): Forter API Version, used in 'api-version' - Can be found on https://portal.forter.com/app/developer/api/api/general/security-and-authentication
 * FORTER_SITE_ID (required): Forter Site ID, used in 'x-forter-siteid' header - Can be found on https://portal.forter.com/app/developer/api/api/general/security-and-authentication
 * FORTER_KEY (required): Forter API Key, used in 'authorization' - Can be found on https://portal.forter.com/app/developer/api/api/general/security-and-authentication
 * --- Other Config ---
 * TEST_MODE (optional): If true - ips will be override by Forter logic to simulate APPROVE/DECLINE/VERIFICATION_REQUIRED based on the email (see ovveridIpByEmail)
 * ACCESS_DENY_MESSAGE (optional): Custom error message in case of access dey
 * FORTER_DECISION_FALLBACK (optional): Fallback behavior in case of error in the flow: APPROVE/DECLINE/VERIFICATION_REQUIRED
 * BLOCK_USER_ON_DECLINE (optional): If 'true' -> a declined user will be blocked on auth0 backend
 *
 */
const onExecutePostLogin = async (event, api) => {
	const accessDenyMessage =
		event?.secrets?.ACCESS_DENY_MESSAGE || ENUMS.MESSAGES.DEFAULTS.ACCESS_DENY;
	const isTestMode = event?.secrets?.TEST_MODE === "true";
	try {
		const { user_id, email } = event?.user;
		const {
			customerIP: ip,
			user_agent: userAgent,
			query: { ftrToken: forterTokenCookie }
		} = event?.request;
		const forterClient = new ForterClient(event?.secrets);
		const auth0Client = new Auth0Client(event?.secrets);
		const accountId = user_id;
		const customerIP = isTestMode ? ForterClient.overrideIpByEmail(ip, email) : ip;
		const eventTime = Date.now();

		if (ForterClient.isFirstEvent(event)) {
			// Sign up
			const forterDecision = await forterClient.getSignUpDecision({
				accountId,
				userAgent,
				forterTokenCookie,
				customerIP,
				email,
				eventTime
			});
			if (forterDecision === ENUMS.FORTER_DECISION.DECLINE) {
				if (event?.secrets?.BLOCK_USER_ON_DECLINE === "true") {
					const accessToken = await auth0Client.getAccessToken();
					await auth0Client.blockedAccess({ accountId, accessToken });
				}
				api.access.deny(accessDenyMessage);
			}
			// Otherwise -> continue
		} else {
			const loginMethodType = ForterClient.getLoginMethodTypeFromEvent(event);
			// Sing In
			const {
				forterDecision,
				correlationId
			} = await forterClient.getSignInDecision({
				accountId,
				userAgent,
				forterTokenCookie,
				loginMethodType,
				customerIP,
				email,
				eventTime
			});
			// Decline
			if (forterDecision === ENUMS.FORTER_DECISION.DECLINE) {
				api.access.deny(accessDenyMessage);
			}
			// MFA
			if (forterDecision === ENUMS.FORTER_DECISION.VERIFICATION_REQUIRED) {
				storeCorrelationId({ api, eventTime, event, correlationId });
				api.multifactor.enable("any");
			}
			// Otherwise -> Approve, continue as usual
		}
	} catch (e) {
		// Fallback
		const fallback = event?.secrets?.FORTER_DECISION_FALLBACK;
		if (fallback) {
			if (fallback === ENUMS.FORTER_DECISION.DECLINE) {
				api.access.deny(accessDenyMessage);
				return;
			}
			if (fallback === ENUMS.FORTER_DECISION.APPROVE) {
				// Do nothing
				return;
			}
		}
		// No Fallback configured will result with MFA
		api.multifactor.enable("any");
	}
};

// For testing
exports.ForterClient = ForterClient;
exports.Auth0Client = Auth0Client;
exports.ENUMS = ENUMS;
// Exports for auth0
exports.onExecutePostLogin = onExecutePostLogin;