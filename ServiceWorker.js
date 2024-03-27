/**
 * Service Worker for the Note taking app.
 * Caches all static GET content while directly fetching the API uncached.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

self.importScripts('bootstrap.js');

/**
 * Service Worker version (should match the Seton.js version)
 */ 
const SW_VERSION = '1.0.5';

/**
 * Get list of files to cache from the bootstrapper
 */
const PRECACHE_URLS = SOURCE_LOADER.precacheUrls;

const PRECACHE = 'notes_precache-v' + SW_VERSION +'.a';

/**
 * This is used to check for updates on client request.
 */
const UPDATECHECK_SCRIPT = './ui/app/src/Notes.js';

/**
 * The install handler takes care of precaching the resources we always need.
 */
self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(PRECACHE)
		.then(cache => cache.addAll(PRECACHE_URLS))
		.then(self.skipWaiting())
	);
	
	console.log('Service worker installed');
});

/**
 * The activate handler takes care of cleaning up old caches.
 */
self.addEventListener('activate', event => {
	// After we've taken over the first time, refresh all current clients.
	self.clients.matchAll({type: 'window'})
	.then(tabs => {
		tabs.forEach((tab) => {
			tab.navigate(tab.url)
		});
	});
	
	console.log('Service worker activated');
});

/**
 * Send a message to the client
 */
self.messageToClient = function(clientId, msg) {
    if (!clientId) {
		return;
	}

    clients.get(clientId)
	.then(function(client) {
	    if (!client) return;
	    client.postMessage(msg);		
	});
}

/**
 * Check if the given file is up to date
 */
self.checkForUpdates = function(request, cache) {
	return fetch(request)
	.then(function (checkResponse) {
		return checkResponse.text();
	})
	.then(function (checkResponseText) {
		return cache.match(request.clone(), { 
			ignoreSearch: true,
			ignoreVary: true

		})
		.then(function (response2) {
			return response2.text();
		})	
		.then(function (response2Text) {
			if (response2Text !== checkResponseText) {
				return Promise.resolve({
					outOfDate: true,
					url: request.url.toString()
				});
			} else {
				return Promise.resolve({
					outOfDate: false,
					url: request.url.toString()
				});
			}
		})
	})
}

/**
 * Send a message to the UI.
 */
self.sendUserMessage = function(event, msg, type, groupId) {
	event.source.postMessage({
		requestId: 'userMessage',
		type: type,
		message: msg,
		messageGroupId: groupId
	});
}

/**
 * Listen to messages from the clients
 */
self.addEventListener("message", (event) => {
	if (event.data.requestId) {
		switch(event.data.requestId) {
			case 'getVersion': {
				event.source.postMessage({
					requestId: 'version',
					version: SW_VERSION
				});
				return;
			}
			case 'checkUpdates': {
				// Checks one script for changes and sends an out of date message to the client if so.
				var request = new Request(UPDATECHECK_SCRIPT);
				request.method = 'GET';
				
				var self_ = self;
				caches.open(PRECACHE) 
				.then(function (cache) {
					self_.checkForUpdates(request, cache)
					.then(function (checkResponse) {
						if (checkResponse.outOfDate) {
							console.log("SW: File is out of date, prompting user for update: " + checkResponse.url);
							event.source.postMessage(checkResponse);
						} else {
							if (event.data.manually) {
								self_.sendUserMessage(event, 'All sources are up to date', 'S', 'UpdateScanMessages');
							}
							//console.log("SW Version Check successful for " + checkResponse.url);
						}
					})
					.catch(function (err) {
						console.log("SW Version Check: Failed to check updates of  " + event.request.url + ", see following error:");
						console.log(err);
					});
				});
				
				return;
			}
			case 'update': {
				// Check if there is only one client connected, and if so, send a message to it to trigger the update.
				if (!event.source) {
					console.log("SW: Error: Message event did not contain a client instance, skipping this message.");
					return; 
				}
				
				var self_ = self;
				self.clients.matchAll({
					includeUncontrolled: false,
					type: 'window',
				})
				.then((clients) => {
					// Only update when we only have one client
					if (clients.length > 1) {
						self_.sendUserMessage(event, 'Please close all open windows of the app before updating and try again.', 'E');
						/*event.source.postMessage({
							requestId: 'userMessage',
							type: 'E',
							message: 'Please close all open windows of the app before updating and try again.'
						});*/
						
						return;
					}
					
					// Update request to the UI.
					event.source.postMessage({
						requestId: 'unregisterServiceWorker'
					});
				});
				
				return;
			}
		}
	} 
	
	console.log("SW: Unhandled message from client:") 
	console.log(event.data);
});

/**
 * The fetch handler serves responses for same-origin resources from a cache.
 * If no response is found, it populates the runtime cache with the response
 * from the network before returning it to the page.
 */
self.addEventListener('fetch', function (event) {
	// Always bypass for range requests, due to browser bugs
	if (event.request.headers.has('range')) return;
	
	// Deliver cached data
	event.respondWith(
		caches.open(PRECACHE) 
		.then(function (cache) {
			// API Access of any other request methods than GET: Only a direct fetch is possible
			if (!event.request.url.startsWith(self.location.origin) ||
				event.request.method.toLowerCase() != 'get') 
			{
				return fetch(event.request)
				.then(function (response) {
					return response;
				});
			}
			
			// Other assets: Check cache, and fill it if not found
			return cache.match(event.request, {
				ignoreSearch: true,
				ignoreVary: true

			}).then(function (response) {
				if (response) {
					// Found a cached file: Check server if it is still up to date (async, so the client does not have to wait).
					// This also has to read the cache again to avoid double stream consumption.
					var clone = event.request.clone();
					var self_ = self;
					var clientId = event.clientId;
					
					setTimeout(function() {
						self.checkForUpdates(clone, cache)
						.then(function (checkResponse) {
							if (checkResponse.outOfDate) {
								console.log("SW: File is out of date, prompting user for update: " + checkResponse.url);
								
								setTimeout(function() {
									self_.messageToClient(clientId, checkResponse);
								}, 3000);
							} else {
								//console.log("SW Version Check successful for " + checkResponse.url);
							}
						})
						.catch(function (err) {
							//console.log("SW Version Check: Failed to check updates of  " + event.request.url + ", see following error:");
							//console.log(err);
						});
					}, 10);
					
					return Promise.resolve(response);
				} else {
					//console.log("SW: Cache miss: " + event.request.url);
					return fetch(event.request);
				}
				
			}).then(function (response) {
				if (response) {
					return Promise.resolve(response);
				} else {
					return Promise.reject();
				}
				
			}).catch(function (err) {
				if (event.request.mode === 'navigate') {
					console.log("SW: Fetch failed: Delivering index page");
					return caches.match('./index.html')
					.then(function(response) {
						if (response) {
							return Promise.resolve(response);
						} else {
							console.log("SW: Fetch failed: Cannot deliver index page");
							return Promise.reject({ 
								message: "SW: Fetch failed: Cannot deliver index page"
							});
						}
					});
				} else {
					console.log("SW: Fetch failed: Cannot deliver " + event.request.url);
					return Promise.reject({ 
						message: "SW: Fetch failed: Cannot deliver " + event.request.url
					});
				}
			});
		})
	);
});
