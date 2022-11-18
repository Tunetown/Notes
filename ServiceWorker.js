/**
 * Service Worker for the Note taking app, if using the Proxy to CouchDB.
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

// Names of the two caches used in this version of the service worker.
// Change to v2, etc. when you update any of the local resources, which will
// in turn trigger the install event again.
const PRECACHE = 'notes_precache-v0.96.12.a';

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',

  './ui/lib/selectize/selectize.bootstrap3.min.css',
  './ui/lib/selectize/selectize.min.js',
  './ui/lib/jquery.color-2.1.2.min.js',

  './ui/lib/bootstrap/bootstrap.min.css',
  './ui/lib/fa/css/all.min.css',

  './ui/lib/switch/switch.css',
  './ui/lib/switch/switch.js',
  './ui/lib/codemirror/lib/codemirror.css',
  './ui/lib/codemirror/addon/hint/show-hint.css',
  './ui/lib/neo4j/css/neo4jd3.css',
  
  './ui/app/css/Notes.css',
  './ui/app/css/Header.css',
  './ui/app/css/NoteTree.css',
  './ui/app/css/TreeBehaviour.css',
  './ui/app/css/TileBehaviour.css',
  './ui/app/css/DetailBehaviour.css',
  './ui/app/css/ReferenceBehaviour.css',
  './ui/app/css/Misc.css',
  './ui/app/css/Board.css',
  './ui/app/css/Editor.css',

  './ui/lib/jquery-min.js',
  './ui/lib/bootstrap/bootstrap.min.js',     
  './ui/lib/tinymce/tinymce.min.js',
  './ui/lib/muuri/muuri.min.js',
  './ui/lib/pouchdb/pouchdb.min.js',
  './ui/lib/pouchdb/pouchdb.find.min.js',
  './ui/lib/pouchdb/pouchdb.authentication.min.js',
  './ui/lib/FileSaver/FileSaver.min.js',
  './ui/lib/showdown/showdown.min.js',
  './ui/lib/jsdiff.min.js',
  './ui/lib/sammy-latest.min.js',
  './ui/lib/client-zip.js',
  './ui/lib/neo4j/js/neo4jd3.js',
  './ui/lib/neo4j/js/d3.min.js',
  /*'./ui/lib/md5.min.js',*/
  
  './ui/lib/codemirror/lib/codemirror.js',
  './ui/lib/codemirror/mode/markdown/markdown.js',
  './ui/lib/codemirror/mode/javascript/javascript.js',
  './ui/lib/codemirror/mode/clike/clike.js',
  './ui/lib/codemirror/mode/css/css.js',
  './ui/lib/codemirror/mode/xml/xml.js',
  './ui/lib/codemirror/mode/php/php.js',
  './ui/lib/codemirror/mode/python/python.js',
  './ui/lib/codemirror/mode/ruby/ruby.js',
  './ui/lib/codemirror/mode/shell/shell.js',
  './ui/lib/codemirror/mode/sql/sql.js',
  './ui/lib/codemirror/addon/hint/show-hint.js',
  './ui/lib/codemirror/addon/mode/overlay.js',

  './ui/app/doc/index.html',
  './ui/app/doc/overview.html',
  './ui/app/doc/technical.html',
  './ui/app/doc/usage.html',

  './ui/app/src/actions/AttachmentActions.js',
  './ui/app/src/actions/BoardActions.js',
  './ui/app/src/actions/DocumentActions.js',
  './ui/app/src/actions/EditorActions.js',
  './ui/app/src/actions/HistoryActions.js',
  './ui/app/src/actions/LabelActions.js',
  './ui/app/src/actions/ReferenceActions.js',
  './ui/app/src/actions/SettingsActions.js',
  './ui/app/src/actions/TrashActions.js',
  './ui/app/src/actions/TreeActions.js',
  './ui/app/src/actions/MetaActions.js',
  './ui/app/src/database/Database.js',
  './ui/app/src/database/DatabaseSync.js',
  './ui/app/src/database/ProfileHandler.js',
  './ui/app/src/data/Data.js',
  './ui/app/src/data/Graph.js',
  './ui/app/src/data/Linkage.js',
  './ui/app/src/data/Hashtag.js',
  './ui/app/src/data/Document.js',
  './ui/app/src/data/DocumentAccess.js',
  './ui/app/src/data/DocumentChecks.js',
  './ui/app/src/data/Views.js',
  './ui/app/src/navigation/behaviours/TreeBehaviour.js',
  './ui/app/src/navigation/behaviours/DetailBehaviour.js',
  './ui/app/src/navigation/behaviours/TileBehaviour.js',
  './ui/app/src/navigation/NoteTree.js',
  './ui/app/src/navigation/Behaviours.js',
  './ui/app/src/navigation/MuuriGrid.js',
  './ui/app/src/navigation/ExpandedState.js',
  './ui/app/src/navigation/ScrollState.js',
  './ui/app/src/menus/PageMenu.js',
  './ui/app/src/menus/ContextMenu.js',
  './ui/app/src/pages/editors/Editor.js',
  './ui/app/src/pages/editors/Board.js',
  './ui/app/src/pages/editors/Code.js',
  './ui/app/src/pages/Profiles.js',
  './ui/app/src/pages/Conflict.js',
  './ui/app/src/pages/Conflicts.js',
  './ui/app/src/pages/LabelDefinitions.js',
  './ui/app/src/pages/Hashtags.js',
  './ui/app/src/pages/Versions.js',
  './ui/app/src/pages/VersionView.js',
  './ui/app/src/pages/AttachmentPreview.js',
  './ui/app/src/pages/Console.js',
  './ui/app/src/pages/Trash.js',
  './ui/app/src/pages/RawView.js',
  './ui/app/src/pages/GraphView.js',
  './ui/app/src/pages/Settings.js',
  './ui/app/src/pages/Check.js',
  './ui/app/src/pages/CheckList.js',
  './ui/app/src/pages/Refs.js',
  './ui/app/src/pages/Help.js',
  './ui/app/src/pages/Update.js',
  './ui/app/src/pages/Generate.js',
  './ui/app/src/import/Import.js',
  './ui/app/src/import/NotesImporter.js',
  './ui/app/src/import/TrelloImporter.js',
  './ui/app/src/export/ObsidianExporter.js',
  './ui/app/src/tools/Tools.js',
  './ui/app/src/tools/TouchClickHandler.js',
  './ui/app/src/tools/ClientState.js',
  './ui/app/src/tools/OnlineSensor.js',
  './ui/app/src/tools/ImageDialog.js',
  './ui/app/src/tools/Callbacks.js',
  './ui/app/src/tools/Styles.js',
  './ui/app/src/tools/HistoryHandler.js',
  './ui/app/src/Config.js',
  './ui/app/src/Routing.js',
  './ui/app/src/Notes.js',

  './ui/lib/fa/webfonts/fa-solid-900.woff2',
  './ui/lib/fa/webfonts/fa-regular-400.woff2',
  
  './ui/lib/tinymce/themes/silver/theme.min.js',
  './ui/lib/tinymce/icons/default/icons.min.js',
  './ui/lib/tinymce/plugins/code/plugin.min.js',
  './ui/lib/tinymce/plugins/table/plugin.min.js',
  './ui/lib/tinymce/plugins/image/plugin.min.js',
  './ui/lib/tinymce/plugins/lists/plugin.min.js',
  './ui/lib/tinymce/plugins/advlist/plugin.min.js',
  './ui/lib/tinymce/plugins/charmap/plugin.min.js',
  './ui/lib/tinymce/plugins/codesample/plugin.min.js',
  './ui/lib/tinymce/plugins/emoticons/plugin.min.js',
  './ui/lib/tinymce/plugins/emoticons/js/emojis.min.js',
  './ui/lib/tinymce/plugins/fullscreen/plugin.min.js',
  './ui/lib/tinymce/plugins/hr/plugin.min.js',
  './ui/lib/tinymce/plugins/imagetools/plugin.min.js',
  './ui/lib/tinymce/plugins/link/plugin.min.js',
  './ui/lib/tinymce/plugins/media/plugin.min.js',
  './ui/lib/tinymce/plugins/print/plugin.min.js',
  './ui/lib/tinymce/plugins/searchreplace/plugin.min.js',
  './ui/lib/tinymce/plugins/textpattern/plugin.min.js',
  './ui/lib/tinymce/plugins/toc/plugin.min.js',
  './ui/lib/tinymce/skins/ui/oxide/skin.min.css',
  './ui/lib/tinymce/skins/ui/oxide/content.min.css',
  './ui/lib/tinymce/skins/content/default/content.min.css',

  './ui/app/images/NotesLogo_180.png',
  './ui/app/images/NotesLogo_192.png',
  './ui/app/images/NotesLogo_48.png',
  './ui/app/images/NotesLogo_512.png',
  './ui/app/images/NotesLogo_96.png',
  './ui/app/images/favicon.ico'
];

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
	})
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
 * Listen to messages from the clients
 */
self.addEventListener("message", (event) => {
	if (event.data.requestId) {
		switch(event.data.requestId) {
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
				
				self.clients.matchAll({
					includeUncontrolled: false,
					type: 'window',
				})
				.then((clients) => {
					// Only update when we only have one client
					if (clients.length > 1) {
						event.source.postMessage({
							requestId: 'userMessage',
							type: 'E',
							message: 'Please close all open windows of the app before updating and try again.'
						});
						
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
					self.checkForUpdates(event.request.clone(), cache)
					.then(function (checkResponse) {
						if (checkResponse.outOfDate) {
							console.log("SW: File is out of date, prompting user for update: " + checkResponse.url);
							
							var self_ = self;
							var clientId = event.clientId;
							setTimeout(function() {
								self_.messageToClient(clientId, checkResponse);
							}, 3000);
						} else {
							//console.log("SW Version Check successful for " + checkResponse.url);
						}
					})
					.catch(function (err) {
						console.log("SW Version Check: Failed to check updates of  " + event.request.url + ", see following error:");
						console.log(err);
					});
					
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
