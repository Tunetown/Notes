/**
 * Note taking app - App Routing based on sammy.js
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
class Routing {
	
	#app = null;
	
	constructor(app, selector) {
		this.#app = app;
		
		this.setup(selector);
		this.rootPlaceholder = 'root';
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Set up routing
	 */
	setup(selector) {
		var that = this;
		this.sammy = $.sammy(selector, function() {
			/**
			 * Landing page //////////////////////////////////////////////////////////////////////////////////////////
			 */
			this.get('#/', function() {
				that.#landingPage(true);
			});
			
			this.get('#/notebooks', function() {
				that.#landingPage(false);
			});

			/**
			 * Documentation ////////////////////////////////////////////////////////////////////////////////////////
			 */
			this.get('#/doc', function() {
				that.#loadPage(new HelpPage());
			});
			this.get('#/doc/:docpage', function() {
				that.#loadPage(new HelpPage(), false, this.params['docpage']);
			});
			
			/**
			 * Pages not related to a profile ///////////////////////////////////////////////////////////////////////
			 */
			this.get('#/console', function() {
				that.#loadPage(new ConsolePage());
			});
			
			this.get('#/update', function() {
				that.#loadPage(new UpdatePage());
			});

			/**
			 * Profile Root /////////////////////////////////////////////////////////////////////////////////////////
			 */						
			this.get('#/:profile', function() {
				that.#profileRoot(this.params);
			});

			this.get('#/:profile/', function() {
				that.#profileRoot(this.params);
			});

			this.get('#/:profile/search/:token', function() {
				// Profile root with search text passed as URI parameter
				const token = this.params['token'];
				that.#profileRoot(this.params, true)
				.then(function() {
					that.#app.nav.setSearchText(token);
				});
			});
			
			// Profile root with selected parent ID passed as URI parameter
			this.get('#/:profile/select/', function() {
				that.#profileRoot(this.params, true)
				.then(function() {
					that.#app.nav.focus('');
				});
			});
			this.get('#/:profile/select/:id', function() {
				const id = this.params['id'];
				that.#profileRoot(this.params, true)
				.then(function() {
					that.#app.nav.focus(id ? id : '');
				});
			});
			
			/**
			 * Profile dependent general pages ///////////////////////////////////////////////////////////////////////////////
			 */
			this.get('#/:profile/settings', function() {
				that.#settingsPage(this.params['profile']);
			});
			
			this.get('#/:profile/generate', function() {
				that.#loadPage(new GeneratePage(), this.params['profile']);
			});
			
			this.get('#/:profile/graph', function() {
				that.#loadPage(new GraphPage(), this.params['profile']);
			});
			
			this.get('#/:profile/trash', function() {
				that.#triggerAction(function() {
					return that.#app.actions.trash.showTrash();
				}, this.params['profile']);
			});
			
			this.get('#/:profile/verifyrawdata', function() {
				that.#loadPage(new VerifyBackupPage(), this.params['profile']);
			});
			
			this.get('#/:profile/check', function() {
				that.#loadPage(new CheckPage(), this.params['profile']);
			});

			this.get('#/:profile/conflicts', function() {
				that.#loadPage(new ConflictsPage(), this.params['profile']);
			});
			
			this.get('#/:profile/tags', function() {
				that.#loadPage(new HashtagsPage(), this.params['profile']);
			});
			
			this.get('#/:profile/tags/:noteId', function() {
				that.#loadPage(new HashtagsPage(), this.params['profile'], this.params['noteId']);
			});
			
			this.get('#/:profile/labels', function() {
				that.#loadPage(new LabelDefinitionsPage(), this.params['profile']);
			});

			/**
			 * Pages related to a note //////////////////////////////////////////////////////////////////////////////////
			 */

			this.get('#/:profile/history/:noteId/:versionName', function() {
				const noteId = this.params['noteId'];
				const versionName = this.params['versionName'];
				that.#triggerAction(function() {
					return that.#app.actions.history.requestVersion(noteId, versionName);
				}, this.params['profile'], true);
			});
			
			// Version history of a note
			this.get('#/:profile/history/:noteId', function() {
				const noteId = this.params['noteId'];
				that.#triggerAction(function() {
					return that.#app.actions.history.showHistory(noteId);
				}, this.params['profile'], true);
			});

			// References to a note
			this.get('#/:profile/refs/:noteId', function() {
				that.#loadPage(new RefsPage(), this.params['profile'], this.params['noteId']);
			});
			
			// Conflict of a note
			this.get('#/:profile/c/:noteId/:revId', function() {
				const noteId = this.params['noteId'];
				const revId = this.params['revId'];
				that.#triggerAction(function() {
					return that.#app.actions.document.requestConflict(noteId, revId);
				}, this.params['profile']);
			});
			
			// Label definitions of an item
			this.get('#/:profile/ld/:noteId', function() {
				const noteId = this.params['noteId'];
				that.#triggerAction(function() {
					return that.#app.actions.label.requestLabelDefinitions(noteId);
				}, this.params['profile'], true);
			});
			
			// Raw JSON view for an item
			this.get('#/:profile/raw/:noteId', function() {
				const noteId = this.params['noteId'];
				that.#triggerAction(function() {
					return that.#app.actions.document.requestRawView(noteId);
				}, this.params['profile'], true);
			});
			
			// Open document
			this.get('#/:profile/:noteId', function() {
				that.#openDocument(this.params['profile'], this.params['noteId']);
			});
			
			// Document with search text predefined 
			this.get('#/:profile/:noteId/search/:token', function() {     // TODO test this
				that.#openDocument(this.params['profile'], this.params['noteId'], this.params['token']);
			});
		});
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Select notebook site (this redirects to the last loaded site if the landing page
	 * has been loaded)
	 */
	#landingPage(regardLastLoaded) {
		var lastLoaded = regardLastLoaded ? this.#app.state.getLastOpenedUrl() : false;

		var that = this;
		this.#app.startApp()
		.then(function() {
			if (lastLoaded) {
				console.log("Redirect to last loaded: " + lastLoaded);
				location.href = lastLoaded;
			} else {
				that.#app.loadPage(new ProfilesPage());
			}
		
		})
		.catch(function(err) {
			that.#app.showAlert('Error: ' + err.stack, 'E', err.messageThreadId);
		});
	}

	/**
	 * Profile root: Show overview
	 */
	#profileRoot(params, waitForTree) {
		var that = this;
		
		if (waitForTree) this.#app.state.resetTreeFocusId();
		
		return this.#app.startApp(params['profile'])
		.then(function(data) {
			if (!data || !data.ok) return Promise.reject();
			if (!waitForTree) return Promise.resolve(data);
			if (data.treePromise) return data.treePromise;
			return Promise.resolve(data);
		})
		.then(function(data) {
			that.#app.resetPage(true);
			that.#app.setStatusText();
			
			return Promise.resolve({
				ok: true,
				data: data   // Data from startApp
			});						
		})
		.catch(function(err) {
			that.#app.showAlert('Error: ' + err.stack, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Loads a page instance
	 */
	#loadPage(pageInstance, profile, pageData) {
		var that = this;
		
		return this.#app.startApp(profile)
		.then(function(data) {
			if (!data || !data.ok) return Promise.reject();
			if (!pageInstance.needsHierarchyData()) return Promise.resolve(data);
			if (data.treePromise) return data.treePromise;
			return Promise.resolve(data);
		})
		.then(function() {
			return that.#app.loadPage(pageInstance, pageData);
		})
		.catch(function(err) {
			that.#app.showAlert('Error loading page: ' + err.stack, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Triggers a callback after startApp. callback will be called with the data returned by Notes.startApp().
	 */
	#triggerAction(callback, profile, waitForTree) {
		var that = this;
		
		return this.#app.startApp(profile)
		.then(function(data) {
			if (!data || !data.ok) return Promise.reject();
			if (!waitForTree) return Promise.resolve(data);
			if (data.treePromise) return data.treePromise;
			return Promise.resolve(data);
		})
		.then(function(data) {
			return callback(data);
		})
		.catch(function(err) {
			that.#app.showAlert('Error loading page: ' + err.stack, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Loads the settings page
	 */
	#settingsPage(profile) {
		var that = this;
		
		return this.#app.startApp(profile)
		.then(function(data) {
			return data.treePromise
			.then(function() {
				return that.#app.loadPage(new SettingsPage());
			})
			.catch(function() {
				that.#app.setStatusText('No settings found');
				return that.#app.loadPage(new SettingsPage());
			});
		})
		.catch(function(err) {
			that.#app.showAlert('Error: ' + err.stack, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Open a document
	 */
	#openDocument(profile, noteId, searchToken) {
		var that = this;
		
		return this.#app.startApp(profile)
		.then(function(data) {
			if (!data || !data.ok) return Promise.reject();
			if (data.treePromise) return data.treePromise;
			return Promise.resolve(data);
		})
		.then(function(data) {
			var doc = Document.getTargetDoc(that.#app.data ? that.#app.data.getById(noteId) : null);
			if (that.#app.db.profileHandler.getCurrentProfile().clone && doc) {
				// If the data is already there, use it
				return that.#app.actions.editor.requestEditor(doc)
				.then(function() {
					return Promise.resolve({
						ok: true,
						data: data
					})
				});
			} else {
				// If the data is not yet there or we are not in clone mode, load it from DB
				return that.#app.actions.document.request(noteId)
				.then(function() {
					return Promise.resolve({
						ok: true,
						data: data
					})
				});
			}
		})
		.then(function() {
			that.#app.nav.editorOpened(noteId);
			that.#app.nav.setSearchText(searchToken);
			
			that.#app.callbacks.executeCallbacks('openDocumentAndTree', noteId);
		})
		.catch(function(err) {
			that.#app.showAlert('Error loading note: ' + err.stack, 'E', err.messageThreadId);
		});
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Start routing
	 */
	run() {
		this.sammy.run('#/');
	}
	
	/**
	 * Refresh current path
	 */
	refresh() {
		this.sammy.refresh();
	}
	
	/**
	 * Calls the profile selection screen
	 */
	callSelectProfile() {
		this.#app.state.setLastOpenedUrl();
		location.href = '#/notebooks';
	}
	
	/**
	 * Calls a route
	 */
	call(path, profileUrl) {
		if (profileUrl) {
			this.#app.nav.resetFavoriteBuffers();
		}
		
		var url = this.getBasePath(profileUrl) + (path ? path : '');
		if (location.href == url) {
			this.#app.refresh();
		} else {
			location.href = url;
		}
	}
	
	/**
	 * Sets the serach text to the token after page load. Optionally, you can pass 
	 * a document ID to be opened, else the profile root is loaded.
	 */
	callSearch(token, id) {
		if (!token) {
			this.call(id);
			return;
		}
		
		this.call((id ? (id + '/') : '') + 'search/' + token);
	}
	
	/**
	 * Calls the profile root with a pre-selected parent ID.
	 */
	callProfileRootWithSelectedId(id) {
		this.call('select/' + (id ? id : ''));
	}
	
	/**
	 * Returns the profile base path
	 */
	getBasePath(profileUrl, routeOnly) {
		var profile = this.#app.db.profileHandler.exportProfile(profileUrl, true);
		if (!profile && profileUrl) {
			// New profile: Encode
			profile = this.#app.db.profileHandler.encodeProfile({
				url: profileUrl
			});
		}
		if (routeOnly) {
			return '#/' + profile + '/';			
		} else {
			return location.protocol +'//'+ location.host + (location.pathname ? location.pathname : '') + '#/' + profile + '/';
		}
	}
	
	/**
	 * Post processing for last opened URL
	 * 
	 * TODO solve otherwise
	 */
	static postProcessLastOpenedUrl(url) {
		return url;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Call a conflict
	 */
	callConflict(id, rev) {
		this.call('c/' + id + '/' + rev);
	}
	
	/**
	 * Calls the conflicts page
	 */
	callConflicts() {
		this.call("conflicts");
	}
	
	/**
	 * Calls the docs page
	 */
	callDocumentation() {
		location.href = '#/doc/overview';
	}
	
	/**
	 * Calls the update page
	 */
	callUpdatePage() {
		location.href = '#/update';
	}
	
	/**
	 * Calls the raw JSON view
	 */
	callRawView(id) {
		this.call('raw/' + id);
	}
	
	/**
	 * Call labels list of an item
	 */
	callLabelDefinitions(id) {
		if (!id) {
			this.call('labels');
		} else {
			this.call('ld/' + id);
		}
	}
	
	/**
	 * Call hashtags overview
	 */
	callHashtags(id) {
		this.call('tags' + (id ? ('/' + id) : ''));
	}
	
	/**
	 * Calls settings
	 */
	callSettings() {
		this.call("settings");
	}
	
	/**
	 * Calls the console
	 */
	callConsole() {
		location.href = '#/console';
	}
	
	/**
	 * Calls the verification page
	 */
	callVerifyBackup() {
		this.call('verifyrawdata');
	}
	
	/**
	 * Calls the console
	 */
	callTrash() {
		this.call("trash");
	}
	
	/**
	 * Call graph view.
	 */
	callGraphView() {
		this.call("graph");
	}
	
	/**
	 * Calls the about dialog.
	 */
	callAbout() {
		this.callUpdatePage();
	}
}