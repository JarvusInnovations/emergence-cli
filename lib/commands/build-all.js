var emergence = require('../emergence'),
	async = require('async');

module.exports = function buildSlateAdmin(hostname, callbackCommand) {
	var app = this,
		sites = this.config.get('sites'),
		requests = [
			{
				title: 'Compile site SASS',
				url: '/sass/compile'
			},
			{
				title: 'Build ExtJS pages',
				url: '/sencha-cmd/pages-build'
			},
			{
				title: 'Build SlateAdmin app',
				url: '/sencha-cmd/app-build?name=SlateAdmin'
			},
			{
				title: 'Build ContentEditor app',
				url: '/sencha-cmd/app-build?name=ContentEditor'
			}
		];

	if (hostname != 'all') {
		if (!sites[hostname]) {
			throw new Error('Site ' + hostname + ' not defined in config.json'); 
		}

		sites = {
			hostname: sites[hostname]
		};
	}

	async.forEachOfSeries(sites, function(siteConfig, siteHostname, callbackSite) {
		siteConfig.hostname = siteConfig.hostname || siteHostname;

		var site = new emergence.Site(siteConfig);

		app.log.info('Connecting to site %s...',  siteConfig.hostname);

		_getDeveloperSession(function() {
			async.eachSeries(requests, function(request, callbackRequest) {
				app.log.info('Executing request %s: %s', request.title, request.url);
				site.request.get({
					url: request.url,
					timeout: 5 * 60 * 1000
				}, function(error, response, body) {
					app.log.info('Finished %s:', request.title);
					app.log.verbose(body);
					callbackRequest();
				});
			}, function(error) {
				app.log.info('Finished all requests for %s.', siteConfig.hostname);
				callbackSite(error);
			});
		});




		function _getDeveloperSession(callbackSession) {
			if (siteConfig.token) {
			    // test authentication
			    site.request.get('/develop', function(error, response, body) {
			        if (response.statusCode == 200) {
			            callbackSession();
			        } else if (response.statusCode == 401) {
			            _promptLogin(function(error) {
			                if (error) {
			                    throw error;
			                }
			        
			                callbackSession();
			            });
			        } else {
			            throw new Error('Failed to connect to site, statusCode='+response.statusCode);
			        }
			    });
			} else {
			    // no token, definitely need to login
			    _promptLogin(function(error) {
			        if (error) {
			            throw error;
			        }
			
			        callbackSession();
			    });
			}
		}

		function _promptLogin(callbackLogin) {
			site.promptLogin(function(error, sessionData) {
				if (error) {
					throw error;
				}
				
				if (!sessionData || !sessionData.Handle) {
					throw 'Login failed';
				}

				siteConfig.token = sessionData.Handle;

				app.log.info('Login successful, saving token to config.json');
				app.config.save(callbackLogin);
			});
		}

		function _getProfile(callbackProfile) {
			site.request.get('/profile', function(error, response, body) {
				callbackProfile(JSON.parse(body));
			});
		}




	}, function() {
		app.log.info('Finished');
		callbackCommand();
	});
};