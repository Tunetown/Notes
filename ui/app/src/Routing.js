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
	
	// Select notebook site (this redirects to the last loaded site if the landing page
	// has been loaded)
	#landingPage(context, regardLastLoaded) {
		var lastLoaded = regardLastLoaded ? this.#app.getLastOpenedUrl() : false;

		var that = this;
		this.#app.startApp()
		.then(function(data) {
			that.#app.resetPage();
			
			if (lastLoaded) {
				console.log("Redirect to last loaded: " + lastLoaded);
				location.href = lastLoaded;
			} else {
				that.#app.loadPage(new ProfilesPage());
			}
		
		})
		.catch(function(err) {
			that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
		});
	}

	// Profile root: Show overview
	#profileRoot(context, params) {
		var that = this;
		
		return this.#app.startApp(params['profile'])
		.then(function(data) {
			that.#app.resetPage(true);
			that.#app.setStatusText();
			
			return Promise.resolve({
				ok: true,
				startAppData: data
			});						
		})
		.catch(function(err) {
			that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
		});
	};


	/**
	 * Set up routing
	 */
	setup(selector) {
		var that = this;
		this.sammy = $.sammy(selector, function() {
			this.get('#/', function(context) {
				that.#landingPage(context, true);
			});
			this.get('#/notebooks', function(context) {
				that.#landingPage(context, false);
			});

			// Documentation
			this.get('#/doc', function(context) {
				that.#app.startApp()
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.loadPage(new HelpPage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading help page: ' + err.message, 'E', err.messageThreadId);
				});
			});
			this.get('#/doc/:docpage', function(context) {
				var docpage = this.params['docpage'];
				
				that.#app.startApp()
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.loadPage(new HelpPage(), docpage);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading help page: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Console
			this.get('#/console', function(context) {
				that.#app.startApp()
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.loadPage(new ConsolePage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Update page
			this.get('#/update', function(context) {
				that.#app.startApp()
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.loadPage(new UpdatePage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading update page: ' + err.message, 'E', err.messageThreadId);
				});
			});
						
			this.get('#/:profile', function(context) {
				that.#profileRoot(context, this.params);
			});
			this.get('#/:profile/', function(context) {
				that.#profileRoot(context, this.params);
			});
			
			// Profile root with search text passed as URI parameter
			this.get('#/:profile/search/:token', function(context) {
				const token = this.params['token'];
				
				that.#app.state.resetTreeFocusId();
				
				that.#profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok || !token) return Promise.reject();
					
					if (resp.startAppData && resp.startAppData.treePromise) {
						return resp.startAppData.treePromise;
					} else {
						return Promise.resolve();
					}
				})
				.then(function() {
					that.#app.nav.setSearchText(token);
				});
			});
			
			// Profile root with selected parent ID passed as URI parameter
			this.get('#/:profile/select/', function(context) {
				that.#app.state.resetTreeFocusId();
				
				that.#profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok) return Promise.reject();
					
					if (resp.startAppData && resp.startAppData.treePromise) {
						return resp.startAppData.treePromise;
					} else {
						return Promise.resolve();
					}
				})
				.then(function() {
					that.#app.nav.focus('');
				});
			});
			this.get('#/:profile/select/:id', function(context) {
				that.#app.state.resetTreeFocusId();
				
				const id = this.params['id'];
				that.#profileRoot(context, this.params)
				.then(function(resp) {
					if (!resp || !resp.ok) return Promise.reject();
					
					if (resp.startAppData && resp.startAppData.treePromise) {
						return resp.startAppData.treePromise;
					} else {
						return Promise.resolve();
					}
				})
				.then(function() {
					that.#app.nav.focus(id ? id : '');
				});
			});
			
			// Settings
			this.get('#/:profile/settings', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.all([data.settingsPromise, data.treePromise])
					.then(function(data) {
						that.#app.resetPage();
						return that.#app.loadPage(new SettingsPage());
					})
					.catch(function(err) {
						that.#app.resetPage();
						that.#app.setStatusText('No settings found');
						return that.#app.loadPage(new SettingsPage());
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Generator
			this.get('#/:profile/generate', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.resolve(data.treePromise);
				})
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.loadPage(new GeneratePage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Graph view
			this.get('#/:profile/graph', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.all([data.treePromise, data.settingsPromise])
					.then(function(data) {
						return that.#app.loadPage(new GraphPage());
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Trash bin
			this.get('#/:profile/trash', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					// NOTE: The trash bin needs the basic tree data only to reference 
					//       parents. This is why we wait for the tree here.
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.actions.trash.showTrash();
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading trash: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Verify backup
			this.get('#/:profile/verifyrawdata', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					that.#app.loadPage(new VerifyBackupPage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Checks
			this.get('#/:profile/check', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					that.#app.loadPage(new CheckPage());
				})
				.catch(function(err) {
					that.#app.showAlert('Error: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// All conflicts
			this.get('#/:profile/conflicts', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					// NOTE: This needs all tree data, so we wait for the tree promise first
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.loadPage(new ConflictsPage());
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading conflicts: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// All hashtags
			this.get('#/:profile/tags', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.loadPage(new HashtagsPage());
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading tags overview: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Hashtags of a note
			this.get('#/:profile/tags/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.loadPage(new HashtagsPage(), noteId);
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading tags overview: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// All labels
			this.get('#/:profile/labels', function(context) {
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					// NOTE: This needs all tree data, so we wait for the tree promise first
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.loadPage(new LabelDefinitionsPage());
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading labels: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// Version of a note
			this.get('#/:profile/history/:noteId/:versionName', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				var versionName = this.params['versionName'];
				if (!versionName) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.actions.history.requestVersion(noteId, versionName);
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading version: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Version history of a note
			this.get('#/:profile/history/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.actions.history.showHistory(noteId);
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading history: ' + err.message, 'E', err.messageThreadId);
				});
			});

			// References to a note
			this.get('#/:profile/refs/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					
					return Promise.resolve(data.treePromise)
					.then(function(data) {
						return that.#app.loadPage(new RefsPage(), noteId);
					});
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading references: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Conflict of a note
			this.get('#/:profile/c/:noteId/:revId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				var revId = this.params['revId'];
				if (!revId) {
					that.#app.showAlert('No revision received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.actions.document.requestConflict(noteId, revId);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading conflict: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Label definitions of an item
			this.get('#/:profile/ld/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				// NOTE: This needs the parents and label definitions of the whole tree.
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					return Promise.resolve(data.treePromise);
				})
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.actions.label.requestLabelDefinitions(noteId);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading labels: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Raw JSON view for an item
			this.get('#/:profile/raw/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				
				that.#app.startApp(this.params['profile'])
				.then(function(data) {
					that.#app.resetPage();
					return that.#app.actions.document.requestRawView(noteId);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading raw JSOn view: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			this.get('#/:profile/:noteId', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}

				that.#openDocument(context, this.params, noteId)
				.then(function(data) {
					if (!data || !data.ok) return Promise.reject({
						message: 'Error in Routing.opeDocument()' + (data && data.message) ? (': ' + data.message) : ''
					});
					return Promise.resolve(data.startAppData.treePromise);
				})
				.then(function() {
					that.#app.nav.setSearchText();
					that.#app.nav.editorOpened(noteId);
					
					that.#app.callbacks.executeCallbacks('openDocumentAndTree', noteId);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading note: ' + err.message, 'E', err.messageThreadId);
				});
			});
			
			// Item with search text predefined
			this.get('#/:profile/:noteId/search/:token', function(context) {
				var noteId = this.params['noteId'];
				if (!noteId) {
					that.#app.showAlert('No ID received', 'E');
					return;
				}
				var token = this.params['token'];
				
				that.#openDocument(context, this.params, noteId)
				.then(function(data) {
					if (!data || !data.ok) return Promise.reject({
						message: 'Error in Routing.opeDocument()' + (data && data.message) ? (': ' + data.message) : ''
					});
					return Promise.resolve(data.startAppData.treePromise);
				})
				.then(function() {
					if (token) that.#app.nav.setSearchText(token);
					
					that.#app.callbacks.executeCallbacks('openDocumentAndTree', noteId);
				})
				.catch(function(err) {
					that.#app.showAlert('Error loading note: ' + err.message, 'E', err.messageThreadId);
				});
			});
		});
	}
	
	#openDocument(context, params, noteId) {
		var that = this;
		
		return this.#app.startApp(params['profile'])
		.then(function(data) {
			that.#app.resetPage();
			
			var doc = Document.getTargetDoc(that.#app.getData() ? that.#app.getData().getById(noteId) : null);
			if (that.#app.db.profileHandler.getCurrentProfile().clone && doc) {
				// If the data is already there, use it
				return that.#app.actions.editor.requestEditor(doc)
				.then(function() {
					return Promise.resolve({
						ok: true,
						startAppData: data
					})
				});
			} else {
				// If the data is not yet there or we are not in clone mode, load it from DB
				return that.#app.actions.document.request(noteId)
				.then(function() {
					return Promise.resolve({
						ok: true,
						startAppData: data
					})
				});
			}
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